import { z } from "zod";
import { canWrite, fail, id } from "../access.js";
import { Room, Message, Upload } from "../models.js";

export function registerMessagesEvents({ event, s, uid, io }) {
  event(
    "message:send",
    async (data, u) => {
      const d = z
        .object({
          room: z.string(),
          text: z.string().trim().max(2000).default(""),
          attachment: z.string().optional(),
        })
        .parse(data);
      const r = await canWrite(d.room, u);
      if (!d.text && !d.attachment) fail(400, "Write a message");
      if (d.attachment) {
        const a = await Upload.findById(id(d.attachment));
        if (!a || a.user !== uid || a.room !== d.room) fail(403, "Invalid attachment");
      }
      const m = await Message.create({
        ...d,
        user: uid,
        name: u.name,
        color: u.color,
      });
      await Room.updateOne({ _id: r._id }, { $set: { updatedAt: new Date() } });
      let target = io.to(d.room);
      if (r.kind === "dm")
        for (const member of r.members) target = target.to("user:" + member);
      target.emit("message", m.toJSON());
      return m.toJSON();
    },
    40,
  );
  event(
    "typing",
    async (data, u) => {
      await canWrite(data.room, u);
      s.to(data.room).emit("typing", {
        room: data.room,
        user: uid,
        name: u.name,
      });
    },
    120,
  );
}
