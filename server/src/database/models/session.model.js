import mongoose from "mongoose";
import { schemaOptions as opts } from "../schema-options.js";
const { Schema, model } = mongoose;
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
