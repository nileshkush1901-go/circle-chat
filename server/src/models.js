import mongoose from "mongoose";
const { Schema, model } = mongoose;
const opts = {
  timestamps: true,
  toJSON: {
    transform: (_d, r) => {
      r.id = String(r._id);
      delete r._id;
      delete r.__v;
      return r;
    },
  },
};
export const User = model(
  "User",
  new Schema(
    {
      name: String,
      handle: { type: String, unique: true, sparse: true },
      password: { type: String, select: false },
      guest: { type: Boolean, default: true },
      bio: { type: String, default: "" },
      color: { type: String, default: "#6750e8" },
      role: { type: String, default: "user" },
      banned: { type: Boolean, default: false },
      blocked: { type: [String], default: [] },
    },
    opts,
  ),
);
export const Session = model(
  "Session",
  new Schema(
    {
      hash: { type: String, unique: true },
      user: { type: Schema.Types.ObjectId, ref: "User" },
      expires: { type: Date, index: { expires: 0 } },
    },
    opts,
  ),
);
export const Room = model(
  "Room",
  new Schema(
    {
      name: String,
      description: String,
      category: String,
      owner: String,
      private: { type: Boolean, default: false },
      kind: { type: String, default: "room" },
      members: [String],
      banned: [String],
      invite: { type: String, unique: true, sparse: true },
      pair: { type: String, unique: true, sparse: true },
      board: { type: Array, default: [] },
      watch: { type: Schema.Types.Mixed, default: null },
    },
    opts,
  ),
);
export const Message = model(
  "Message",
  new Schema(
    {
      room: { type: String, index: true },
      user: String,
      name: String,
      color: String,
      text: String,
      attachment: String,
      deleted: { type: Boolean, default: false },
    },
    opts,
  ),
);
Message.schema.index({ room: 1, createdAt: -1 });
export const Upload = model(
  "Upload",
  new Schema(
    {
      user: String,
      room: String,
      path: String,
      mime: String,
      name: String,
      size: Number,
    },
    opts,
  ),
);
export const Report = model(
  "Report",
  new Schema(
    {
      reporter: String,
      message: String,
      room: String,
      reason: String,
      status: { type: String, default: "open" },
    },
    opts,
  ),
);
export const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  color: u.color,
  bio: u.bio,
  guest: u.guest,
  role: u.role,
});
export const ownUser = (u) => ({ ...publicUser(u), blocked: u.blocked });
export const roomView = (r, u) => {
  const v = r.toJSON();
  delete v.banned;
  delete v.pair;
  if (v.owner !== String(u._id)) delete v.invite;
  delete v.board;
  delete v.watch;
  return v;
};
