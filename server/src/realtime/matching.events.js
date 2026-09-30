import { id } from "../access.js";
import { User, Room, publicUser, roomView } from "../models.js";

export function registerMatchingEvents({ event, s, uid, io, waiting }) {
  event(
    "random:start",
    async (_data, u) => {
      waiting.delete(uid);
      for (const [other, sid] of waiting) {
        const socket = io.sockets.sockets.get(sid);
        const peer = await User.findById(other);
        if (!socket || !peer || peer.banned) {
          waiting.delete(other);
          continue;
        }
        if (
          other === uid ||
          u.blocked.includes(other) ||
          peer.blocked.includes(uid) ||
          waiting.get(other) !== sid
        )
          continue;
        waiting.delete(other);
        const members = [uid, other].sort();
        const r = await Room.findOneAndUpdate(
          { pair: members.join(":") },
          {
            $setOnInsert: {
              kind: "dm",
              private: true,
              name: "Random chat",
              members,
            },
          },
          { new: true, upsert: true },
        );
        s.emit("random:matched", {
          ...roomView(r, u),
          peer: publicUser(peer),
          name: peer.name,
        });
        socket.emit("random:matched", {
          ...roomView(r, peer),
          peer: publicUser(u),
          name: u.name,
        });
        return { matched: true };
      }
      waiting.set(uid, s.id);
      return { waiting: true };
    },
    20,
  );
  event("random:cancel", async () => {
    waiting.delete(uid);
    return { ok: true };
  });
}
