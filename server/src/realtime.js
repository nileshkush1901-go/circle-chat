import { registerRoomsEvents } from "./realtime/rooms.events.js";
import { registerMessagesEvents } from "./realtime/messages.events.js";
import { registerMatchingEvents } from "./realtime/matching.events.js";
import { registerActivitiesEvents } from "./realtime/activities.events.js";
import { registerCallsEvents } from "./realtime/calls.events.js";
import { Server } from "socket.io";
import { authenticate, cookieToken } from "./auth.js";
import { fail } from "./access.js";
import { publicUser } from "./models.js";
export function attachRealtime(http, app, { origin = "http://localhost:4200" } = {}) {
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
    for (const [key, b] of budgets) if (Date.now() - b.at > 60000) budgets.delete(key);
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
    registerRoomsEvents({ event, s, uid, presence });
    registerMessagesEvents({ event, s, uid, io });

    registerMatchingEvents({ event, s, uid, io, waiting });

    registerActivitiesEvents({ event, uid, io });

    registerCallsEvents({ event, uid, io, calls, online, terminate });

    s.on("disconnect", () => {
      if (waiting.get(uid) === s.id) waiting.delete(uid);
      if (!online(uid)) terminate(uid);
      presence(s.data.activeRoom);
    });
  });
  return io;
}
