import { z } from "zod";
import { randomBytes } from "node:crypto";
import { User, Room, Message, publicUser, roomView } from "../../models.js";
import { canRead, canModerate, fail, id } from "../../access.js";
import { Router } from "express";

export function createRoomsRouter() {
  const router = Router();
  router.get("/rooms", async (req, res) => {
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
          online: req.app.locals.online?.(String(r._id)) || 0,
        })),
    );
  });
  router.post("/rooms", async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(3).max(40),
        description: z.string().trim().max(180),
        category: z.enum(["General", "Music", "Gaming", "Learning", "Movies", "Travel"]),
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
  router.post("/invites/:code", async (req, res) => {
    const r = await Room.findOne({
      invite: z
        .string()
        .regex(/^[a-f0-9]{32}$/)
        .parse(req.params.code),
      kind: "room",
    });
    if (!r) fail(404, "Invite not found");
    if (r.banned.includes(String(req.user._id))) fail(403, "You cannot join this room");
    await Room.updateOne(
      { _id: r._id },
      { $addToSet: { members: String(req.user._id) } },
    );
    res.json(roomView(await Room.findById(r._id), req.user));
  });
  router.post("/rooms/:id/join", async (req, res) => {
    const r = await canRead(req.params.id, req.user);
    await Room.updateOne(
      { _id: r._id },
      { $addToSet: { members: String(req.user._id) } },
    );
    res.json(roomView(await Room.findById(r._id), req.user));
  });
  router.get("/rooms/:id/messages", async (req, res) => {
    await canRead(req.params.id, req.user);
    const query = { room: req.params.id };
    if (req.query.before) query._id = { $lt: id(req.query.before) };
    const messages = await Message.find(query).sort({ _id: -1 }).limit(50);
    res.json(messages.reverse().filter((m) => !req.user.blocked.includes(m.user)));
  });
  router.get("/rooms/:id/members", async (req, res) => {
    const r = await canRead(req.params.id, req.user);
    const users = await User.find({
      _id: { $in: r.members },
      banned: false,
    }).limit(200);
    res.json(
      users.map((u) => ({
        ...publicUser(u),
        online: req.app.locals.isOnline?.(String(u._id)) || false,
      })),
    );
  });
  router.get("/rooms/:id/activity", async (req, res) => {
    const r = await canRead(req.params.id, req.user);
    res.json({ board: r.board, watch: r.watch });
  });
  router.post("/rooms/:id/ban", async (req, res) => {
    const r = await canRead(req.params.id, req.user);
    if (!canModerate(r, req.user)) fail(403, "Moderator access required");
    const target = id(req.body.user);
    if (target === r.owner || target === String(req.user._id))
      fail(400, "Cannot remove the owner or yourself");
    const targetUser = await User.findById(target);
    if (targetUser?.role === "admin") fail(403, "Cannot remove an administrator");
    await Room.updateOne(
      { _id: r._id },
      { $addToSet: { banned: target }, $pull: { members: target } },
    );
    for (const s of req.app.locals.io.sockets.sockets.values())
      if (String(s.data.user._id) === target) {
        s.leave(req.params.id);
        s.emit("room:removed", { room: req.params.id });
      }
    res.json({ ok: true });
  });

  return router;
}
