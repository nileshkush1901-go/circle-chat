import mongoose from "mongoose";
import { schemaOptions as opts } from "../schema-options.js";
const { Schema, model } = mongoose;
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
