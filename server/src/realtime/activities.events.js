import { z } from "zod";
import { canWrite, fail, id } from "../access.js";
import { Room, Upload } from "../models.js";

export function registerActivitiesEvents({ event, uid, io }) {
  event(
    "board:stroke",
    async (data, u) => {
      const d = z
        .object({
          room: z.string(),
          color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
          points: z
            .array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]))
            .min(2)
            .max(500),
        })
        .parse(data);
      await canWrite(d.room, u);
      const stroke = { color: d.color, points: d.points };
      await Room.updateOne(
        { _id: d.room },
        { $push: { board: { $each: [stroke], $slice: -500 } } },
      );
      io.to(d.room).emit("board:stroke", { room: d.room, stroke });
    },
    100,
  );
  event("board:clear", async (data, u) => {
    const r = await canWrite(data.room, u);
    if (r.owner !== uid && u.role !== "admin")
      fail(403, "Only the room owner can clear the board");
    await Room.updateOne({ _id: r._id }, { $set: { board: [] } });
    io.to(data.room).emit("board:clear", { room: data.room });
  });
  event("watch:update", async (data, u) => {
    const d = z
      .object({
        room: z.string(),
        attachment: z.string(),
        playing: z.boolean(),
        time: z.number().min(0).max(86400),
      })
      .parse(data);
    await canWrite(d.room, u);
    const a = await Upload.findById(id(d.attachment));
    if (!a || a.room !== d.room || !a.mime.startsWith("video/"))
      fail(400, "Choose a video uploaded to this room");
    const watch = {
      attachment: d.attachment,
      playing: d.playing,
      time: d.time,
      at: Date.now(),
    };
    await Room.updateOne({ _id: d.room }, { $set: { watch } });
    io.to(d.room).emit("watch:update", { room: d.room, watch });
  });
}
