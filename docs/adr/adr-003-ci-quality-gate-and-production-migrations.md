# ADR 003: CI quality gate, test suite, and automated production migrations

## Status

Accepted

## Context

PactTab had no `.github/` directory. Lint, format, and tests only ran locally through the Husky
pre-push hook, which a contributor can skip with `--no-verify` or simply not have installed, so
nothing that landed on `master` was actually gated. Merges that changed the Drizzle schema also
depended on someone remembering to run migrations against the production database; forgetting left
the deployed app running against an old schema.

The pieces to automate both were already present: the `oxlint`/`oxfmt` scripts from the Phase 1
tooling migration, a Vitest suite with a self-contained Postgres harness (`tests/global-setup.ts`
creates, migrates, and drops a throwaway database), and `drizzle-kit` for applying committed
migration SQL.

## Decision

- **`.github/workflows/ci.yml` runs on every PR and on pushes to `master`, as two jobs** so each is
  an independently requireable status check:
  - `quality` — `oxlint`, `oxfmt --check`, `tsc --noEmit`, i.e. exactly the Husky pre-push
    commands, so a green pre-push implies green CI for these checks.
  - `test` — the full Vitest suite (`pnpm test`) against Postgres and Redis declared as workflow
    `services:` containers: health-checked sidecars exposed on `localhost`, so no Docker-in-Docker
    or `docker compose` is needed.
- **CI supplies its own credentials** through job-level `DATABASE_URL` and `REDIS_URL`. dotenv
  never overwrites preset environment variables, so these override `.env.test` for the run while
  the committed `.env.test` remains the local default and CI stays self-contained.
- **Superseded PR runs are cancelled** (`concurrency` keyed on workflow + ref), while `master` runs
  are never cancelled.
- **`migrate-db.yml` applies migrations to production after a merge to `master`**, gated three
  ways: only on `push` to `master`, only when `drizzle/**` or `src/db/schema.ts` changed, and
  through a `production` GitHub Environment that can require reviewer approval.
- **Both workflows can also be started manually with `workflow_dispatch`.** A manual CI run
  re-checks any branch on demand. A manual migration run applies whatever is pending to production
  regardless of the `paths` filter, which is how a failed migration is retried once the migration
  file itself is fixed — the push trigger only fires when `drizzle/**` changes, so a repaired
  migration does reach production without another schema change. The manual run still goes through
  the same `production` environment, so environment protection rules and reviewer approval still
  apply.
- **It runs `drizzle-kit migrate` (`pnpm db:migrate:apply`), not `pnpm db:migrate`.**
  `scripts/init-db.ts` can create the target database and generate missing migrations at runtime —
  useful for local bootstrapping and the self-hosted bare-metal setup (`docs/self-hosting.md`),
  but unsafe against the managed production database. `drizzle-kit migrate` applies only committed
  SQL files and records each in Drizzle's journal table.
- **Migrations serialize but never interrupt**: a shared `db-migrate` concurrency group with
  `cancel-in-progress: false` queues a second merge behind the first instead of racing it, and
  never kills an in-flight migration.
- **The `DATABASE_URL` secret belongs to the `production` environment**, scoped to this workflow,
  and is passed to the single migration step only; it is never echoed.
- **Pinned toolchain and action versions**: `.nvmrc` (Node 24) plus `packageManager`/`engines` in
  `package.json` make CI resolve the same Node and pnpm as local development, and the workflows use
  the current action majors — `actions/checkout@v7`, `actions/setup-node@v7`,
  `pnpm/action-setup@v6` — all on the `node24` runtime.

## Consequences

- Once branch protection requires the checks, lint, format, typecheck, and tests block merges for
  real; bypassing them takes a deliberate settings change rather than a flag on one command.
- CI wall time is dominated by dependency install and service-container startup, not the suite
  itself (~15 s for 196 tests).
- CI and the local hooks run identical commands, so the two cannot disagree on these checks.
- A schema change merged without its generated migration still ships an unmigrated app: the `paths`
  filter only fires when `drizzle/**` changes, and `drizzle-kit migrate` applies only files that
  exist. The drift check (`pnpm db:generate && git diff --exit-code drizzle/`) is the identified
  next step.
- Migrations are recorded per file, so a failed run resumes from the last applied file rather than
  reapplying everything.
- A manual `workflow_dispatch` on the migration workflow applies pending migrations even when the
  last merge touched no schema, so the manual path is a deliberate escape hatch rather than a
  routine way to migrate production.
- Migration still runs independently of deployment, leaving a window in which new code can run
  before its schema lands. Ordering "migrate → restart" from the deploy side is tracked follow-up.
- The test job pays Postgres and Redis startup on every PR, accepted in exchange for catching
  regressions before merge.

## Alternatives considered

- **The status quo — local hooks only:** rejected; hooks are unenforceable and nothing verified
  `master`.
- **`pnpm db:migrate` (`scripts/init-db.ts`) for the production job:** rejected because it can
  create the database and generate migrations at runtime, which is unsafe against production.
- **Running the migration workflow on every push to `master`:** rejected; `paths` filtering keeps
  merges that don't touch the schema away from the production database entirely.
- **`docker compose` (Docker-in-Docker) for the test dependencies:** rejected in favour of GitHub
  Actions service containers, which are first-class, health-checked, and need no extra setup.
- **One CI job with all steps:** rejected in favour of separate `quality` and `test` jobs, which
  map to separate required checks and let the fast quality job finish first.
- **Adding `next build` and a PR drift check now:** deferred to keep PR feedback fast; the drift
  check is the first follow-up.
- **Pinning actions to full commit SHAs with Dependabot:** not adopted yet; majors are used, with
  SHA pinning noted as supply-chain hardening.

## References

- [GitHub Actions: service containers](https://docs.github.com/en/actions/using-containerized-services/about-service-containers)
- [GitHub Actions: environments and deployment protection rules](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [GitHub Actions: workflow concurrency](https://docs.github.com/en/actions/using-jobs/using-concurrency)
- [Drizzle Kit: `migrate`](https://orm.drizzle.team/docs/drizzle-kit-migrate)
- Implementations: `.github/workflows/ci.yml`, `.github/workflows/migrate-db.yml`
