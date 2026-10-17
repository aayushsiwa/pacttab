<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PactTab Developer Guide

## Commands

- `pnpm dev`: Start custom Next.js dev server with WebSockets & Redis pub/sub (`tsx server.ts`)
- `pnpm test`: Run the full Vitest suite (`vitest run`)
- `pnpm run lint`: Run ESLint 9
- `pnpm run format`: Format all files with Prettier
- `pnpm run format:check`: Check formatting
- `pnpm run db:init`: Run database migrations / initialization (`tsx scripts/init-db.ts`)
- `pnpm run db:push`: Push the Drizzle schema to PostgreSQL
- `pnpm run db:generate`: Generate migration SQL via Drizzle Kit

## Core Architecture & Principles

- **Zero Personal Data**: Local accounts need only a `username` and password—no real email or phone number. Better Auth stores an internal, non-deliverable `<handle>@pacttab.local` for local accounts, and optional Google/GitHub sign-in keeps provider identity inside the auth layer, never exposed to groups.
- **Privacy by Default**: Groups and invites are non-discoverable and invite-only.
- **Write API Layering**: Client mutations call REST route handlers under `src/app/api/**`. Handlers authenticate via `authenticateRequest()`, delegate to domain services in `src/lib/*-service.ts` (group, expense, chat), and map `ServiceResult`s with `serviceResponse()` (both helpers live in `src/lib/api-auth.ts`). Server Actions are used only for onboarding (`src/actions/onboarding.ts`).
- **Client Data Layer**: Reads and mutations use TanStack Query hooks under `src/hooks/queries` and `src/hooks/mutations`.
- **Real-Time Layer**: Custom HTTP server (`server.ts`) combines the `ws` WebSocket server with the Redis pub/sub hub (`src/lib/ws-hub.ts`).
- **Database**: PostgreSQL with Drizzle ORM (`src/db/schema.ts`).
- **Auth**: Better Auth session cookies (`username` plugin) in `src/lib/auth.ts`; optional social providers resolved by `src/lib/social-auth-config.ts`.
- **Git Hooks**: Pre-commit runs `lint-staged` (ESLint + Prettier on staged files), pre-push runs lint + format:check + vitest, and commit-msg enforces Conventional Commits via Commitlint.
