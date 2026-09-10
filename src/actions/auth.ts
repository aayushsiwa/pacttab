"use server";

import { z } from "zod";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword, createSession, deleteSession } from "@/lib/auth";

const AuthSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type AuthActionState = {
  error?: string;
  success?: boolean;
  username?: string;
};

export async function signUpAction(prevState: AuthActionState | null, formData: FormData): Promise<AuthActionState> {
  const rawUsername = formData.get("username");
  const rawPassword = formData.get("password");
  const rawConfirmPassword = formData.get("confirmPassword");
  const rawReturnTo = formData.get("returnTo");

  const usernameStr = typeof rawUsername === "string" ? rawUsername : "";

  // Validate confirmPassword if supplied in the form
  if (rawConfirmPassword !== null) {
    if (typeof rawConfirmPassword !== "string" || !rawConfirmPassword) {
      return {
        error: "Please confirm your password.",
        username: usernameStr,
      };
    }
    if (rawPassword !== rawConfirmPassword) {
      return {
        error: "Passwords do not match. Please ensure both passwords match.",
        username: usernameStr,
      };
    }
  }

  const validation = AuthSchema.safeParse({
    username: rawUsername,
    password: rawPassword,
  });

  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
      username: usernameStr,
    };
  }

  const normalizedUsername = validation.data.username.toLowerCase();

  // Check if username is already taken
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, normalizedUsername))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      error: "Username is already taken. Please choose another.",
      username: usernameStr,
    };
  }

  const passwordHash = await hashPassword(validation.data.password);
  const userId = crypto.randomUUID();

  try {
    await db.insert(users).values({
      id: userId,
      username: normalizedUsername,
      passwordHash,
    });

    await createSession(userId);
  } catch (error) {
    console.error("Sign up error:", error);
    return {
      error: "Failed to create account. Please try again.",
      username: usernameStr,
    };
  }

  const returnToStr =
    typeof rawReturnTo === "string" && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/groups";

  redirect(returnToStr);
}

export async function signInAction(prevState: AuthActionState | null, formData: FormData): Promise<AuthActionState> {
  const rawUsername = formData.get("username");
  const rawPassword = formData.get("password");
  const rawReturnTo = formData.get("returnTo");

  const usernameStr = typeof rawUsername === "string" ? rawUsername : "";

  const validation = AuthSchema.safeParse({
    username: rawUsername,
    password: rawPassword,
  });

  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
      username: usernameStr,
    };
  }

  const normalizedUsername = validation.data.username.toLowerCase();

  const matchedUsers = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.username, normalizedUsername))
    .limit(1);

  if (matchedUsers.length === 0) {
    return {
      error: "Invalid username or password.",
      username: usernameStr,
    };
  }

  const user = matchedUsers[0];
  const isValid = await verifyPassword(validation.data.password, user.passwordHash);

  if (!isValid) {
    return {
      error: "Invalid username or password.",
      username: usernameStr,
    };
  }

  try {
    await createSession(user.id);
  } catch (error) {
    console.error("Sign in error:", error);
    return {
      error: "Failed to sign in. Please try again.",
      username: usernameStr,
    };
  }

  const returnToStr =
    typeof rawReturnTo === "string" && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/groups";

  redirect(returnToStr);
}

export async function signOutAction(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
