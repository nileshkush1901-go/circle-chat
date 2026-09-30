import { z } from "zod";
import { canWrite, fail } from "../access.js";
import { publicUser } from "../models.js";

export function registerCallsEvents({ event, uid, io, calls, online, terminate }) {
  event(
    "call:invite",
    async (data, u) => {
      const d = z.object({ room: z.string(), video: z.boolean() }).parse(data);
      const r = await canWrite(d.room, u);
      if (r.kind !== "dm") fail(400, "Calls are available in direct messages");
      const peer = r.members.find((x) => x !== uid);
      if (!online(peer)) fail(400, "This person is offline");
      if (calls.has(uid) || calls.has(peer)) fail(409, "Someone is already in a call");
      const c = {
        a: uid,
        b: peer,
        room: d.room,
        video: d.video,
        accepted: false,
        at: Date.now(),
      };
      calls.set(uid, c);
      calls.set(peer, c);
      io.to("user:" + peer).emit("call:incoming", {
        from: publicUser(u),
        room: d.room,
        video: d.video,
      });
      return { ringing: true };
    },
    8,
  );
  event("call:respond", async (data, u) => {
    const c = calls.get(uid);
    if (!c || c.b !== uid) fail(400, "No incoming call");
    await canWrite(c.room, u);
    if (data.accept === true) {
      c.accepted = true;
      io.to("user:" + c.a).emit("call:accepted", {
        room: c.room,
        video: c.video,
      });
      return { accepted: true };
    }
    terminate(uid);
    return {};
  });
  event(
    "call:signal",
    async (data, u) => {
      const c = calls.get(uid);
      if (!c || !c.accepted) fail(403, "No accepted call");
      await canWrite(c.room, u);
      const d = z
        .object({
          signal: z.union([
            z.object({
              type: z.enum(["offer", "answer"]),
              sdp: z.string().max(60000),
            }),
            z.object({ candidate: z.any() }),
          ]),
        })
        .parse(data);
      io.to("user:" + (c.a === uid ? c.b : c.a)).emit("call:signal", d);
    },
    200,
  );
  event("call:end", async () => {
    terminate(uid);
    return {};
  });
}
