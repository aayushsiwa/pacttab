@AGENTS.md

# PactTab Developer Guide

## Commands

- `pnpm dev`: Start custom Next.js dev server with WebSockets & Redis pub/sub (`tsx server.ts`)
- `pnpm test`: Run full Vitest test suite (`vitest run`)
- `pnpm run lint`: Run ESLint 9 check
- `pnpm run format`: Format code with Prettier
- `pnpm run format:check`: Check formatting
- `pnpm run db:init`: Run database migrations / initialization (`tsx scripts/init-db.ts`)
- `pnpm run db:push`: Push Drizzle schema to PostgreSQL

## Core Architecture & Principles

- **Zero Personal Data**: Users have only `username` and `passwordHash`. Never collect emails or phone numbers.
- **Privacy by Default**: Groups and invites are non-discoverable and invite-only.
- **Real-Time Layer**: Custom HTTP server (`server.ts`) integrates `ws` WebSocket server with Redis pub/sub hub (`src/lib/ws-hub.ts`).
- **Database**: PostgreSQL with Drizzle ORM (`src/db/schema.ts`).
- **Git Hooks**: Pre-commit runs `lint-staged` (ESLint + Prettier on staged files), pre-push runs lint + format:check + vitest, and commit-msg enforces Conventional Commits via Commitlint.
