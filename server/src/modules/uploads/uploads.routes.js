import rateLimit from "express-rate-limit";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { Upload } from "../../models.js";
import { canRead, canWrite, fail, id } from "../../access.js";
import { Router } from "express";

export function createUploadsRouter({ uploadDir }) {
  const router = Router();
  const uploadLimit = rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });
  router.post(
    "/rooms/:id/uploads",
    uploadLimit,
    async (req, res, next) => {
      await canWrite(req.params.id, req.user);
      next();
    },
    upload.single("file"),
    async (req, res) => {
      if (!req.file) fail(400, "Choose a file");
      const type = await fileTypeFromBuffer(req.file.buffer);
      if (
        !type ||
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/webm",
          "audio/mpeg",
          "audio/ogg",
          "audio/wav",
        ].includes(type.mime)
      )
        fail(400, "Use JPG, PNG, WebP, GIF, MP4, WebM, MP3, OGG or WAV");
      await mkdir(uploadDir, { recursive: true });
      const filename = randomBytes(20).toString("hex") + "." + type.ext;
      await writeFile(path.join(uploadDir, filename), req.file.buffer);
      let u;
      try {
        u = await Upload.create({
          user: String(req.user._id),
          room: req.params.id,
          path: filename,
          mime: type.mime,
          name: req.file.originalname.slice(0, 120),
          size: req.file.size,
        });
      } catch (e) {
        await unlink(path.join(uploadDir, filename));
        throw e;
      }
      res.status(201).json({ id: String(u._id), name: u.name, mime: u.mime });
    },
  );
  router.get("/uploads/:id", async (req, res) => {
    const u = await Upload.findById(id(req.params.id));
    if (!u) fail(404, "File not found");
    await canRead(u.room, req.user);
    if (req.user.blocked.includes(u.user)) fail(403, "Content blocked");
    res.set("Content-Type", u.mime).set("Cache-Control", "private, no-store");
    res.sendFile(path.join(uploadDir, u.path));
  });
  router.get("/uploads/:id/info", async (req, res) => {
    const u = await Upload.findById(id(req.params.id));
    if (!u) fail(404, "File not found");
    await canRead(u.room, req.user);
    res.json({ id: String(u._id), name: u.name, mime: u.mime });
  });

  return router;
}
