import mongoose from "mongoose";
import { schemaOptions as opts } from "../schema-options.js";
const { Schema, model } = mongoose;
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
