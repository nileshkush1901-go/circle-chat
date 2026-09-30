import mongoose from "mongoose";
import { schemaOptions as opts } from "../schema-options.js";
const { Schema, model } = mongoose;
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
