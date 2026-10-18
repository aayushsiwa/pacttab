# Proof of Concept (POC): Admin Promotion & Demotion (Multiple Admins)

## 1. Summary

PactTab groups currently behave as if they have exactly one admin. The schema allows more
(`group_members.role` is a plain varchar, `src/db/schema.ts:89`), but the only way to change roles
is `transferAdmin` (`src/lib/group-service.ts:750-829`), which **demotes the caller while promoting
the target** — a pure handover. Two rules built on that assumption leak into everyday flows:

- An admin cannot leave the group at all while any other member exists — they must first hand over
  admin rights (`src/lib/group-service.ts:921-930`).
- Invite governance (invite links, join-request review, group settings) is a single point of
  failure: if the one admin goes inactive, nobody else can manage people.

This POC introduces **multiple admins per group**: any admin can promote an active member to
admin, or demote an admin back to member — with protection so a group can never be left with zero
admins.

## 2. Product Decisions

| Decision                 | Choice                                                                                                                            |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| Who can promote/demote   | **Any active admin**                                                                                                              |
| Demotion scope           | **Promote + demote** (demote = "Remove admin")                                                                                    |
| Self-demotion            | Allowed as a **step-down** only when another active admin exists                                                                  |
| Last-admin protection    | Demotion and leaving are blocked while the actor is the only active admin                                                         |
| Existing `transferAdmin` | **Kept as-is** — still a valid explicit "hand over primary admin" gesture; can later be composed from promote + demote if desired |
| System messages          | Role changes post a group system message, matching the transfer pattern (`src/lib/group-service.ts:798-806`)                      |

## 3. Why Now

- **Resilience**: the admin who created the group can leave a settled flat without a fake
  "transfer dance".
- **Small-group reality**: flatmates and trip crews share management duties; one-admin-for-life is
  an artificial constraint.
- **Dependency**: the [direct-invite decision](../../docs/adr/adr-002-direct-invites-by-username.md)
  gates inviting by username to admins — multi-admin widens who can send those invites, so it is the
  natural follow-up.

## 4. Data Model

**No schema change required.** `group_members.role` already stores `"admin" | "member"`
(`src/db/schema.ts:89`) and there is no single-admin constraint. All new logic lives in the service
layer plus a fix to the leave guard.

## 5. Service Layer (`src/lib/group-service.ts`)

### 5.1 `promoteAdmin(user, groupId, targetUserId)`

1. Caller must be an **active admin** (same check as `updateGroup`, line 136-150).
2. Target must be an **active member** of the group; already-admin → 409.
3. Transaction: set `role: "admin"`, post system message
   `"<admin> promoted @<member> to admin."`, broadcast `new_message` + `refresh`.

### 5.2 `demoteAdmin(user, groupId, targetUserId)`

1. Caller must be an active admin.
2. Target must currently be an admin.
3. **Last-admin guard**: count active admins; if the target is the only one → 409
   `A group must have at least one admin.`
4. Self-demotion (step-down) is just the same operation with `targetUserId === user.id`,
   subject to the same guard — so no special-case endpoint is needed.
5. Transaction: set `role: "member"`, post system message
   `"<admin> removed @<admin>'s admin rights."`, broadcast `new_message` + `refresh`.

### 5.3 `leaveGroup` fix (`src/lib/group-service.ts:921-930`)

Current logic blocks **any** admin from leaving whenever `otherActiveMembers.length > 0`.
New logic: block only when the leaver is an admin **and no other active admin exists**. The error
message updates to: _"You are the group's only admin. Promote another member to admin before
leaving."_ Non-admin members, and admins with a fellow admin, leave normally (member row set to
`inactive`, unchanged behavior otherwise).

### 5.4 `transferAdmin` — unchanged

The existing endpoint (`/api/groups/[id]/transfer-admin`) keeps working: it remains the explicit
handover (promote target, demote self in one transaction). With promote/demote available it is no
longer the _only_ path, and the "transfer before leaving" requirement shrinks to "make sure another
admin exists before leaving".

## 6. API Surface

| Route                              | Method | Purpose                                          |
| :--------------------------------- | :----- | :----------------------------------------------- |
| `/api/groups/[id]/admins/[userId]` | POST   | Promote an active member to admin                |
| `/api/groups/[id]/admins/[userId]` | DELETE | Demote an admin to member (incl. self step-down) |

Both admin-gated via `authenticateRequest()` + service delegation (`src/lib/api-auth.ts`), matching
the existing `[id]/transfer-admin` handler.

## 7. Client

**Hooks** (`src/hooks/mutations/use-groups.ts`)

- `usePromoteAdmin` — invalidates `queryKeys.groups.detail(groupId)` + `groups.lists()`
- `useDemoteAdmin` — same invalidations

**UI** (`src/components/group/members-view.tsx`)

- Member rows already show a role badge (line 314-323). For admins, each row gains a compact
  action menu:
  - **Make admin** (visible on `member` rows)
  - **Remove admin** (visible on `admin` rows, hidden for self unless step-down is offered)
  - **Transfer admin rights** — existing action, unchanged
- Actions hidden entirely for non-admin viewers (the card already collapses to the
  "managed by the group admin" notice, line 482-489).
- Destructive demotion uses a light confirm step (matching the tone of existing destructive
  dialogs, e.g. invite revocation is single-click today — demotion may keep it one-click if the
  toast makes the action recoverable-feeling; decide during implementation).

**System messages** need no new rendering — `message-content.tsx` already handles `type: "system"`.

## 8. Edge Cases

| Case                                       | Behavior                                                                      |
| :----------------------------------------- | :---------------------------------------------------------------------------- |
| Promote a non-member / inactive member     | 404                                                                           |
| Promote someone already admin              | 409                                                                           |
| Demote the last active admin               | 409 (group must keep ≥ 1 admin)                                               |
| Admin leaves with a fellow admin present   | Allowed; leaver's row → `inactive`                                            |
| Admin leaves as sole admin                 | Blocked with the updated message                                              |
| Sole admin transfers via existing endpoint | Still works (target becomes admin, caller becomes member — never zero admins) |
| Inactive (`status: "inactive"`) admins     | Not counted toward the active-admin total for the last-admin guard            |
| Concurrent demote/leave race               | Last-admin check runs inside the same transaction as the write                |

## 9. Tests (`tests/admin-roles.test.ts`)

Mirroring `tests/service-authorization.test.ts` and `tests/group-mutations.test.ts`:

1. Promote: non-admin caller → 403; active member → success + system message; non-member → 404;
   already admin → 409
2. Demote: non-admin caller → 403; last active admin → 409; second admin demoted → success;
   self step-down with another admin present → success
3. `leaveGroup`: sole admin blocked with new message; admin with a peer leaves successfully;
   member leaves unchanged
4. `transferAdmin`: regression — still promotes target and demotes caller
5. Multi-admin invite governance: a promoted admin can create invite links and review join
   requests (the checks already test `role !== "admin"`, so this should pass without changes —
   worth asserting explicitly since it is the motivation for the feature)

## 10. Out of Scope

- Audit log of role changes beyond the group system message.
- Admin count badges in the group card (a single "admin" badge per member row is sufficient).
- Changing `transferAdmin` semantics or removing it.

## 11. Verification

```bash
pnpm test && pnpm run lint && pnpm run format:check
```
