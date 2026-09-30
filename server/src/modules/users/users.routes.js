import { z } from "zod";
import path from "node:path";
import { User, Session, publicUser, ownUser } from "../../models.js";
import { hashToken } from "../../auth.js";
import { fail, id } from "../../access.js";
import { Router } from "express";
import { name } from "../../shared/validation.js";

export function createUsersRouter() {
  const router = Router();
  router.get("/me", (req, res) => res.json(ownUser(req.user)));
  router.post("/auth/logout", async (req, res) => {
    await Session.deleteOne({ hash: hashToken(req.cookies.circle_session) });
    for (const s of req.app.locals.io?.sockets.sockets.values() || [])
      if (s.data.token === req.cookies.circle_session) s.disconnect(true);
    res.clearCookie("circle_session", { path: "/" }).json({ ok: true });
  });
  router.patch("/me", async (req, res) => {
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
  router.get("/users/:id", async (req, res) => {
    const u = await User.findById(id(req.params.id));
    if (!u) fail(404, "User not found");
    res.json(publicUser(u));
  });
  router.get("/blocked", async (req, res) =>
    res.json((await User.find({ _id: { $in: req.user.blocked } })).map(publicUser)),
  );
  router.post("/block/:id", async (req, res) => {
    const other = id(req.params.id);
    if (other === String(req.user._id)) fail(400, "Cannot block yourself");
    await User.updateOne({ _id: req.user._id }, { $addToSet: { blocked: other } });
    req.app.locals.endCall?.(String(req.user._id));
    res.json({ ok: true });
  });
  router.delete("/block/:id", async (req, res) => {
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { blocked: id(req.params.id) } },
    );
    res.json({ ok: true });
  });

  return router;
}
