import { loadConfig } from "./config/environment.js";
import mongoose from "mongoose";
import { createServer } from "node:http";
import { makeApp } from "./app.js";
import { attachRealtime } from "./realtime.js";
import { seedRooms } from "./seed.js";
const config = loadConfig();
const port = config.port;
await mongoose.connect(config.mongodbUri);
await seedRooms();
const app = makeApp(config),
  http = createServer(app);
const io = attachRealtime(http, app, config);
http.listen(port, "0.0.0.0", () => console.log(`Circle server listening on ${port}`));
async function stop() {
  io.close();
  http.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
