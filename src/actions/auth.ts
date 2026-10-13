"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { betterAuthInstance } from "@/lib/auth";
import { requireUser } from "@/lib/auth";

const UsernameSchema = z.object({
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

export async function signUpAction(
  prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const rawUsername = formData.get("username");
  const rawPassword = formData.get("password");
  const rawConfirmPassword = formData.get("confirmPassword");
  const rawReturnTo = formData.get("returnTo");

  const usernameStr = typeof rawUsername === "string" ? rawUsername : "";

  if (rawConfirmPassword !== null) {
    if (typeof rawConfirmPassword !== "string" || !rawConfirmPassword) {
      return { error: "Please confirm your password.", username: usernameStr };
    }
    if (rawPassword !== rawConfirmPassword) {
      return { error: "Passwords do not match.", username: usernameStr };
    }
  }

  const validation = UsernameSchema.safeParse({ username: rawUsername, password: rawPassword });

  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid input", username: usernameStr };
  }

  try {
    const email = `${validation.data.username.toLowerCase()}@pacttab.local`;
    await betterAuthInstance.api.signUpEmail({
      body: {
        email,
        password: validation.data.password,
        name: validation.data.username,
        username: validation.data.username.toLowerCase(),
      },
    });
  } catch (error: unknown) {
    const err = error as {
      body?: { message?: string };
      status?: number | string;
      statusCode?: number;
    };
    const status =
      typeof err.status === "number"
        ? err.status
        : typeof err.status === "string"
          ? err.status === "UNPROCESSABLE_ENTITY"
            ? 422
            : err.status === "BAD_REQUEST"
              ? 400
              : err.status === "UNAUTHORIZED"
                ? 401
                : parseInt(err.status) || 0
          : err.statusCode || 0;
    if (
      (status === 400 || status === 422) &&
      (err.body?.message?.includes("username") ||
        err.body?.message?.includes("already exists") ||
        err.body?.message?.includes("already taken"))
    ) {
      return { error: "Username is already taken.", username: usernameStr };
    }
    console.error("Sign up error:", error);
    return { error: "Failed to create account.", username: usernameStr };
  }

  const returnToStr =
    typeof rawReturnTo === "string" && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/groups";

  redirect(returnToStr);
}

export async function signInAction(
  prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const rawUsername = formData.get("username");
  const rawPassword = formData.get("password");
  const rawReturnTo = formData.get("returnTo");

  const usernameStr = typeof rawUsername === "string" ? rawUsername : "";

  const validation = UsernameSchema.safeParse({ username: rawUsername, password: rawPassword });

  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid input", username: usernameStr };
  }

  try {
    await betterAuthInstance.api.signInUsername({
      body: {
        username: validation.data.username.toLowerCase(),
        password: validation.data.password,
      },
    });
  } catch (error: unknown) {
    const err = error as { body?: { message?: string }; status?: number };
    if (err.status === 401) {
      return { error: "Invalid username or password.", username: usernameStr };
    }
    console.error("Sign in error:", error);
    return { error: "Failed to sign in.", username: usernameStr };
  }

  const returnToStr =
    typeof rawReturnTo === "string" && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/groups";

  redirect(returnToStr);
}

export async function signOutAction(): Promise<void> {
  await betterAuthInstance.api.signOut({ headers: new Headers() });
  redirect("/login");
}

export async function deleteAccountAction(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  await requireUser();
  const password = formData.get("password") as string;

  if (!password) {
    return { success: false, error: "Password is required to delete your account" };
  }

  try {
    await betterAuthInstance.api.deleteUser({
      body: { password },
      headers: new Headers(),
    });
  } catch (error: unknown) {
    const err = error as { body?: { message?: string }; status?: number };
    if (err.status === 401) {
      return { success: false, error: "Incorrect password." };
    }
    console.error("Failed to delete account:", error);
    return { success: false, error: "Failed to delete account." };
  }

  redirect("/login");
}
