# Proof of Concept (POC): Invite by Username (Direct Invites)

## 1. Summary

Today the only way into a group is a shareable invite link (`/join/<token>`), which an admin must
create, copy, and relay out-of-band (`src/components/group/members-view.tsx`). This POC adds a
second path: **an admin invites a specific person directly by their username**. The invite lands in
the invitee's in-app inbox and, optionally, as a shareable link pre-bound to that one user.

The feature fills a real gap: PactTab is deliberately email-free (no `email` in the product sense —
only the synthetic `<username>@pacttab.local` identity in `src/lib/auth-identity.ts`), so "copy a
token and hope it reaches the right person" is the status quo. Usernames are already first-class,
unique, and immutable (`src/db/schema.ts:15`), making them the natural addressing scheme.

## 2. Product Decisions

| Decision                    | Choice                                                                                                                                           |
| :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| Who can send direct invites | **Group admins only** (consistent with `createInviteLink`, `src/lib/group-service.ts:240`)                                                       |
| Delivery                    | **Both** an in-app inbox entry and a copyable share link pre-bound to the invitee                                                                |
| Invitee flow                | **Explicit accept / decline** (mirrors the `join_requests` pattern)                                                                              |
| Existence feedback          | **Show "User not found"** — accepted trade-off for typo detection, even though it makes username existence probeable by admins                   |
| Default expiry              | **7 days**, enforced at read/respond time                                                                                                        |
| Re-invite                   | After decline/accept the row is already deleted, so re-invite inserts fresh; a `revoked` row is reset to `pending` with a fresh token and expiry |

Privacy note: this intentionally refines the "no public user search" rule in `MVP.md:50`. There is
still no search, browsing, or discovery — only an **exact-username lookup performed by a group
admin for the purpose of inviting**, which requires already knowing the username.

## 3. User Flows

### A. Admin sends an invite

1. Admin opens the group's **Members** tab → **Invite by Username** → enters `@maya`.
2. Server normalizes to lowercase, resolves the user, and validates:
   - 404 `User not found` (also excludes provisional `user_<hex>` accounts still in onboarding —
     `needsUsername: true`, `src/lib/auth.ts:40-51`)
   - 409 already an active member / already has a pending invite
   - 400 self-invite
3. On success the dialog shows the pre-bound link `${origin}/join/<token>` with a copy button and
   the note "Also appears in Maya's inbox."

### B. Invitee accepts from the inbox

1. Invitee opens **Your Groups** → **Group Invitations** section (styled like the existing
   **Pending Group Requests**, `src/app/groups/page.tsx:36-99`), showing group name, inviter, age.
2. **Accept** → joins the group (system message + `member_joined` WebSocket broadcast) and the
   invite row is **deleted**, **Deny** → the invite row is **deleted**, no system message posted to
   the group (the decline is private; there is simply nothing left to show).

### C. Invitee opens the share link

`/join/[token]` resolves the token against `invite_links` first, then `direct_invites`:

- Logged out → existing sign-in/sign-up card with `returnTo=/join/<token>`
- Logged in as the invitee → accept / decline card → accept redirects to `/group/[id]`
- Logged in as someone else → "This invite was sent to @maya."
- Revoked → revoked error card; expired → one-time "Invite Expired" card (the row is deleted, so
  later visits get the generic "Invite Unavailable"); declined / already accepted → generic
  "Invite Unavailable" (rows are deleted on respond)

## 4. Data Model

New table in `src/db/schema.ts` (+ generated migration via `pnpm run db:generate`), mirroring
`join_requests` (`src/db/schema.ts:113-125`):

```text
DirectInvite
  id, groupId, inviterId, inviteeId,
  token (varchar 64, unique — backs the share link),
  status: pending | revoked,
  expiresAt, createdAt
  UNIQUE (groupId, inviteeId)   -- one invite per user per group
```

Rows are **deleted** as soon as they are consumed: acceptance, decline, and first-detected expiry
all remove the row, so only `pending` (and admin-`revoked`) rows ever persist. Relations added to
`groups` and `users`. No changes to `invite_links` or `join_requests`.

## 5. Service Layer (`src/lib/group-service.ts`)

