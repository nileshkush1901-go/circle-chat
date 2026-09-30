import { canRead } from "../access.js";
import { Room, roomView } from "../models.js";

export function registerRoomsEvents({ event, s, uid, presence }) {
  event("room:join", async (data, u) => {
    const r = await canRead(data.room, u);
    await Room.updateOne({ _id: r._id }, { $addToSet: { members: uid } });
    const previous = s.data.activeRoom;
    if (previous) {
      s.leave(previous);
      presence(previous);
    }
    s.join(String(r._id));
    s.data.activeRoom = String(r._id);
    presence(String(r._id));
    return roomView(await Room.findById(r._id), u);
  });
}
