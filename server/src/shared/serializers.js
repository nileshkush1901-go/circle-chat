export const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  color: u.color,
  bio: u.bio,
  guest: u.guest,
  role: u.role,
});
export const ownUser = (u) => ({ ...publicUser(u), blocked: u.blocked });
export const roomView = (r, u) => {
  const v = r.toJSON();
  delete v.banned;
  delete v.pair;
  if (v.owner !== String(u._id)) delete v.invite;
  delete v.board;
  delete v.watch;
  return v;
};
