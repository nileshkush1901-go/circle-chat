import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  User,
  Session,
  Room,
  Message,
  Upload,
  Report,
  publicUser,
  ownUser,
  roomView,
} from "./models.js";
import {
  authenticate,
  issueSession,
  hashPassword,
  checkPassword,
  hashToken,
} from "./auth.js";
import { canRead, canWrite, canModerate, fail, id } from "./access.js";
const name = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(
    /^[\p{L}\p{N}_ .-]+$/u,
    "Use letters, numbers, spaces, dots or dashes",
  );
const credentials = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/),
  password: z.string().min(10).max(128),
});
export function makeApp({
  origin = "http://localhost:4200",
  production = false,
  uploadDir = path.resolve("uploads"),
} = {}) {
  const app = express();
  app.locals.uploadDir = uploadDir;
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "blob:", "data:"],
          "media-src": ["'self'", "blob:"],
          "connect-src": ["'self'", origin, origin.replace(/^http/, "ws")],
          "frame-src": ["'none'"],
          "upgrade-insecure-requests": production ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "128kb" }), cookieParser());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== origin
    )
      return res.status(403).json({ error: "Untrusted origin" });
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers["x-circle-request"] !== "1"
    )
      return res.status(403).json({ error: "Missing request header" });
    next();
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.get("/api/health", (_q, res) => res.json({ ok: true }));
  app.post("/api/auth/guest", authLimit, async (req, res) => {
    const data = z.object({ name }).parse(req.body);
    const u = await User.create({
      ...data,
      color: ["#6750e8", "#227e77", "#bd5370", "#3d71bd"][
        Math.floor(Math.random() * 4)
      ],
    });
    await issueSession(res, u, production);
    res.status(201).json(ownUser(u));
  });
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const data = credentials.extend({ name }).parse(req.body);
    const u = await User.create({
      name: data.name,
      handle: data.handle,
      password: await hashPassword(data.password),
      guest: false,
    });
    await issueSession(res, u, production);
    res.status(201).json(ownUser(u));
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const data = credentials.parse(req.body);
    const u = await User.findOne({ handle: data.handle }).select("+password");
    if (!u || u.banned || !(await checkPassword(data.password, u.password)))
      fail(401, "Incorrect username or password");
    await issueSession(res, u, production);
    res.json(ownUser(u));
  });
  app.use("/api", async (req, res, next) => {
    req.user = await authenticate(req.cookies.circle_session);
    if (!req.user) return res.status(401).json({ error: "Please sign in" });
    next();
  });
  app.get("/api/me", (req, res) => res.json(ownUser(req.user)));
  app.post("/api/auth/logout", async (req, res) => {
    await Session.deleteOne({ hash: hashToken(req.cookies.circle_session) });
    for (const s of app.locals.io?.sockets.sockets.values() || [])
      if (s.data.token === req.cookies.circle_session) s.disconnect(true);
    res.clearCookie("circle_session", { path: "/" }).json({ ok: true });
  });
  app.patch("/api/me", async (req, res) => {
    const data = z
      .object({
        name,
        bio: z.string().trim().max(180),
        color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
      })
      .parse(req.body);
    Object.assign(req.user, data);
    await req.user.save();
    res.json(ownUser(req.user));
  });
  app.get("/api/users/:id", async (req, res) => {
    const u = await User.findById(id(req.params.id));
    if (!u) fail(404, "User not found");
    res.json(publicUser(u));
  });
  app.get("/api/blocked", async (req, res) =>
    res.json(
      (await User.find({ _id: { $in: req.user.blocked } })).map(publicUser),
    ),
  );
  app.post("/api/block/:id", async (req, res) => {
    const other = id(req.params.id);
    if (other === String(req.user._id)) fail(400, "Cannot block yourself");
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { blocked: other } },
    );
    app.locals.endCall?.(String(req.user._id));
    res.json({ ok: true });
  });
  app.delete("/api/block/:id", async (req, res) => {
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { blocked: id(req.params.id) } },
    );
    res.json({ ok: true });
  });
  app.get("/api/rooms", async (req, res) => {
    const rooms = await Room.find({
      kind: "room",
      $or: [{ private: false }, { members: String(req.user._id) }],
    })
      .sort({ createdAt: 1 })
      .limit(200);
    res.json(
      rooms
        .filter((r) => !r.banned.includes(String(req.user._id)))
        .map((r) => ({
          ...roomView(r, req.user),
          online: app.locals.online?.(String(r._id)) || 0,
        })),
    );
  });
  app.post("/api/rooms", async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(3).max(40),
        description: z.string().trim().max(180),
        category: z.enum([
          "General",
          "Music",
          "Gaming",
          "Learning",
          "Movies",
          "Travel",
        ]),
        private: z.boolean(),
      })
      .parse(req.body);
    const uid = String(req.user._id);
    if ((await Room.countDocuments({ owner: uid })) >= 20)
      fail(429, "Room limit reached");
    const r = await Room.create({
      ...data,
      owner: uid,
      members: [uid],
      invite: randomBytes(16).toString("hex"),
    });
    res.status(201).json(roomView(r, req.user));
  });
  app.post("/api/invites/:code", async (req, res) => {
    const r = await Room.findOne({
      invite: z
        .string()
        .regex(/^[a-f0-9]{32}$/)
        .parse(req.params.code),
      kind: "room",
    });
    if (!r) fail(404, "Invite not found");
    if (r.banned.includes(String(req.user._id)))
      fail(403, "You cannot join this room");
    await Room.updateOne(
      { _id: r._id },
      { $addToSet: { members: String(req.user._id) } },
    );
    res.json(roomView(await Room.findById(r._id), req.user));
  });
  app.post("/api/rooms/:id/join", async (req, res) => {
    const r = await canRead(req.params.id, req.user);
    await Room.updateOne(
      { _id: r._id },
      { $addToSet: { members: String(req.user._id) } },
    );
    res.json(roomView(await Room.findById(r._id), req.user));
  });
  app.get("/api/rooms/:id/messages", async (req, res) => {
    await canRead(req.params.id, req.user);
    const query = { room: req.params.id };
    if (req.query.before) query._id = { $lt: id(req.query.before) };
    const messages = await Message.find(query).sort({ _id: -1 }).limit(50);
    res.json(
      messages.reverse().filter((m) => !req.user.blocked.includes(m.user)),
    );
  });
  app.get("/api/rooms/:id/members", async (req, res) => {
    const r = await canRead(req.params.id, req.user);
    const users = await User.find({
      _id: { $in: r.members },
      banned: false,
    }).limit(200);
    res.json(
      users.map((u) => ({
        ...publicUser(u),
        online: app.locals.isOnline?.(String(u._id)) || false,
      })),
    );
  });
  app.get("/api/rooms/:id/activity", async (req, res) => {
    const r = await canRead(req.params.id, req.user);
    res.json({ board: r.board, watch: r.watch });
  });
  app.post("/api/rooms/:id/ban", async (req, res) => {
    const r = await canRead(req.params.id, req.user);
    if (!canModerate(r, req.user)) fail(403, "Moderator access required");
    const target = id(req.body.user);
    if (target === r.owner || target === String(req.user._id))
      fail(400, "Cannot remove the owner or yourself");
    const targetUser = await User.findById(target);
    if (targetUser?.role === "admin")
      fail(403, "Cannot remove an administrator");
    await Room.updateOne(
      { _id: r._id },
      { $addToSet: { banned: target }, $pull: { members: target } },
    );
    for (const s of app.locals.io.sockets.sockets.values())
      if (String(s.data.user._id) === target) {
        s.leave(req.params.id);
        s.emit("room:removed", { room: req.params.id });
      }
    res.json({ ok: true });
  });
  app.delete("/api/messages/:id", async (req, res) => {
    const m = await Message.findById(id(req.params.id));
    if (!m) fail(404, "Message not found");
    const r = await canRead(m.room, req.user);
    if (m.user !== String(req.user._id) && !canModerate(r, req.user))
      fail(403, "Permission denied");
    m.text = "Message removed";
    m.attachment = undefined;
    m.deleted = true;
    await m.save();
    app.locals.io.to(m.room).emit("message:updated", m.toJSON());
    res.json(m);
  });
  app.get("/api/conversations", async (req, res) => {
    const rooms = await Room.find({ kind: "dm", members: String(req.user._id) })
      .sort({ updatedAt: -1 })
      .limit(100);
    const result = [];
    for (const r of rooms) {
      const other = await User.findById(
        r.members.find((x) => x !== String(req.user._id)),
      );
      if (
        other &&
        !req.user.blocked.includes(String(other._id)) &&
        !other.blocked.includes(String(req.user._id))
      )
        result.push({
          ...roomView(r, req.user),
          name: other.name,
          peer: publicUser(other),
        });
    }
    res.json(result);
  });
  app.post("/api/conversations", async (req, res) => {
    const other = await User.findById(id(req.body.user));
    const uid = String(req.user._id);
    if (!other || other.banned || String(other._id) === uid)
      fail(400, "Choose another user");
    if (
      req.user.blocked.includes(String(other._id)) ||
      other.blocked.includes(uid)
    )
      fail(403, "This conversation is blocked");
    const members = [uid, String(other._id)].sort();
    const r = await Room.findOneAndUpdate(
      { pair: members.join(":") },
      {
        $setOnInsert: {
          name: "Direct message",
          kind: "dm",
          private: true,
          members,
        },
      },
      { upsert: true, new: true },
    );
    res.json({
      ...roomView(r, req.user),
      name: other.name,
      peer: publicUser(other),
    });
  });
  const uploadLimit = rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });
  app.post(
    "/api/rooms/:id/uploads",
    uploadLimit,
    async (req, res, next) => {
      await canWrite(req.params.id, req.user);
      next();
    },
    upload.single("file"),
    async (req, res) => {
      if (!req.file) fail(400, "Choose a file");
      const type = await fileTypeFromBuffer(req.file.buffer);
      if (
        !type ||
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/webm",
          "audio/mpeg",
          "audio/ogg",
          "audio/wav",
        ].includes(type.mime)
      )
        fail(400, "Use JPG, PNG, WebP, GIF, MP4, WebM, MP3, OGG or WAV");
      await mkdir(uploadDir, { recursive: true });
      const filename = randomBytes(20).toString("hex") + "." + type.ext;
      await writeFile(path.join(uploadDir, filename), req.file.buffer);
      let u;
      try {
        u = await Upload.create({
          user: String(req.user._id),
          room: req.params.id,
          path: filename,
          mime: type.mime,
          name: req.file.originalname.slice(0, 120),
          size: req.file.size,
        });
      } catch (e) {
        await unlink(path.join(uploadDir, filename));
        throw e;
      }
      res.status(201).json({ id: String(u._id), name: u.name, mime: u.mime });
    },
  );
  app.get("/api/uploads/:id", async (req, res) => {
    const u = await Upload.findById(id(req.params.id));
    if (!u) fail(404, "File not found");
    await canRead(u.room, req.user);
    if (req.user.blocked.includes(u.user)) fail(403, "Content blocked");
    res.set("Content-Type", u.mime).set("Cache-Control", "private, no-store");
    res.sendFile(path.join(uploadDir, u.path));
  });
  app.get("/api/uploads/:id/info", async (req, res) => {
    const u = await Upload.findById(id(req.params.id));
    if (!u) fail(404, "File not found");
    await canRead(u.room, req.user);
    res.json({ id: String(u._id), name: u.name, mime: u.mime });
  });
  app.post("/api/reports", async (req, res) => {
    const data = z
      .object({
        message: z.string(),
        reason: z.string().trim().min(5).max(500),
      })
      .parse(req.body);
    const m = await Message.findById(id(data.message));
    if (!m) fail(404, "Message not found");
    await canRead(m.room, req.user);
    await Report.create({
      ...data,
      room: m.room,
      reporter: String(req.user._id),
    });
    res.status(201).json({ ok: true });
  });
  app.use("/api/admin", (req, res, next) => {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Administrator access required" });
    next();
  });
  app.get("/api/admin/reports", async (req, res) => {
    const reports = await Report.find({ status: "open" })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(
      await Promise.all(
        reports.map(async (r) => ({
          ...r.toJSON(),
          content: await Message.findById(r.message),
        })),
      ),
    );
  });
  app.patch("/api/admin/reports/:id", async (req, res) => {
    await Report.updateOne(
      { _id: id(req.params.id) },
      { $set: { status: "resolved" } },
    );
    res.json({ ok: true });
  });
  app.post("/api/admin/ban/:id", async (req, res) => {
    const uid = id(req.params.id);
    if (uid === String(req.user._id)) fail(400, "Cannot ban yourself");
    const u = await User.findById(uid);
    if (!u) fail(404, "User not found");
    if (u.role === "admin") fail(403, "Cannot ban an administrator");
    u.banned = true;
    await u.save();
    await Session.deleteMany({ user: uid });
    app.locals.io.in("user:" + uid).disconnectSockets(true);
    res.json({ ok: true });
  });
  app.get("/api/rtc-config", (_req, res) =>
    res.json({
      iceServers: JSON.parse(
        process.env.ICE_SERVERS || '[{"urls":"stun:stun.l.google.com:19302"}]',
      ),
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found" }),
  );
  const dist = path.resolve(import.meta.dirname, "../../client/dist/browser");
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(dist, "index.html")),
  );
  app.use((err, req, res, _next) => {
    if (err.name === "ZodError")
      return res
        .status(400)
        .json({ error: err.issues[0]?.message || "Invalid input" });
    if (err.code === 11000)
      return res.status(409).json({ error: "That username is already taken" });
    if (err.code === "LIMIT_FILE_SIZE")
      return res.status(413).json({ error: "File must be under 10 MB" });
    const status =
      err.status || (err instanceof multer.MulterError ? 400 : 500);
    if (status >= 500) console.error(err);
    res
      .status(status)
      .json({
        error:
          status < 500 ? err.message : "Service unavailable. Please try again.",
      });
  });
  return app;
}
