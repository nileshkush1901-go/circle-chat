import { z } from "zod";
export const name = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(/^[\p{L}\p{N}_ .-]+$/u, "Use letters, numbers, spaces, dots or dashes");
export const credentials = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/),
  password: z.string().min(10).max(128),
});
