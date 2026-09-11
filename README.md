<div align="center">

# PactTab

**Split expenses & chat with friends in closed circles.**<br />
Zero personal data. Zero email or phone numbers. 100% Private.

<br />

![PactTab Preview](./screenshot.png)

<br />

<a href="#features">Features</a> •
<a href="#tech-stack">Tech Stack</a> •
<a href="#getting-started">Getting Started</a> •
<a href="#available-scripts">Available Scripts</a> •
<a href="#git-hooks--contributions">Git Hooks</a> •
<a href="#architecture">Architecture</a>

</div>

---

## Overview

Existing expense-splitting applications often demand email addresses, phone numbers, contact address-book uploads, and aggressive social graph building. **PactTab** is designed specifically for flatmates, trips, dinner clubs, and close friends who want a simple, lightweight shared tab without surrendering personal privacy.

- **Zero Personal Data**: Sign up with just a unique username and password. No email, phone numbers, or third-party tracking.
- **Closed Circles**: Groups are private and non-discoverable by default. Only users with valid invite tokens can join or request entry.

---

## Features

- 🔒 **Zero-Data Privacy**: Accounts require only a username and password. Cookie-based session authentication with secure password hashing.
- 💬 **Real-Time Group Chat & @Mentions**: In-group discussion with instant WebSocket message broadcasting, user mention autocomplete (`@username`), and contextual notification pills.
- 🔗 **Configurable Invite Links**: Create custom invite links with optional expiration dates, maximum use caps, custom slug tokens, and require-admin-approval toggles.
- 👥 **Join Request Queue & Admin Notifications**: Admins receive a real-time notification indicator for pending group join requests, with the ability to approve or decline requesters.
- 💰 **Flexible Expense Tracking**: Add expenses with equal splits or custom exact per-person amounts. Edit or remove expenses with live balance recomputations.
- ⚖️ **Optimal Balance Settlement**: Automatically computes net balances and debt-simplification settlement suggestions.
- 🤝 **Settlement Affirmation Workflow**: When a member records a settlement payment, the recipient can affirm or dispute the transaction.
- 📱 **Installable Progressive Web App (PWA)**: Includes an offline fallback shell, web app manifest, and responsive mobile-first UI for desktop and mobile devices.

---

## Tech Stack

| Layer                | Technology                                                                                                                                                                                                                              |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**        | [Next.js 16](https://nextjs.org) (App Router, Server Actions)                                                                                                                                                                           |
| **UI & Styling**     | [React 19](https://react.dev), [Tailwind CSS v4](https://tailwindcss.com), [Base UI](https://base-ui.com), [Lucide React](https://lucide.dev), [Sonner](https://sonner.emilkowal.ski)                                                   |
| **Database**         | [PostgreSQL](https://www.postgresql.org) with [Drizzle ORM](https://orm.drizzle.team)                                                                                                                                                   |
| **Real-Time & Sync** | [WebSockets](https://github.com/websockets/ws) (`ws`), [Redis Pub/Sub](https://redis.io) (`ioredis`)                                                                                                                                    |
| **Authentication**   | [Better Auth](https://www.better-auth.com) session-based credentials                                                                                                                                                                    |
| **Testing**          | [Vitest](https://vitest.dev) (44 integration & flow test cases across 10 test suites)                                                                                                                                                   |
| **Tooling & Hooks**  | [pnpm](https://pnpm.io), [ESLint 9](https://eslint.org), [Prettier](https://prettier.io), [Husky](https://typicode.github.io/husky), [lint-staged](https://github.com/lint-staged/lint-staged), [commitlint](https://commitlint.js.org) |

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: v20.x or higher
- **pnpm**: v9.x or higher
- **PostgreSQL**: v14+ running locally or a hosted instance (e.g., Neon, Supabase)
- **Redis**: v6+ running locally or hosted (e.g., Upstash)

### 1. Clone the repository

```bash
git clone https://github.com/aayushsiwa/pacttab.git
cd pacttab
```

### 2. Install dependencies

```bash
pnpm install
```

_(This also triggers the `prepare` script to initialize Husky Git hooks)._

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` to supply your database and Redis credentials:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/pacttab"
SESSION_SECRET="pacttab-super-secret-key-change-in-production-min-32-chars"
BETTER_AUTH_SECRET="pacttab-super-secret-key-change-in-production-min-32-chars"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
REDIS_URL="redis://127.0.0.1:6379"
```

### 4. Initialize database schema

Run the database initialization script to create tables and relations:

```bash
pnpm run db:init
```

### 5. Start development server

PactTab runs a unified HTTP and WebSocket server powered by `tsx server.ts`:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command                 | Description                                                             |
| :---------------------- | :---------------------------------------------------------------------- |
| `pnpm dev`              | Starts development server with WebSocket & Redis sync (`tsx server.ts`) |
| `pnpm build`            | Builds the production Next.js bundle                                    |
| `pnpm start`            | Runs the production server                                              |
| `pnpm test`             | Runs the complete Vitest test suite (10 test files)                     |
| `pnpm run test:watch`   | Runs Vitest in interactive watch mode                                   |
| `pnpm run lint`         | Runs ESLint 9 checks across the codebase                                |
| `pnpm run format`       | Formats all files with Prettier                                         |
| `pnpm run format:check` | Checks formatting compliance with Prettier                              |
| `pnpm run db:init`      | Executes schema migration & initialization script                       |
| `pnpm run db:push`      | Pushes schema changes directly to the PostgreSQL database               |
| `pnpm run db:generate`  | Generates migration SQL files via Drizzle Kit                           |

---

## Git Hooks & Contributions

PactTab uses **Husky**, **lint-staged**, and **commitlint** to ensure high code quality:

- **`pre-commit`**: Automatically runs `eslint --fix` and `prettier --write` exclusively on staged files via `lint-staged`.
- **`commit-msg`**: Validates commit messages following [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`).
- **`pre-push`**: Runs full repository verification before pushing code:
  1. `pnpm run lint` (ESLint: 0 errors / 0 warnings)
  2. `pnpm run format:check` (Prettier code style)
  3. `pnpm test` (Full Vitest test suite execution)

---

## Architecture

```
├── public/                 # Static assets, PWA manifest, service worker, icons
├── scripts/                # Database initialization and maintenance scripts
├── src/
│   ├── actions/            # Next.js Server Actions (auth, chat, expenses, groups)
│   ├── app/                # App Router pages and API routes
│   │   ├── (auth)/         # Login and signup pages
│   │   ├── group/[id]/     # Main group dashboard (chat, expenses, balances, settings)
│   │   ├── groups/         # Groups list & join flows
│   │   └── join/[token]/   # Invite link resolver & preview page
│   ├── components/         # Reusable UI components & dialogs
│   │   ├── group/          # Group sub-views (expenses, chat, balances, members)
│   │   └── ui/             # Radix / Base UI styled primitives
│   ├── db/                 # Drizzle ORM schema definitions and database connection
│   ├── hooks/              # Custom React hooks (e.g., useGroupSocket)
│   └── lib/                # Shared utilities (auth, balances, Redis, ws-hub, CSV export)
├── tests/                  # Vitest integration test suites
├── server.ts               # Custom Node HTTP server binding Next.js + WebSocket Hub
└── vitest.config.mts       # Vitest configuration with path aliases
```

---

## License

MIT License.
