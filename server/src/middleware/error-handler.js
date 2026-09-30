import multer from "multer";
export const errorHandler = (err, req, res, _next) => {
  if (err.name === "ZodError")
    return res.status(400).json({ error: err.issues[0]?.message || "Invalid input" });
  if (err.code === 11000)
    return res.status(409).json({ error: "That username is already taken" });
  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(413).json({ error: "File must be under 10 MB" });
  const status = err.status || (err instanceof multer.MulterError ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status < 500 ? err.message : "Service unavailable. Please try again.",
  });
};
