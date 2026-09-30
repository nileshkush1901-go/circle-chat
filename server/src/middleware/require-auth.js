import { authenticate } from "../auth.js";
export const requireAuth = async (req, res, next) => {
  req.user = await authenticate(req.cookies.circle_session);
  if (!req.user) return res.status(401).json({ error: "Please sign in" });
  next();
};
