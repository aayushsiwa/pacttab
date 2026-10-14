import { z } from "zod";
import { betterAuthInstance } from "@/lib/auth";

const UsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type AuthActionResult =
  { ok: true; username?: string } | { ok: false; error: string; username?: string };

function parseErrorStatus(err: { status?: number | string; statusCode?: number }): number {
  if (typeof err.status === "number") return err.status;
  if (typeof err.status === "string") {
    if (err.status === "UNPROCESSABLE_ENTITY") return 422;
    if (err.status === "BAD_REQUEST") return 400;
    if (err.status === "UNAUTHORIZED") return 401;
    return parseInt(err.status) || 0;
  }
  return err.statusCode || 0;
}

function isDuplicateUsernameError(err: { body?: { message?: string } }): boolean {
  const msg = err.body?.message?.toLowerCase() || "";
  return (
    msg.includes("username") && (msg.includes("already exists") || msg.includes("already taken"))
  );
}

export async function signUpUser(
  input: { username: string; password: string; confirmPassword?: string },
  requestHeaders?: Headers
): Promise<AuthActionResult> {
  if (input.confirmPassword !== undefined) {
    if (!input.confirmPassword) {
      return { ok: false, error: "Please confirm your password.", username: input.username };
    }
    if (input.password !== input.confirmPassword) {
      return { ok: false, error: "Passwords do not match.", username: input.username };
    }
  }

  const validation = UsernameSchema.safeParse({
    username: input.username,
    password: input.password,
  });
  if (!validation.success) {
    return {
      ok: false,
      error: validation.error.issues[0]?.message || "Invalid input",
      username: input.username,
    };
  }

  try {
    const email = `${validation.data.username.toLowerCase()}@pacttab.local`;
    await betterAuthInstance.api.signUpEmail({
      headers: requestHeaders ?? new Headers(),
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
    const status = parseErrorStatus(err);
    if ((status === 400 || status === 422) && isDuplicateUsernameError(err)) {
      return { ok: false, error: "Username is already taken.", username: input.username };
    }
    console.error("Sign up error:", error);
    return { ok: false, error: "Failed to create account.", username: input.username };
  }

  return { ok: true, username: input.username.toLowerCase() };
}

export async function signInUser(
  input: { username: string; password: string },
  requestHeaders?: Headers
): Promise<AuthActionResult> {
  const validation = UsernameSchema.safeParse(input);
  if (!validation.success) {
    return {
      ok: false,
      error: validation.error.issues[0]?.message || "Invalid input",
      username: input.username,
    };
  }

  try {
    await betterAuthInstance.api.signInUsername({
      headers: requestHeaders ?? new Headers(),
      body: {
        username: validation.data.username.toLowerCase(),
        password: validation.data.password,
      },
    });
  } catch (error: unknown) {
    const err = error as { body?: { message?: string }; status?: number };
    if (err.status === 401) {
      return { ok: false, error: "Invalid username or password.", username: input.username };
    }
    console.error("Sign in error:", error);
    return { ok: false, error: "Failed to sign in.", username: input.username };
  }

  return { ok: true, username: input.username.toLowerCase() };
}

export async function signOutUser(requestHeaders?: Headers): Promise<AuthActionResult> {
  await betterAuthInstance.api.signOut({ headers: requestHeaders ?? new Headers() });
  return { ok: true };
}

export async function deleteUserAccount(
  input: { password: string },
  requestHeaders?: Headers
): Promise<AuthActionResult> {
  try {
    await betterAuthInstance.api.deleteUser({
      headers: requestHeaders ?? new Headers(),
      body: { password: input.password },
    });
  } catch (error: unknown) {
    const err = error as { body?: { message?: string }; status?: number };
    if (err.status === 401) {
      return { ok: false, error: "Incorrect password." };
    }
    console.error("Failed to delete account:", error);
    return { ok: false, error: "Failed to delete account." };
  }
  return { ok: true };
}
