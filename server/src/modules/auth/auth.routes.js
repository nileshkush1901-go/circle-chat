import rateLimit from "express-rate-limit";
import { z } from "zod";
import { User, ownUser } from "../../models.js";
import { issueSession, hashPassword, checkPassword } from "../../auth.js";
import { fail } from "../../access.js";
import { Router } from "express";
import { name, credentials } from "../../shared/validation.js";

export function createAuthRouter({ production = false } = {}) {
  const router = Router();
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  router.post("/auth/guest", authLimit, async (req, res) => {
    const data = z.object({ name }).parse(req.body);
    const u = await User.create({
      ...data,
      color: ["#6750e8", "#227e77", "#bd5370", "#3d71bd"][Math.floor(Math.random() * 4)],
    });
    await issueSession(res, u, production);
    res.status(201).json(ownUser(u));
  });
  router.post("/auth/register", authLimit, async (req, res) => {
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
  router.post("/auth/login", authLimit, async (req, res) => {
    const data = credentials.parse(req.body);
    const u = await User.findOne({ handle: data.handle }).select("+password");
    if (!u || u.banned || !(await checkPassword(data.password, u.password)))
      fail(401, "Incorrect username or password");
    await issueSession(res, u, production);
    res.json(ownUser(u));
  });

  return router;
}
