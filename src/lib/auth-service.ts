import { z } from "zod";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, directInvites, groupMembers, sessions, settlements, users } from "@/db/schema";
import { betterAuthInstance, verifyPassword } from "@/lib/auth";
import { getUserUnsettledGroups } from "@/lib/queries";
import type { ApiUser, ServiceResult } from "@/lib/api-auth";

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
  | { ok: true; username?: string }
  | { ok: false; error: string; username?: string };

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

/**
 * Stable, non-identifying label for an account that has been deleted. The user
 * row survives so every expense, split, settlement and membership that
 * references it keeps its history instead of cascading away. The full UUID
 * fragment keeps the label unique and impossible to collide with a handle a
 * member could register themselves.
 */
function tombstoneUsername(userId: string): string {
  return `deleted_${userId.replace(/-/g, "")}`;
}

class UnsettledBalancesError extends Error {
  constructor(readonly summary: string) {
    super("unsettled-balances");
  }
}

export async function deleteUserAccount(
  user: ApiUser,
  input: { password: string }
): Promise<ServiceResult> {
  try {
    const credentialAccount = await db
      .select({ password: accounts.password })
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")))
      .limit(1);

    const storedHash = credentialAccount[0]?.password;
    if (storedHash) {
      const passwordMatches = await verifyPassword(input.password, storedHash);
      if (!passwordMatches) {
        return { success: false, error: "Incorrect password.", status: 401 };
      }
    }

    await db.transaction(async (tx) => {
      // Lock the groups the member is active in, in a stable order, so the
      // balance check below cannot race a leave or a settlement confirmation.
      const activeGroups = await tx
        .select({ groupId: groupMembers.groupId })
        .from(groupMembers)
        .where(and(eq(groupMembers.userId, user.id), eq(groupMembers.status, "active")))
        .orderBy(asc(groupMembers.groupId));

      for (const group of activeGroups) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${group.groupId}))`);
      }

      const unsettled = await getUserUnsettledGroups(user.id, tx);
      if (unsettled.length > 0) {
        const summary = unsettled
          .map((g) => {
            const amount = Math.abs(g.netBalance).toFixed(2);
            return g.netBalance > 0
              ? `${g.groupName} (you are owed ₹${amount})`
              : `${g.groupName} (you owe ₹${amount})`;
          })
          .join(", ");
        throw new UnsettledBalancesError(summary);
      }

      await tx
        .update(groupMembers)
        .set({ status: "inactive" })
        .where(eq(groupMembers.userId, user.id));

      await tx
        .update(settlements)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(settlements.status, "pending"),
            or(eq(settlements.paidByUserId, user.id), eq(settlements.receivedByUserId, user.id))
          )
        );

      await tx
        .update(directInvites)
        .set({ status: "revoked" })
        .where(
          and(
            eq(directInvites.status, "pending"),
            or(eq(directInvites.inviterId, user.id), eq(directInvites.inviteeId, user.id))
          )
        );

      await tx
        .update(users)
        .set({
          username: tombstoneUsername(user.id),
          name: null,
          email: null,
          image: null,
          emailVerified: false,
        })
        .where(eq(users.id, user.id));

      await tx.delete(sessions).where(eq(sessions.userId, user.id));
      await tx.delete(accounts).where(eq(accounts.userId, user.id));
    });
  } catch (error: unknown) {
    if (error instanceof UnsettledBalancesError) {
      return {
        success: false,
        error: `You still have unsettled balances. Settle up before deleting your account: ${error.summary}.`,
        status: 400,
      };
    }
    const err = error as { body?: { message?: string }; status?: number };
    if (err.status === 401) {
      return { success: false, error: "Incorrect password.", status: 401 };
    }
    console.error("Failed to delete account:", error);
    return { success: false, error: "Failed to delete account.", status: 500 };
  }
  return { success: true };
}
