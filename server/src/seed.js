import { Room } from "./models.js";
export async function seedRooms() {
  for (const [name, category, description] of [
    ["The Lobby", "General", "A little hello can start a great conversation."],
    [
      "Music Lounge",
      "Music",
      "New finds, old favourites, and everything on repeat.",
    ],
    [
      "Game Night",
      "Gaming",
      "Find your next teammate. Share what you are playing.",
    ],
    [
      "Language Exchange",
      "Learning",
      "Learn a little. Teach a little. Talk to the world.",
    ],
    ["Movie Club", "Movies", "From the opening scene to the end credits."],
    ["Wanderers", "Travel", "Stories and discoveries from around the world."],
  ])
    await Room.updateOne(
      { name, owner: "system" },
      {
        $setOnInsert: {
          name,
          category,
          description,
          owner: "system",
          members: [],
          private: false,
          kind: "room",
        },
      },
      { upsert: true },
    );
}
