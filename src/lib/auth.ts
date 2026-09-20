import bcrypt from "bcryptjs";
import crypto from "crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, users, verifications } from "@/db/schema";
import { getEnabledSocialAuthProviders } from "@/lib/social-auth-config";

const providers = getEnabledSocialAuthProviders();
const google = providers.find((provider) => provider.id === "google");
const github = providers.find((provider) => provider.id === "github");
const provisionalUsername = (id: string) => `user_${id.replaceAll("-", "").slice(0, 25)}`;

export const betterAuthInstance = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: users, session: sessions, account: accounts, verification: verifications },
  }),
  user: { modelName: "users" },
  session: { modelName: "sessions" },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    password: {
      hash: (password) => bcrypt.hash(password, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  plugins: [
    username({
      displayUsername: false,
      immutableUsername: true,
      usernameValidator: (value) => /^[a-zA-Z0-9_]+$/.test(value),
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data:
            "username" in user && user.username
              ? user
              : { ...user, username: provisionalUsername(user.id) },
        }),
      },
    },
  },
  socialProviders: {
    ...(google ? { google: { clientId: google.clientId, clientSecret: google.clientSecret } } : {}),
    ...(github ? { github: { clientId: github.clientId, clientSecret: github.clientSecret } } : {}),
  },
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
  secret: process.env.BETTER_AUTH_SECRET,
});

const SESSION_COOKIE_NAME = "splitwise_session";

/** Legacy helpers remain during the staged Better Auth cutover. */
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
export async function createSession(userId: string) {
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id, userId, expiresAt });
  try {
    (await cookies()).set(SESSION_COOKIE_NAME, id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
  } catch (error) {
    if (!(error as Error).message.includes("outside a request scope")) throw error;
  }
  return id;
}
export async function deleteSession() {
  try {
    const store = await cookies();
    const id = store.get(SESSION_COOKIE_NAME)?.value;
    if (id) {
      await db.delete(sessions).where(eq(sessions.id, id));
      store.delete(SESSION_COOKIE_NAME);
    }
  } catch (error) {
    if (!(error as Error).message.includes("outside a request scope")) throw error;
  }
}
export async function getCurrentUser(): Promise<{
  id: string;
  username: string;
  createdAt: Date;
} | null> {
  if (process.env.TEST_CURRENT_USER_ID) {
    const [user] = await db
      .select({ id: users.id, username: users.username, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, process.env.TEST_CURRENT_USER_ID))
      .limit(1);
    if (user) return user;
  }
  try {
    const store = await cookies();
    const id = store.get(SESSION_COOKIE_NAME)?.value;
    if (id) {
      const [user] = await db
        .select({ id: users.id, username: users.username, createdAt: users.createdAt })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
        .limit(1);
      if (user) return user;
    }

    const socialSession = await betterAuthInstance.api.getSession({ headers: await headers() });
    if (!socialSession?.user) return null;
    const [user] = await db
      .select({ id: users.id, username: users.username, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, socialSession.user.id))
      .limit(1);
    return user ?? null;
  } catch (error) {
    const digest = (error as { digest?: string }).digest;
    if (digest?.startsWith("DYNAMIC_SERVER_USAGE") || digest?.startsWith("NEXT_")) throw error;
    return null;
  }
}
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
