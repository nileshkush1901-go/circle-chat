import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { io as client } from "socket.io-client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { makeApp } from "../src/app.js";
import { attachRealtime } from "../src/realtime.js";
import { User, Session, Room } from "../src/models.js";
import { seedRooms } from "../src/seed.js";
let mongo, http, app, io, base, dir;
const sockets = [];
const req = () => request(app);
const auth = (cookie) => ({ Cookie: cookie, "X-Circle-Request": "1" });
async function guest(name) {
  const r = await req()
    .post("/api/auth/guest")
    .set("X-Circle-Request", "1")
    .send({ name });
  assert.equal(r.status, 201, r.text);
  return { user: r.body, cookie: r.headers["set-cookie"][0].split(";")[0] };
}
async function socket(cookie) {
  const s = client(base, {
    extraHeaders: { Cookie: cookie },
    transports: ["websocket"],
    forceNew: true,
  });
  sockets.push(s);
  await new Promise((resolve, reject) => {
    s.once("connect", resolve);
    s.once("connect_error", reject);
  });
  return s;
}
const emit = (s, event, data = {}) =>
  new Promise((resolve, reject) =>
    s
      .timeout(5000)
      .emit(event, data, (err, r) => (err ? reject(err) : resolve(r))),
  );
const event = (s, name) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Timed out: " + name)), 5000);
    s.once(name, (d) => {
      clearTimeout(timer);
      resolve(d);
    });
  });
