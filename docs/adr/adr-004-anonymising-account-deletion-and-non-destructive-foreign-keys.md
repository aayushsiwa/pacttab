# ADR 004: Anonymising account deletion with non-destructive user foreign keys

## Status

Accepted

## Context

`users` rows are referenced by groups, memberships, expenses, expense splits, settlements, messages, invites and join requests. Every one of those foreign keys originally used `ON DELETE CASCADE`, so deleting a user row silently deleted the expenses they paid (and every split on them), the settlements they were party to, their memberships, and — for a group creator — the entire group. A member deleting their account rewrote other members' financial history without their consent.

Issue #25 identified this as an orphan path: the balance math dropped one side of any transaction whose party was missing, so the group stopped being zero-sum and displayed asymmetric debt that could never be settled. The fix shipped with #25 keeps departed members in the balance math and blocks account deletion while the user owes or is owed money. That protects the balance, but it leaves the underlying data model able to destroy history.

## Decision

- **No user-referencing foreign key cascades.** Every `users.id` reference on a domain table — `groups.created_by`, `group_members.user_id`, `invite_links.created_by`, `join_requests.user_id`, `direct_invites.inviter_id`/`invitee_id`, `expenses.paid_by_user_id`/`created_by`, `expense_splits.user_id`, `settlements.paid_by_user_id`/`received_by_user_id`/`created_by_user_id` — uses `ON DELETE RESTRICT`. Group→child references and the auth tables (`sessions`, `accounts`) keep `ON DELETE CASCADE`, because deleting a group or a session should still clean up its own rows.
- **Account deletion is an anonymising soft delete, never a row delete.** `deleteUserAccount` verifies the password for handle/password accounts, then opens a single transaction that: takes the group advisory lock for every group the member is active in, in a stable sorted order; re-checks inside that transaction that the member owes or is owed nothing in any of those groups; and only then marks the memberships inactive, cancels the user's pending settlements, revokes the user's pending direct invites, replaces the handle with a stable tombstone (`deleted_<id fragment>`), clears name/email/image, and deletes the session and credential rows.
- **The balance check runs under the same advisory lock as leaving and settlement confirmation.** The lock is the same `pg_advisory_xact_lock(hashtext(groupId))` that `leaveGroup` and `confirmSettlement` take, so a balance cannot change between the check and the tombstone write, and two deletions touching overlapping groups cannot deadlock against each other.
- **The user row survives**, so every expense, split, settlement and membership that references it keeps its history and keeps resolving to a display name. A deleted member appears in group history as an anonymised ghost instead of a hole in the ledger.
- **A hard delete of a user that still owns history is now impossible at the database level** — the `RESTRICT` constraint rejects it. Only users with no references at all can be hard-deleted.

## Consequences

- Deleting an account no longer erases the member's financial footprint; it anonymises it. Group balances stay zero-sum and auditable, and the other members' expense and settlement history is never rewritten.
- The handle of a deleted account is released (the tombstone takes its place), so a later account may reuse it. History is keyed by `users.id` and never by username, so a reused handle never inherits another person's transactions — the deleted member always renders as their tombstone label, and the reused handle always renders as the new account.
- Account deletion now needs the `accounts` row for password verification. A provider-only account has no password to check and relies on the authenticated session instead.
- The password is verified before the balance check, so an unsettled-balance summary is never shown to someone who could not prove they hold the password.
- Existing deployments must apply the generated migration before the new policy is enforced; the Drizzle migration workflow (ADR 003) applies it automatically on merge to `master` and on container boot for self-hosters.
- The `users` table keeps one tombstone row per deleted account. Purging those rows is a separate, deliberate operation.

## Alternatives considered

- **Keep cascading deletes and rely on the balance gate:** rejected — the gate only protects members with an outstanding balance; a settled member's expense rows still vanished and could shift other members' balances.
- **Hard delete with the history copied elsewhere:** rejected — duplicating history creates a second source of truth for balances and complicates every balance query.
- **Block account deletion entirely:** rejected — it would trap users who want to leave; the anonymising delete gives them a real exit.
- **Soft delete with a nullable `deleted_at` flag:** deferred — the tombstone handle already marks the row, and an extra column would only matter if per-user retention windows are needed later.
- **Deleting the member and re-creating them as a "ghost" row:** rejected — it breaks the foreign keys that make history auditable in the first place.

## References

- Issue #25 — Departed members silently dropped from balance math
- [PostgreSQL foreign key constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
