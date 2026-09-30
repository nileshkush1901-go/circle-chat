export const schemaOptions = {
  timestamps: true,
  toJSON: {
    transform: (_d, r) => {
      r.id = String(r._id);
      delete r._id;
      delete r.__v;
      return r;
    },
  },
};
