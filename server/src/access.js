import mongoose from "mongoose";
import { Room, User } from "./models.js";
export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
export function id(value) {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value))
    fail(400, "Invalid ID");
  return value;
}
export async function canRead(roomId, user) {
  const r = await Room.findById(id(roomId));
  if (!r) fail(404, "Room not found");
  const uid = String(user._id);
  if (r.banned.includes(uid)) fail(403, "You cannot access this room");
  if ((r.private || r.kind === "dm") && !r.members.includes(uid))
    fail(403, "This room is private");
  if (r.kind === "dm") {
    const other = await User.findById(r.members.find((x) => x !== uid));
    if (
      other &&
      (user.blocked.includes(String(other._id)) || other.blocked.includes(uid))
    )
      fail(403, "This conversation is blocked");
  }
  return r;
}
export async function canWrite(roomId, user) {
  const r = await canRead(roomId, user);
  if (!r.members.includes(String(user._id))) fail(403, "Join the room first");
  return r;
}
export function canModerate(r, u) {
  return r.owner === String(u._id) || u.role === "admin";
}
