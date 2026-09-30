import { User, Room, publicUser, roomView } from "../../models.js";
import { fail, id } from "../../access.js";
import { Router } from "express";

export function createConversationsRouter() {
  const router = Router();
  router.get("/conversations", async (req, res) => {
    const rooms = await Room.find({ kind: "dm", members: String(req.user._id) })
      .sort({ updatedAt: -1 })
      .limit(100);
    const result = [];
    for (const r of rooms) {
      const other = await User.findById(
        r.members.find((x) => x !== String(req.user._id)),
      );
      if (
        other &&
        !req.user.blocked.includes(String(other._id)) &&
        !other.blocked.includes(String(req.user._id))
      )
        result.push({
          ...roomView(r, req.user),
          name: other.name,
          peer: publicUser(other),
        });
    }
    res.json(result);
  });
  router.post("/conversations", async (req, res) => {
    const other = await User.findById(id(req.body.user));
    const uid = String(req.user._id);
    if (!other || other.banned || String(other._id) === uid)
      fail(400, "Choose another user");
    if (req.user.blocked.includes(String(other._id)) || other.blocked.includes(uid))
      fail(403, "This conversation is blocked");
    const members = [uid, String(other._id)].sort();
    const r = await Room.findOneAndUpdate(
      { pair: members.join(":") },
      {
        $setOnInsert: {
          name: "Direct message",
          kind: "dm",
          private: true,
          members,
        },
      },
      { upsert: true, new: true },
    );
    res.json({
      ...roomView(r, req.user),
      name: other.name,
      peer: publicUser(other),
    });
  });

  return router;
}
