import { z } from "zod";
import { User, Session, Message, Report } from "../../models.js";
import { canRead, fail, id } from "../../access.js";
import { Router } from "express";

export function createModerationRouter() {
  const router = Router();
  router.post("/reports", async (req, res) => {
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
  router.use("/admin", (req, res, next) => {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Administrator access required" });
    next();
  });
  router.get("/admin/reports", async (req, res) => {
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
  router.patch("/admin/reports/:id", async (req, res) => {
    await Report.updateOne({ _id: id(req.params.id) }, { $set: { status: "resolved" } });
    res.json({ ok: true });
  });
  router.post("/admin/ban/:id", async (req, res) => {
    const uid = id(req.params.id);
    if (uid === String(req.user._id)) fail(400, "Cannot ban yourself");
    const u = await User.findById(uid);
    if (!u) fail(404, "User not found");
    if (u.role === "admin") fail(403, "Cannot ban an administrator");
    u.banned = true;
    await u.save();
    await Session.deleteMany({ user: uid });
    req.app.locals.io.in("user:" + uid).disconnectSockets(true);
    res.json({ ok: true });
  });

  return router;
}
