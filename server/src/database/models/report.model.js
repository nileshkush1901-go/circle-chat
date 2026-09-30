import mongoose from "mongoose";
import { schemaOptions as opts } from "../schema-options.js";
const { Schema, model } = mongoose;
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
