# Proof of Concept (POC): GitHub Workflows (CI Quality Gate + Merge-Time DB Migration)

## Status

Implemented. Phase 1 (the oxlint/oxfmt tooling migration) landed first, followed by Phase 2 — the
two workflows below (`.github/workflows/ci.yml`, `.github/workflows/migrate-db.yml`), the
`db:migrate:apply` script they depend on, and a `test` job in `ci.yml` that runs the Vitest suite
against Postgres + Redis service containers. The manual items in §4 (creating the `production`
environment with its `DATABASE_URL` secret, and branch protection requiring the `quality` check)
are repository settings and must still be configured in the GitHub UI for the workflows to gate
merges and touch production.

## 1. Summary

PactTab has no `.github/` directory — there are no CI checks on pull requests today; lint, format,
and tests only run locally via Husky hooks (pre-push), which is easy to skip or bypass. This POC
adds two GitHub Actions workflows:

- **`ci.yml`** — quality gate on every PR: `oxlint` + `oxfmt --check` + `tsc --noEmit`.
- **`migrate-db.yml`** — on PR merge to `master`, applies pending Drizzle migrations to the
  **production** database, gated to runs that actually touch schema/migration files.

Phase 1 (swapping ESLint/Prettier for oxlint/oxfmt — see §2) landed first because `ci.yml` runs the
new tooling; Phase 2 is the workflows themselves.

## 2. Phase 1 — Tooling Migration (Done)

| Concern        | Before                                      | After                                                                       |
| :------------- | :------------------------------------------ | :-------------------------------------------------------------------------- |
| Linter         | ESLint 9 flat config (`eslint-config-next`) | `oxlint` 1.88 with `.oxlintrc.json` (generated via `@oxlint/migrate`)       |
| Formatter      | Prettier + `prettier-plugin-tailwindcss`    | `oxfmt` 0.73 with `.oxfmtrc.json` (migrated via `oxfmt --migrate=prettier`) |
| Tailwind sort  | `prettier-plugin-tailwindcss`               | oxfmt built-in `sortTailwindcss`                                            |
| TanStack rules | `@tanstack/eslint-plugin-query` flat config | Same package, loaded via oxlint `jsPlugins`                                 |
| Scripts        | `eslint` / `prettier --write .`             | `oxlint` / `oxfmt` / `oxfmt --check`                                        |
| lint-staged    | `eslint --fix` + `prettier --write`         | `oxlint --fix` + `oxfmt`                                                    |

Details: 86 rules migrated (7 skipped as deprecated/not-implemented — see `git log` for the
migration run); `react/purity` downgraded to `warn` for intentional time-of-render checks
(expiry badges, copyright year) after fixing one genuine `useState`-initializer case;
4 `eslint-disable` comments rewritten to `oxlint-disable-next-line`. Deleted:
`eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, and the `eslint`, `eslint-config-next`,
`prettier`, `prettier-plugin-tailwindcss` dependencies.

## 3. Phase 2 — Workflow Design

### 3.1 `.github/workflows/ci.yml` (quality gate)

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [master]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Lint (oxlint)
        run: pnpm lint
      - name: Format check (oxfmt)
        run: pnpm format:check
      - name: Typecheck
        run: pnpm exec tsc --noEmit
```

The block above is the `quality` job; the same file also defines the `test` job described below —
see `.github/workflows/ci.yml` for the full YAML.

- **Triggers**: every PR (branch protection then requires the check on `master`), plus direct
  pushes to `master` as a safety net.
- **Concurrency**: superseded PR runs are cancelled; master runs are not.
- **Scope**: the `quality` job is lint + fmt + typecheck only (~1 min, no services); `next build`
  remains out of scope. Tests run in a parallel `test` job (196 tests, `pnpm test`, ~15 s of
  runtime) against Postgres + Redis declared as workflow `services:` — GitHub starts both as
  health-checked sidecar containers on the runner and exposes them on `localhost`, so no
  Docker-in-Docker or `docker compose` is needed. Job-level `env` (`DATABASE_URL`, `REDIS_URL`)
  overrides `.env.test` for the run — dotenv never overrides preset env vars — keeping the
  committed `.env.test` as the local default while CI stays self-contained.
- **Job shape**: `quality` and `test` are separate jobs, so each is its own check in the GitHub
  UI; branch protection can require `quality` only, or both for a full gate.

