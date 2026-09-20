# Refactor: Migrate to better-auth for Username/Password Authentication

## Overview

This document outlines the migration from the current custom auth implementation (`src/lib/auth.ts`, `src/actions/auth.ts`) to **better-auth** (v1.7.3, already installed) with username/password authentication.

---

## Current Implementation

### Files to Replace

- `src/lib/auth.ts` - Password hashing, session management, cookie handling, user retrieval
- `src/actions/auth.ts` - Server actions: `signUpAction`, `signInAction`, `signOutAction`, `deleteAccountAction`

### Current Schema (users table)

```typescript
// src/db/schema.ts
users: {
  id: text PK,
  username: varchar(50) UNIQUE NOT NULL,
  passwordHash: text NOT NULL,
  createdAt: timestamp
}
sessions: {
  id: text PK,
  userId: text FK -> users.id CASCADE,
  expiresAt: timestamp NOT NULL,
  createdAt: timestamp
}
```

---

## Migration Plan

**Approved identity policy:** local handle/password accounts use the internal, non-deliverable email `<normalized-handle>@pacttab.local` for Better Auth compatibility. It is never displayed or used as a group identity. OAuth accounts retain their provider email only in the authentication layer.

### 1. Database Schema Changes

Better-auth requires specific table structures. Add a migration to create better-auth tables alongside existing ones (for zero-downtime migration):

```sql
-- Migration: better_auth_tables
-- Run via: npm run db:generate && npm run db:push

-- better-auth user table (extends current users)
CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "email" TEXT UNIQUE,
  "emailVerified" BOOLEAN DEFAULT FALSE,
  "image" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- better-auth session table
CREATE TABLE "session" (
  "id" TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "token" TEXT UNIQUE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

-- better-auth account table (for username/password)
CREATE TABLE "account" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
  "refreshTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
  "scope" TEXT,
  "password" TEXT, -- hashed password for credentials provider
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- better-auth verification table
CREATE TABLE "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE UNIQUE INDEX "account_providerId_accountId_idx" ON "account"("providerId", "accountId");
```

**Data Migration Strategy:**

1. Keep existing `users` and `sessions` tables during migration
2. Migrate existing users to `user` + `account` tables
3. Update foreign keys in related tables (`group_members`, `expenses`, etc.) to reference new `user.id`
4. Drop old tables after verification

---

### 2. Better-auth Configuration

Create `src/lib/auth.ts` (replaces current):

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { users, sessions, accounts, verifications } from "@/db/schema/auth"; // new schema file
import { username } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    maxPasswordLength: 128,
    requireEmailVerification: false,
    autoSignIn: true,
  },
  username: {
    enabled: true,
    minUsernameLength: 3,
    maxUsernameLength: 30,
    allowedCharacters: /^[a-zA-Z0-9_]+$/,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  plugins: [username()],
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
  secret: process.env.BETTER_AUTH_SECRET!,
});

// Type-safe helpers
export const signUp = auth.api.signUpEmail;
export const signIn = auth.api.signInEmail;
export const signOut = auth.api.signOut;
export const getSession = auth.api.getSession;
export const deleteUser = auth.api.deleteUser;
```

---

### 3. Better-auth Schema File

Create `src/db/schema/auth.ts`:

```typescript
// src/db/schema/auth.ts
import { pgTable, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("account_provider_account_idx").on(table.providerId, table.accountId)]
);

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

---

### 4. API Route for better-auth

Create `src/app/api/auth/[...all]/route.ts`:

```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth.handler);
```

---

### 5. Server Actions (Replace `src/actions/auth.ts`)

```typescript
// src/actions/auth.ts
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/auth-utils";

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
    await auth.api.signUpEmail({
      body: {
        username: validation.data.username.toLowerCase(),
        password: validation.data.password,
      },
    });
  } catch (error: unknown) {
    const err = error as { body?: { message?: string }; status?: number };
    if (err.status === 400 && err.body?.message?.includes("username")) {
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
    await auth.api.signInEmail({
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
  await auth.api.signOut({ headers: new Headers() });
  redirect("/login");
}

export async function deleteAccountAction(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();
  const password = formData.get("password") as string;

  if (!password) {
    return { success: false, error: "Password is required to delete your account" };
  }

  try {
    await auth.api.deleteUser({
      body: { password },
      headers: new Headers(), // session cookie automatically included
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
```

---

### 6. Auth Utilities (Replace `src/lib/auth.ts` helpers)

