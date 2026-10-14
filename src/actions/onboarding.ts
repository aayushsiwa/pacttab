"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

export type OnboardingResult = { success: true } | { success: false; error: string };

export async function completeOnboardingAction(formData: FormData): Promise<OnboardingResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const parsed = usernameSchema.safeParse(formData.get("username"));
  if (!parsed.success) return { success: false, error: "Invalid username" };

  const username = parsed.data.toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing && existing.id !== user.id) return { success: false, error: "username-taken" };

  await db
    .update(users)
    .set({ username, name: username, needsUsername: false, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return { success: true };
}
