import mongoose from "mongoose";
import { User } from "./models.js";
const handle = process.argv[2];
if (!handle) {
  console.error("Usage: npm run admin -w server -- username");
  process.exit(1);
}
await mongoose.connect(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/circle",
);
const u = await User.findOneAndUpdate(
  { handle, guest: false },
  { $set: { role: "admin" } },
  { new: true },
);
console.log(
  u
    ? "Administrator role granted to " + u.handle
    : "No registered account found",
);
await mongoose.disconnect();
if (!u) process.exitCode = 1;