### 3.2 `.github/workflows/migrate-db.yml` (production migration on merge)

```yaml
name: Migrate database

on:
  push:
    branches: [master]
    paths:
      - "drizzle/**"
      - "src/db/schema.ts"

concurrency:
  group: db-migrate
  cancel-in-progress: false

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Apply migrations
        run: pnpm db:migrate:apply
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Key decisions:

| Decision                        | Choice & rationale                                                                                                                                                                                                                                                                                                                                    |
| :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger                         | `push` to `master` (a merged PR) with `paths` on `drizzle/**` **and** `src/db/schema.ts` — merges that don't touch the schema never hit the database.                                                                                                                                                                                                 |
| Runner command                  | **`drizzle-kit migrate`** (new `db:migrate:apply` script), **not** `pnpm db:migrate`. `scripts/init-db.ts` can create the target database and even generate missing migrations at runtime — fine for local bootstrapping, dangerous in prod CI. `drizzle-kit migrate` only applies committed SQL files and records them in the Drizzle journal table. |
| Serialization                   | `concurrency: group: db-migrate` with `cancel-in-progress: false` — two quick merges queue their migrations instead of racing; in-flight runs are never cancelled mid-migration.                                                                                                                                                                      |
| Approval gate                   | `environment: production` — the GitHub Environment can require reviewer approval before the job touches prod, and scopes the `DATABASE_URL` secret to this workflow only.                                                                                                                                                                             |
| Config                          | `drizzle.config.ts` already reads `DATABASE_URL` from env (`dotenv.config()` never overrides a preset env var), so no config change is needed.                                                                                                                                                                                                        |
| `drizzle/` in formatter ignores | `oxfmtrc`/old `.prettierignore` already excluded `drizzle/` — migration SQL stays byte-exact regardless of tooling.                                                                                                                                                                                                                                   |

### 3.3 Optional add-ons (not yet implemented)

| Add-on                                                                                             | Value                                                                                                                                                                                                            |
| :------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PR drift check** — `pnpm db:generate && git diff --exit-code drizzle/` as a `ci.yml` step or job | Fails PRs that change `src/db/schema.ts` without committing the generated migration (the merge workflow only applies files that exist, so an ungenerated schema change would silently deploy an unmigrated app). |
| **Pin actions to commit SHAs** + Dependabot (`package-ecosystem: github-actions`)                  | Supply-chain hardening; unpinned `@v4` tags are mutable.                                                                                                                                                         |
| **Branch protection** requiring the `quality` check                                                | Makes `ci.yml` actually blocking (repo settings, not workflow code).                                                                                                                                             |
| **Post-migration deploy trigger** (SSH to the VPS, `deploy/systemd` + `ExecStart`)                 | Today deploy and migration are independent; ordering "migrate → restart app" avoids a window where new code runs against an old schema. Natural follow-up once migrations are automated.                         |

## 4. Required Setup (one-time, manual)

1. **Secret**: add `DATABASE_URL` (production Supabase URL) as a repository secret — or better,
   as an environment secret on a `production` environment so it is scoped to `migrate-db.yml`.
2. **Environment**: create the `production` environment; optionally enable _required reviewers_
   for manual approval of each migration run.
3. **Branch protection** on `master`: require the `quality` status check.
4. **New package script**: `"db:migrate:apply": "drizzle-kit migrate"` (referenced by
   `migrate-db.yml`).

## 5. Risks & Mitigations

| Risk                                            | Mitigation                                                                                                                                                                                      |
| :---------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration fails mid-run against prod            | Drizzle migrations are recorded per-file in its journal table; re-running the workflow resumes from the last applied file. The job also never runs concurrently (`db-migrate` group).           |
| Schema change merged without its migration file | §3.3 drift check; until then, the `paths` filter means the merge workflow would run only if `drizzle/**` changed, so the gap exists and is the top candidate add-on.                            |
| Secret exposure                                 | `DATABASE_URL` exists only as a secret/environment secret; it is never echoed (and `scripts/init-db.ts` masks passwords in logs, though CI uses `drizzle-kit migrate` which does not print it). |
| CI drift from local hooks                       | `ci.yml` runs the exact same three commands as the Husky pre-push hook (`pnpm lint`, `pnpm format:check`, `tsc --noEmit`), so local and CI results cannot disagree.                             |
