import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config/environment.js";
test("configuration defaults support local development", () => {
  assert.equal(loadConfig({}).port, 3000);
  assert.equal(loadConfig({}).origin, "http://localhost:4200");
});
test("production requires a database and rejects invalid ports without leaking secrets", () => {
  assert.throws(() => loadConfig({ NODE_ENV: "production" }), /MONGODB_URI/);
  assert.throws(
    () => loadConfig({ PORT: "invalid", MONGODB_URI: "secret" }),
    (error) => !error.message.includes("secret"),
  );
});
test("Render origin fallback is normalized; invalid origins rejected", () => {
  assert.equal(
    loadConfig({ RENDER_EXTERNAL_URL: "https://circle.example/" }).origin,
    "https://circle.example",
  );
  assert.throws(
    () => loadConfig({ APP_ORIGIN: "https://circle.example/path" }),
    /APP_ORIGIN/,
  );
});
