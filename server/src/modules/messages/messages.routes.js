import { Message } from "../../models.js";
import { canRead, canModerate, fail, id } from "../../access.js";
import { Router } from "express";

export function createMessagesRouter() {
  const router = Router();
  router.delete("/messages/:id", async (req, res) => {
    const m = await Message.findById(id(req.params.id));
    if (!m) fail(404, "Message not found");
    const r = await canRead(m.room, req.user);
    if (m.user !== String(req.user._id) && !canModerate(r, req.user))
      fail(403, "Permission denied");
    m.text = "Message removed";
    m.attachment = undefined;
    m.deleted = true;
    await m.save();
    req.app.locals.io.to(m.room).emit("message:updated", m.toJSON());
    res.json(m);
  });

  return router;
}