| Function                                          | Authorization                                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| :------------------------------------------------ | :------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createDirectInvite(user, groupId, { username })` | Admin only (same membership check as `createInviteLink`) | Case-insensitive exact match on `lower(users.username)`; excludes `needsUsername` users; returns `{ inviteId, token, inviteeUsername }`                                                                                                                                                                                                                                                                                                              |
| `respondToDirectInvite(user, inviteId, decision)` | Invitee only; must be `pending` and unexpired            | Already an active member (joined via another path): row **deleted** silently, `success` returned with no membership change or system message. Otherwise accept: transaction reactivates/inserts `groupMembers`, posts the system message, fires `new_message` + `member_joined` broadcasts (mirrors `reviewJoinRequest`, line 672-741), then **deletes the invite row**. Decline: **row deleted**, no system message. Expired: **row deleted** + 409 |
| `revokeDirectInvite(user, groupId, inviteId)`     | Admin only                                               | `pending` → `revoked` (kept, so the link explains itself)                                                                                                                                                                                                                                                                                                                                                                                            |
| `resolveDirectInviteByToken(token)`               | Public (join page)                                       | Returns invite + group + inviter for token resolution; an expired row is **deleted** and still reported as `expired` for that one view (later views → `null`)                                                                                                                                                                                                                                                                                        |
| `getUserPendingDirectInvites(userId)`             | Self                                                     | Inbox query; joins group name and inviter username; excludes rows whose invitee is already an active member (`NOT EXISTS` guard)                                                                                                                                                                                                                                                                                                                     |

Stale-invite cleanup beyond direct responses: `joinGroup` deletes any direct invite row for
`(groupId, user.id)` on all success paths (active shortcut, reactivation, fresh insert), and
`reviewJoinRequest` deletes the requestor's rows when the request is approved — a pending invite
can never outlive the membership it was created for. `getGroupDetails` filters out rows for active
members on the admin list as well.

Validation input added to `src/lib/group-validation.ts`:

```typescript
directInviteSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/),
});
```

## 6. API Surface

| Route                                        | Method | Purpose                             |
| :------------------------------------------- | :----- | :---------------------------------- |
| `/api/groups/[id]/direct-invites`            | POST   | Send invite, body `{ username }`    |
| `/api/groups/[id]/direct-invites/[inviteId]` | DELETE | Revoke                              |
| `/api/user/direct-invites`                   | GET    | Invitee inbox                       |
| `/api/user/direct-invites/[inviteId]`        | PATCH  | Accept/decline, body `{ decision }` |

Handlers authenticate via `authenticateRequest()` and delegate to the service with
`serviceResponse()` (both in `src/lib/api-auth.ts`), per the layering rules in `AGENTS.md`. The
admin's **sent** invite list rides along in `getGroupDetails` (`src/lib/queries.ts:~243`, where
active invites are already fetched), so no extra read route is needed and invalidation reuses
`queryKeys.groups.detail`.

## 7. Client

**Hooks**

- `src/hooks/mutations/use-groups.ts`: `useSendDirectInvite`, `useRevokeDirectInvite`,
  `useRespondToDirectInvite`
- `src/hooks/queries/use-user.ts`: `useUserPendingDirectInvites`
- `src/lib/query-keys.ts`: `user.pendingDirectInvites`

**UI**

- `src/components/group/members-view.tsx` — "Invite by Username" button + dialog (success state
  shows the copyable pre-bound link); the typed username is checked live against `members` and
  `directInvites` — an active member gets an inline "already a member" hint and a disabled Send
  (a pending invite gets "already has a pending invite"), so the admin sees the 409 condition
  before pressing Send; the server-side 409 remains authoritative. A "Pending Direct Invites" list
  under the Invite Links card with status badges, copy-link, and revoke actions.
- `src/app/groups/page.tsx` — "Group Invitations" section: amber cards mirroring
  "Pending Group Requests" with **Accept** / **Deny** buttons.
- `src/app/join/[token]/page.tsx` — token resolution branch described in §3C.
- `src/types/api.ts` — new `DirectInvite` / `PendingDirectInvite` types.

## 8. Edge Cases

- Self-invite rejected; inviting an already-active member rejected; inviting an inactive
  (left/removed) member reactivates membership on accept, like `reviewJoinRequest` does.
- Stale invites are impossible to observe: joining through a share link, an approved join request,
  or accepting directly all delete the invite row, and the inbox/admin-list queries hide any
  leftover row for an active member. Accepting while already an active member is a silent cleanup
  (success, no duplicate system message).
- Provisional onboarding accounts (`needsUsername: true`) are invisible to username lookup —
  their `user_<hex>` handles are internal, not shareable identities.
- Responding to an invite whose row is already gone (accepted/declined earlier) → 404; responding
  to a revoked/expired invite → 409 with a clear message.
- Share-link token lookup order: `invite_links` first, then `direct_invites` (collision with a
  custom invite slug is practically impossible — tokens are `crypto.randomBytes(16).toString("hex")`,
  but ordering makes it deterministic anyway).
- No real-time push to the invitee (they are not yet in the group's WebSocket scope); the inbox is
  fetched on page load, same as `/api/user/join-requests` today.

## 9. Tests (`tests/direct-invites.test.ts`)

Mirroring `tests/custom-invite-links.test.ts` and `tests/join-action.test.ts`:

1. Create: non-admin → 403; unknown username → 404; active member → 409; success returns token
2. Create excludes `needsUsername` users; case-insensitive match works
3. Respond: wrong user → 403; accept adds membership + posts system message and deletes the row;
   decline deletes the row silently; responding again → 404; expired → 409 + row deleted
4. Revoke: non-admin → 403; pending → revoked
5. Token link: valid invitee → join; wrong user → clear error; revoked → error card; expired →
   one-time expired card, then `null` on later resolution
6. Stale cleanup: invitee joins via share link → invite row deleted, inbox empty; join request
   approved → invite row deleted, inbox empty; invitee already active → inbox and admin list hide
   the row, direct accept is a silent cleanup (row gone, no new "accepted" system message)

## 10. Out of Scope

- **Multi-admin promotion/demotion** — see [`pocs/admin-promotion-demotion`](../admin-promotion-demotion).
  Because direct invites are admin-gated, that follow-up widens who can send them.
- Real-time inbox push notifications.
- Expiry cron (expiry is enforced lazily at read/respond time; the row is deleted when expiry is
  first detected — an invite nobody ever opens again still lingers as `pending` until the next
  re-invite attempt, which resets it).

## 11. Verification

```bash
pnpm test && pnpm run lint && pnpm run format:check
```
