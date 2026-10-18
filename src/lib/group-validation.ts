import { z } from "zod";

export const groupDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Group name is required")
    .max(100, "Group name must be 100 characters or fewer"),
  description: z.string().trim().max(500, "Description must be 500 characters or fewer").nullish(),
});

export const directInviteSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be 50 characters or fewer")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
});
