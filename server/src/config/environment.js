import { z } from "zod";
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(?:\+srv)?:\/\//)
    .optional(),
  APP_ORIGIN: z.string().url().optional(),
  RENDER_EXTERNAL_URL: z.string().url().optional(),
  UPLOAD_DIR: z.string().min(1).optional(),
});
/** Validate configuration once at startup; never include secret values in errors. */
export function loadConfig(environment = process.env) {
  const result = schema.safeParse(environment);
  if (!result.success) {
    throw new Error(
      "Invalid environment variables: " +
        result.error.issues.map((issue) => issue.path.join(".")).join(", "),
    );
  }
  const env = result.data;
  if (env.NODE_ENV === "production" && !env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required in production");
  }
  const origin = env.APP_ORIGIN || env.RENDER_EXTERNAL_URL || "http://localhost:4200";
  const url = new URL(origin);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "APP_ORIGIN must be an HTTP(S) origin without credentials, path, query, or fragment",
    );
  }
  return Object.freeze({
    port: env.PORT,
    mongodbUri: env.MONGODB_URI || "mongodb://127.0.0.1:27017/circle",
    origin: url.origin,
    production: env.NODE_ENV === "production",
    uploadDir: env.UPLOAD_DIR,
  });
}
