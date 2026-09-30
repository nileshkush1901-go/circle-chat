import { Server } from "socket.io";
import { z } from "zod";
import { authenticate, cookieToken } from "./auth.js";
import { canRead, canWrite, fail, id } from "./access.js";
import { User, Room, Message, Upload, publicUser, roomView } from "./models.js";
export function attachRealtime(
  http,
  app,
  { origin = "http://localhost:4200" } = {},
) {
  const io = new Server(http, {
    maxHttpBufferSize: 128000,
    cors: { origin, credentials: true },
    allowRequest: (req, cb) =>
      cb(null, !req.headers.origin || req.headers.origin === origin),
  });
  app.locals.io = io;
  const waiting = new Map(),
    calls = new Map(),
    budgets = new Map();
  const online = (uid) => !!io.sockets.adapter.rooms.get("user:" + uid)?.size;
  app.locals.isOnline = online;
  app.locals.endCall = (uid) => terminate(uid);
  app.locals.online = (room) =>
    new Set(
      [...io.sockets.sockets.values()]
        .filter((s) => s.rooms.has(room))
        .map((s) => String(s.data.user._id)),
    ).size;
  const presence = (room) => {
    if (room)
      io.to(room).emit("presence", {
        room,
        users: [
          ...new Map(
            [...io.sockets.sockets.values()]
              .filter((s) => s.rooms.has(room))
              .map((s) => [String(s.data.user._id), publicUser(s.data.user)]),
          ).values(),
        ],
      });
  };
  const terminate = (uid) => {
    const c = calls.get(uid);
    if (c) {
      calls.delete(c.a);
      calls.delete(c.b);
      io.to("user:" + c.a)
        .to("user:" + c.b)
        .emit("call:ended");
    }
  };
  const timer = setInterval(() => {
    for (const [uid, c] of calls)
      if (!c.accepted && Date.now() - c.at > 45000) terminate(uid);
    for (const [key, b] of budgets)
      if (Date.now() - b.at > 60000) budgets.delete(key);
  }, 15000);
  timer.unref();
  io.on("close", () => clearInterval(timer));
  io.use(async (s, next) => {
    try {
      s.data.token = cookieToken(s.request.headers.cookie);
      s.data.user = await authenticate(s.data.token);
      if (!s.data.user) return next(new Error("Please sign in"));
      next();
    } catch {
      next(new Error("Authentication unavailable"));
    }
  });
  io.on("connection", (s) => {
    const uid = String(s.data.user._id);
    s.join("user:" + uid);
    function event(name, fn, limit = 90) {
      s.on(name, async (data = {}, ack = () => {}) => {
        if (typeof ack !== "function") ack = () => {};
        try {
          const key = uid + ":" + name;
          let b = budgets.get(key);
          if (!b || Date.now() - b.at > 60000) {
            b = { at: Date.now(), count: 0 };
            budgets.set(key, b);
          }
          if (++b.count > limit) fail(429, "Slow down and try again shortly");
          const u = await authenticate(s.data.token);
          if (!u) fail(401, "Session expired");
          s.data.user = u;
          ack({ ok: true, data: await fn(data, u) });
        } catch (e) {
          ack({
            ok: false,
            error:
              e.name === "ZodError"
                ? e.issues[0].message
                : e.status
                  ? e.message
                  : "Action failed. Please retry.",
          });
        }
      });
    }
    event("room:join", async (data, u) => {
      const r = await canRead(data.room, u);
      await Room.updateOne({ _id: r._id }, { $addToSet: { members: uid } });
      const previous = s.data.activeRoom;
      if (previous) {
        s.leave(previous);
        presence(previous);
      }
      s.join(String(r._id));
      s.data.activeRoom = String(r._id);
      presence(String(r._id));
      return roomView(await Room.findById(r._id), u);
    });
    event(
      "message:send",
      async (data, u) => {
        const d = z
          .object({
            room: z.string(),
            text: z.string().trim().max(2000).default(""),
            attachment: z.string().optional(),
          })
          .parse(data);
        const r = await canWrite(d.room, u);
        if (!d.text && !d.attachment) fail(400, "Write a message");
        if (d.attachment) {
          const a = await Upload.findById(id(d.attachment));
          if (!a || a.user !== uid || a.room !== d.room)
            fail(403, "Invalid attachment");
        }
        const m = await Message.create({
          ...d,
          user: uid,
          name: u.name,
          color: u.color,
        });
        await Room.updateOne(
          { _id: r._id },
          { $set: { updatedAt: new Date() } },
        );
        let target = io.to(d.room);
        if (r.kind === "dm")
          for (const member of r.members) target = target.to("user:" + member);
        target.emit("message", m.toJSON());
        return m.toJSON();
      },
      40,
    );
    event(
      "typing",
      async (data, u) => {
        await canWrite(data.room, u);
        s.to(data.room).emit("typing", {
          room: data.room,
          user: uid,
          name: u.name,
        });
      },
      120,
    );
    event(
      "random:start",
      async (_data, u) => {
        waiting.delete(uid);
        for (const [other, sid] of waiting) {
          const socket = io.sockets.sockets.get(sid);
          const peer = await User.findById(other);
          if (!socket || !peer || peer.banned) {
            waiting.delete(other);
            continue;
          }
          if (
            other === uid ||
            u.blocked.includes(other) ||
            peer.blocked.includes(uid) ||
            waiting.get(other) !== sid
          )
            continue;
          waiting.delete(other);
          const members = [uid, other].sort();
          const r = await Room.findOneAndUpdate(
            { pair: members.join(":") },
            {
              $setOnInsert: {
                kind: "dm",
                private: true,
                name: "Random chat",
                members,
              },
            },
            { new: true, upsert: true },
          );
          s.emit("random:matched", {
            ...roomView(r, u),
            peer: publicUser(peer),
            name: peer.name,
          });
          socket.emit("random:matched", {
            ...roomView(r, peer),
            peer: publicUser(u),
            name: u.name,
          });
          return { matched: true };
        }
        waiting.set(uid, s.id);
        return { waiting: true };
      },
      20,
    );
    event("random:cancel", async () => {
      waiting.delete(uid);
      return { ok: true };
    });
    event(
      "board:stroke",
      async (data, u) => {
        const d = z
          .object({
            room: z.string(),
            color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
            points: z
              .array(
                z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
              )
              .min(2)
              .max(500),
          })
          .parse(data);
        await canWrite(d.room, u);
        const stroke = { color: d.color, points: d.points };
        await Room.updateOne(
          { _id: d.room },
          { $push: { board: { $each: [stroke], $slice: -500 } } },
        );
        io.to(d.room).emit("board:stroke", { room: d.room, stroke });
      },
      100,
    );
    event("board:clear", async (data, u) => {
      const r = await canWrite(data.room, u);
      if (r.owner !== uid && u.role !== "admin")
        fail(403, "Only the room owner can clear the board");
      await Room.updateOne({ _id: r._id }, { $set: { board: [] } });
      io.to(data.room).emit("board:clear", { room: data.room });
    });
    event("watch:update", async (data, u) => {
      const d = z
        .object({
          room: z.string(),
          attachment: z.string(),
          playing: z.boolean(),
          time: z.number().min(0).max(86400),
        })
        .parse(data);
      await canWrite(d.room, u);
      const a = await Upload.findById(id(d.attachment));
      if (!a || a.room !== d.room || !a.mime.startsWith("video/"))
        fail(400, "Choose a video uploaded to this room");
      const watch = {
        attachment: d.attachment,
        playing: d.playing,
        time: d.time,
        at: Date.now(),
      };
      await Room.updateOne({ _id: d.room }, { $set: { watch } });
      io.to(d.room).emit("watch:update", { room: d.room, watch });
    });
    event(
      "call:invite",
      async (data, u) => {
        const d = z
          .object({ room: z.string(), video: z.boolean() })
          .parse(data);
        const r = await canWrite(d.room, u);
        if (r.kind !== "dm")
          fail(400, "Calls are available in direct messages");
        const peer = r.members.find((x) => x !== uid);
        if (!online(peer)) fail(400, "This person is offline");
        if (calls.has(uid) || calls.has(peer))
          fail(409, "Someone is already in a call");
        const c = {
          a: uid,
          b: peer,
          room: d.room,
          video: d.video,
          accepted: false,
          at: Date.now(),
        };
        calls.set(uid, c);
        calls.set(peer, c);
        io.to("user:" + peer).emit("call:incoming", {
          from: publicUser(u),
          room: d.room,
          video: d.video,
        });
        return { ringing: true };
      },
      8,
    );
    event("call:respond", async (data, u) => {
      const c = calls.get(uid);
      if (!c || c.b !== uid) fail(400, "No incoming call");
      await canWrite(c.room, u);
      if (data.accept === true) {
        c.accepted = true;
        io.to("user:" + c.a).emit("call:accepted", {
          room: c.room,
          video: c.video,
        });
        return { accepted: true };
      }
      terminate(uid);
      return {};
    });
    event(
      "call:signal",
      async (data, u) => {
        const c = calls.get(uid);
        if (!c || !c.accepted) fail(403, "No accepted call");
        await canWrite(c.room, u);
        const d = z
          .object({
            signal: z.union([
              z.object({
                type: z.enum(["offer", "answer"]),
                sdp: z.string().max(60000),
              }),
              z.object({ candidate: z.any() }),
            ]),
          })
          .parse(data);
        io.to("user:" + (c.a === uid ? c.b : c.a)).emit("call:signal", d);
      },
      200,
    );
    event("call:end", async () => {
      terminate(uid);
      return {};
    });
    s.on("disconnect", () => {
      if (waiting.get(uid) === s.id) waiting.delete(uid);
      if (!online(uid)) terminate(uid);
      presence(s.data.activeRoom);
    });
  });
  return io;
}
