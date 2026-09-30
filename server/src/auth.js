import {
  randomBytes,
  createHash,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { Session, User } from "./models.js";
const scrypt = promisify(scryptCb);
export const hashToken = (t) => createHash("sha256").update(t).digest("hex");
export async function hashPassword(p) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await scrypt(p, salt, 64)).toString("hex");
}
export async function checkPassword(p, stored) {
  if (!stored) return false;
  const [salt, key] = stored.split(":");
  return timingSafeEqual(Buffer.from(key, "hex"), await scrypt(p, salt, 64));
}
export async function issueSession(res, u, production) {
  const token = randomBytes(32).toString("hex");
  await Session.create({
    hash: hashToken(token),
    user: u._id,
    expires: new Date(Date.now() + 7 * 86400000),
  });
  res.cookie("circle_session", token, {
    httpOnly: true,
    secure: production,
    sameSite: "strict",
    maxAge: 7 * 86400000,
    path: "/",
  });
}
export async function authenticate(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await Session.findOne({
    hash: hashToken(token),
    expires: { $gt: new Date() },
  });
  if (!session) return null;
  const u = await User.findById(session.user);
  return u && !u.banned ? u : null;
}
export function cookieToken(header = "") {
  return header
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("circle_session="))
    ?.split("=")[1];
}