before(async () => {
  if (!process.env.MONGODB_TEST_URI) mongo = await MongoMemoryServer.create();
  await mongoose.connect(process.env.MONGODB_TEST_URI || mongo.getUri(), {
    dbName: "circle_test_" + Date.now(),
  });
  await Promise.all([User.init(), Session.init(), Room.init()]);
  await seedRooms();
  dir = await mkdtemp(path.join(tmpdir(), "circle-tests-"));
  app = makeApp({ uploadDir: dir });
  http = createServer(app);
  io = attachRealtime(http, app);
  await new Promise((r) => http.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + http.address().port;
});
after(async () => {
  for (const s of sockets) s.disconnect();
  await new Promise((r) => io?.close(r));
  if (mongoose.connection.readyState === 1)
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongo?.stop();
  if (dir) await rm(dir, { recursive: true, force: true });
});
test("authentication, durable room messages, two-user realtime delivery and logout revocation", async () => {
  const a = await guest("Alice"),
    b = await guest("Bob");
  const sa = await socket(a.cookie),
    sb = await socket(b.cookie);
  const rooms = await req().get("/api/rooms").set(auth(a.cookie));
  assert.equal(rooms.body.length, 6);
  const room = rooms.body[0].id;
  assert.equal((await emit(sa, "room:join", { room })).ok, true);
  await emit(sb, "room:join", { room });
  const delivered = event(sb, "message");
  const sent = await emit(sa, "message:send", {
    room,
    text: "Hello Bob <script>alert(1)</script>",
  });
  assert.equal(sent.ok, true);
  assert.equal((await delivered).text, "Hello Bob <script>alert(1)</script>");
  const history = await req()
    .get("/api/rooms/" + room + "/messages")
    .set(auth(b.cookie));
  assert.equal(history.body.at(-1).id, sent.data.id);
  const unauthorized = await req()
    .delete("/api/messages/" + sent.data.id)
    .set(auth(b.cookie));
  assert.equal(unauthorized.status, 403);
  await req().post("/api/auth/logout").set(auth(a.cookie)).send({});
  const me = await req().get("/api/me").set(auth(a.cookie));
  assert.equal(me.status, 401);
});
test("registration, login, uniqueness, HttpOnly cookie and origin checks", async () => {
  const body = {
    name: "Registered",
    handle: "registered",
    password: "long-test-password",
  };
  const r = await req()
    .post("/api/auth/register")
    .set("X-Circle-Request", "1")
    .send(body);
  assert.equal(r.status, 201, r.text);
  assert.ok(r.headers["set-cookie"][0].includes("HttpOnly"));
  const duplicate = await req()
    .post("/api/auth/register")
    .set("X-Circle-Request", "1")
    .send(body);
  assert.equal(duplicate.status, 409);
  const bad = await req()
    .post("/api/auth/login")
    .set("X-Circle-Request", "1")
    .send({ ...body, password: "wrong-password" });
  assert.equal(bad.status, 401);
  const login = await req()
    .post("/api/auth/login")
    .set("X-Circle-Request", "1")
    .send(body);
  assert.equal(login.status, 200);
  assert.equal(login.body.guest, false);
  const csrf = await req()
    .post("/api/auth/guest")
    .set("Origin", "https://evil.example")
    .set("X-Circle-Request", "1")
    .send({ name: "Bad" });
  assert.equal(csrf.status, 403);
});
test("private room isolation, invite join, owner moderation and upload authorization", async () => {
  const a = await guest("Owner"),
    b = await guest("Visitor");
  const created = await req()
    .post("/api/rooms")
    .set(auth(a.cookie))
    .send({
      name: "Private test",
      description: "Members only",
      category: "General",
      private: true,
    });
  assert.equal(created.status, 201, created.text);
  const r = created.body;
  const strangerList = await req().get("/api/rooms").set(auth(b.cookie));
  assert.ok(!strangerList.body.some((x) => x.id === r.id));
  assert.equal(
    (
      await req()
        .get("/api/rooms/" + r.id + "/messages")
        .set(auth(b.cookie))
    ).status,
    403,
  );
  const sb = await socket(b.cookie);
  assert.equal((await emit(sb, "room:join", { room: r.id })).ok, false);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1kAAAAASUVORK5CYII=",
    "base64",
  );
  const upload = await req()
    .post("/api/rooms/" + r.id + "/uploads")
    .set(auth(a.cookie))
    .attach("file", png, "test.png");
  assert.equal(upload.status, 201, upload.text);
  assert.equal(
    (
      await req()
        .get("/api/uploads/" + upload.body.id)
        .set(auth(b.cookie))
    ).status,
    403,
  );
  const join = await req()
    .post("/api/invites/" + r.invite)
    .set(auth(b.cookie))
    .send({});
  assert.equal(join.status, 200);
  assert.equal(
    (
      await req()
        .get("/api/uploads/" + upload.body.id)
        .set(auth(b.cookie))
    ).status,
    200,
  );
  await emit(sb, "room:join", { room: r.id });
  const stolen = await emit(sb, "message:send", {
    room: r.id,
    text: "stolen",
    attachment: upload.body.id,
  });
  assert.equal(stolen.ok, false);
  const ban = await req()
    .post("/api/rooms/" + r.id + "/ban")
    .set(auth(a.cookie))
    .send({ user: b.user.id });
  assert.equal(ban.status, 200);
  assert.equal(
    (await emit(sb, "message:send", { room: r.id, text: "Blocked" })).ok,
    false,
  );
});
test("direct messages, blocking and random matching require real peers", async () => {
  const a = await guest("RandomOne"),
    b = await guest("RandomTwo"),
    c = await guest("Observer");
  const sa = await socket(a.cookie),
    sb = await socket(b.cookie);
  assert.equal((await emit(sa, "random:start")).data.waiting, true);
  const match = event(sa, "random:matched");
  await emit(sb, "random:start");
  const room = await match;
  assert.equal(room.peer.id, b.user.id);
  assert.equal(
    (
      await req()
        .get("/api/rooms/" + room.id + "/messages")
        .set(auth(c.cookie))
    ).status,
    403,
  );
  await emit(sa, "room:join", { room: room.id });
  assert.equal(
    (await emit(sa, "message:send", { room: room.id, text: "Private hello" }))
      .ok,
    true,
  );
  await req()
    .post("/api/block/" + a.user.id)
    .set(auth(b.cookie))
    .send({});
  assert.equal(
    (await emit(sa, "message:send", { room: room.id, text: "Cannot send" })).ok,
    false,
  );
  assert.equal(
    (await emit(sa, "call:invite", { room: room.id, video: false })).ok,
    false,
  );
});
test("shared whiteboard persistence and reports limited to admins", async () => {
  const a = await guest("Artist");
  const sa = await socket(a.cookie);
  const rooms = await req().get("/api/rooms").set(auth(a.cookie));
  const room = rooms.body[0].id;
  await emit(sa, "room:join", { room });
  assert.equal(
    (
      await emit(sa, "board:stroke", {
        room,
        color: "#6750e8",
        points: [
          [0, 0],
          [1, 1],
        ],
      })
    ).ok,
    true,
  );
  const activity = await req()
    .get("/api/rooms/" + room + "/activity")
    .set(auth(a.cookie));
  assert.equal(activity.body.board.length, 1);
  const m = await emit(sa, "message:send", { room, text: "Report this test" });
  assert.equal(
    (
      await req()
        .post("/api/reports")
        .set(auth(a.cookie))
        .send({ message: m.data.id, reason: "Integration test report" })
    ).status,
    201,
  );
  assert.equal(
    (await req().get("/api/admin/reports").set(auth(a.cookie))).status,
    403,
  );
  await User.updateOne({ _id: a.user.id }, { $set: { role: "admin" } });
  const reports = await req().get("/api/admin/reports").set(auth(a.cookie));
  assert.equal(reports.status, 200);
  assert.equal(reports.body.length, 1);
});
