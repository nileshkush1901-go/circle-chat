import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import {
  hashPassword,
  checkPassword,
  hashToken,
  authenticate,
  cookieToken,
} from "../src/auth.js";
import { id, canModerate } from "../src/access.js";
import { makeApp } from "../src/app.js";
const app = makeApp();
test("passwords are salted and verified with scrypt", async () => {
  const first = await hashPassword("my-long-test-password"),
    second = await hashPassword("my-long-test-password");
  assert.notEqual(first, second);
  assert.equal(await checkPassword("my-long-test-password", first), true);
  assert.equal(await checkPassword("not-my-password", first), false);
  assert.equal(await checkPassword("anything", undefined), false);
});
test("session parsing, hashing and malformed-token rejection", async () => {
  assert.equal(cookieToken("one=a; circle_session=abcd; other=b"), "abcd");
  assert.equal(cookieToken("other=b"), undefined);
  assert.equal(hashToken("session").length, 64);
  assert.notEqual(hashToken("one"), hashToken("two"));
  assert.equal(await authenticate("invalid-token"), null);
});
test("malformed object IDs rejected; moderator rights not inferred from membership", () => {
  assert.throws(() => id("not-valid"), /Invalid ID/);
  assert.equal(canModerate({ owner: "owner" }, { _id: "someone", role: "user" }), false);
  assert.equal(canModerate({ owner: "owner" }, { _id: "owner", role: "user" }), true);
  assert.equal(canModerate({ owner: "owner" }, { _id: "other", role: "admin" }), true);
});
test("health endpoint and baseline security headers", async () => {
  const r = await request(app).get("/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.headers["x-content-type-options"], "nosniff");
  assert.match(r.headers["content-security-policy"], /frame-src 'none'/);
  assert.equal(r.headers["x-powered-by"], undefined);
});
test("cross-origin writes and writes without custom header rejected", async () => {
  let r = await request(app).post("/api/auth/guest").send({ name: "Test" });
  assert.equal(r.status, 403);
  r = await request(app)
    .post("/api/auth/guest")
    .set("X-Circle-Request", "1")
    .set("Origin", "https://unexpected.example")
    .send({ name: "Test" });
  assert.equal(r.status, 403);
});
test("anonymous access and invalid nicknames rejected", async () => {
  let r = await request(app).get("/api/rooms");
  assert.equal(r.status, 401);
  r = await request(app)
    .post("/api/auth/guest")
    .set("X-Circle-Request", "1")
    .send({ name: "<script>" });
  assert.equal(r.status, 400);
});
