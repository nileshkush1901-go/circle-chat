import express from "express";
import path from "node:path";
import { configureSecurity } from "./middleware/security.js";
import { requireAuth } from "./middleware/require-auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createUsersRouter } from "./modules/users/users.routes.js";
import { createRoomsRouter } from "./modules/rooms/rooms.routes.js";
import { createMessagesRouter } from "./modules/messages/messages.routes.js";
import { createConversationsRouter } from "./modules/conversations/conversations.routes.js";
import { createUploadsRouter } from "./modules/uploads/uploads.routes.js";
import { createModerationRouter } from "./modules/moderation/moderation.routes.js";
/** Composition root: transport middleware, public routes, authentication, features, frontend. */
export function makeApp({
  origin = "http://localhost:4200",
  production = false,
  uploadDir = path.resolve("uploads"),
} = {}) {
  const app = express();
  const config = { origin, production, uploadDir };
  app.locals.uploadDir = uploadDir;
  configureSecurity(app, config);
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", createAuthRouter(config));
  app.use("/api", requireAuth);
  app.use("/api", createUsersRouter(config));
  app.use("/api", createRoomsRouter(config));
  app.use("/api", createMessagesRouter(config));
  app.use("/api", createConversationsRouter(config));
  app.use("/api", createUploadsRouter(config));
  app.use("/api", createModerationRouter(config));
  app.get("/api/rtc-config", (_req, res) =>
    res.json({
      iceServers: JSON.parse(
        process.env.ICE_SERVERS || '[{"urls":"stun:stun.l.google.com:19302"}]',
      ),
    }),
  );
  app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint not found" }));
  const dist = path.resolve(import.meta.dirname, "../../client/dist/browser");
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) => res.sendFile(path.join(dist, "index.html")));

  app.use(errorHandler);
  return app;
}
