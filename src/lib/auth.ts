import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";

const SESSION_COOKIE_NAME = "splitwise_session";
const SESSION_DURATION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.insert(sessions).values({
    id: sessionToken,
    userId,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return sessionToken;
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}

export async function getCurrentUser(): Promise<{ id: string; username: string; createdAt: Date } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const now = new Date();
    const result = await db
      .select({
        id: users.id,
        username: users.username,
        createdAt: users.createdAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.id, token), gt(sessions.expiresAt, now)))
      .limit(1);

    if (result.length === 0) {
      // Clean up invalid cookie
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    return {
      id: result[0].id,
      username: result[0].username,
      createdAt: result[0].createdAt,
    };
  } catch (error: any) {
    if (error?.digest?.startsWith("DYNAMIC_SERVER_USAGE") || error?.digest?.startsWith("NEXT_")) {
      throw error;
    }
    console.error("Failed to retrieve current user:", error);
    return null;
  }
}

export async function requireUser(): Promise<{ id: string; username: string; createdAt: Date }> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
