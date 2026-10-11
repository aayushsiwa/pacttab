"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
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

export async function completeOnboardingAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = usernameSchema.safeParse(formData.get("username"));
  if (!parsed.success) redirect("/onboarding?error=invalid-username");
  const username = parsed.data.toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existing && existing.id !== user.id) redirect("/onboarding?error=username-taken");
  await db
    .update(users)
    .set({ username, name: username, needsUsername: false, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  redirect("/groups");
}
