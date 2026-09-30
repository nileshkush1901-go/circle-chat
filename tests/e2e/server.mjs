import { createServer } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { makeApp } from "../../server/src/app.js";
import { attachRealtime } from "../../server/src/realtime.js";
import { seedRooms } from "../../server/src/seed.js";
const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri(), { dbName: "circle_e2e" });
await seedRooms();
const config = { origin: "http://127.0.0.1:4300" };
const app = makeApp(config);
const server = createServer(app);
const io = attachRealtime(server, app, config);
server.listen(4300, "127.0.0.1");
async function stop() {
  io.close();
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
