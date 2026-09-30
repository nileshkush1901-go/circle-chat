import mongoose from "mongoose";
import { createServer } from "node:http";
import { makeApp } from "./app.js";
import { attachRealtime } from "./realtime.js";
import { seedRooms } from "./seed.js";
const port = Number(process.env.PORT || 3000);
await mongoose.connect(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/circle",
);
await seedRooms();
const config = {
  origin: process.env.APP_ORIGIN || "http://localhost:4200",
  production: process.env.NODE_ENV === "production",
  uploadDir: process.env.UPLOAD_DIR,
};
const app = makeApp(config),
  http = createServer(app);
const io = attachRealtime(http, app, config);
http.listen(port, "0.0.0.0", () =>
  console.log(`Circle server listening on ${port}`),
);
async function stop() {
  io.close();
  http.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