Create `src/lib/auth-utils.ts`:

```typescript
// src/lib/auth-utils.ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export const getCachedUser = cache(getCurrentUser);

export async function requireUser() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  return user;
}

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
```

---

### 7. Client-side Auth Hook

Create `src/hooks/use-auth.ts`:

```typescript
// src/hooks/use-auth.ts
"use client";

import { useSession } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useAuth(requireAuth = true) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && requireAuth && !session) {
      router.push("/login");
    }
  }, [session, isPending, requireAuth, router]);

  return {
    user: session?.user ?? null,
    isLoading: isPending,
    isAuthenticated: !!session,
  };
}
```

---

### 8. Middleware for Route Protection

Create `src/middleware.ts`:

```typescript
// src/middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  const protectedPaths = ["/groups", "/settings"];
  const isProtected = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup") &&
    session
  ) {
    return NextResponse.redirect(new URL("/groups", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

### 9. Environment Variables

Add to `.env.local`:

```env
BETTER_AUTH_SECRET=your-32-char-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate secret: `openssl rand -base64 32`

---

### 10. Update Imports Across Codebase

Replace imports in:

- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/groups/page.tsx`
- `src/app/group/[id]/page.tsx`
- `src/app/join/[token]/page.tsx`
- `src/components/navbar.tsx`
- `src/components/user-settings-dialog.tsx`

**From:**

```typescript
import { getCurrentUser, requireUser } from "@/lib/auth";
import { signOutAction, deleteAccountAction } from "@/actions/auth";
```

**To:**

```typescript
import { getCurrentUser, requireUser } from "@/lib/auth-utils";
import { signOutAction, deleteAccountAction } from "@/actions/auth";
import { useAuth } from "@/hooks/use-auth"; // for client components
```

---

## Migration Steps Checklist

### Phase 1: Schema & Config

- [ ] Create `src/db/schema/auth.ts` with better-auth tables
- [ ] Generate and run migration (`npm run db:generate && npm run db:push`)
- [ ] Create `src/lib/auth.ts` with better-auth config
- [ ] Create `src/app/api/auth/[...all]/route.ts`
- [ ] Add environment variables

### Phase 2: Server Actions & Utilities

- [ ] Create `src/lib/auth-utils.ts`
- [ ] Update `src/actions/auth.ts` to use better-auth API
- [ ] Test signup/signin flows

### Phase 3: Client Integration

- [ ] Create `src/hooks/use-auth.ts`
- [ ] Create `src/middleware.ts`
- [ ] Update all server components to use `auth-utils`
- [ ] Update client components to use `useAuth` hook

### Phase 4: Data Migration

- [ ] Write migration script to copy users from old `users` table to new `user` + `account` tables
- [ ] Update foreign key references in related tables
- [ ] Verify all data integrity
- [ ] Drop old `users` and `sessions` tables

### Phase 5: Cleanup

- [ ] Remove old `src/lib/auth.ts` (custom implementation)
- [ ] Remove bcryptjs dependency (`npm uninstall bcryptjs @types/bcryptjs`)
- [ ] Run full test suite
- [ ] Deploy

---

## Testing Checklist

- [ ] Sign up with username/password
- [ ] Sign in with username/password
- [ ] Sign out
- [ ] Delete account with password confirmation
- [ ] Session persistence across browser restart
- [ ] Protected routes redirect to login
- [ ] Authenticated users redirected from login/signup
- [ ] Middleware protects `/groups`, `/settings`
- [ ] All existing tests pass (`npm run test`)

---

## Rollback Plan

If issues arise:

1. Keep old `users` and `sessions` tables during migration
2. Revert `src/lib/auth.ts` and `src/actions/auth.ts` to custom implementation
3. Revert middleware and client hooks
4. Update imports back to original paths

---

## Optional OAuth Provider Configuration

Google and GitHub support must use `src/lib/social-auth-config.ts` as the only environment parser. It keeps credentials server-only and exposes UI-safe `{ id, label }` metadata separately.

- [x] Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET` to `.env.example`.
- [x] Enable a provider only when it has both a non-empty client ID and secret.
- [x] Add unit coverage for disabled, partial, complete, and whitespace-only provider configuration.
- [ ] Configure Better Auth `socialProviders` from the server-only enabled-provider configuration.
- [ ] Render Google/GitHub controls only from the safe provider metadata after the Better Auth handler is live.
- [ ] Keep local handle/password controls available regardless of OAuth configuration.
