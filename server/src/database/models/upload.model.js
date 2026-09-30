import mongoose from "mongoose";
import { schemaOptions as opts } from "../schema-options.js";
const { Schema, model } = mongoose;
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
