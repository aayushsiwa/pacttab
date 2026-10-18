# ADR 002: Direct invites by username

## Status

Accepted

## Context

PactTab groups are invite-only and non-discoverable. Access today flows through either a shareable invite link (`/join/<token>`) that an admin must create, copy, and relay out-of-band, or an admin-approved join request. Neither path lets an admin address a specific person.

PactTab is deliberately email-free: local accounts carry only a synthetic `<handle>@pacttab.local` identity that is never used for communication, so there is no address to invite someone by other than their username. Usernames are already first-class — unique, immutable, and matched case-insensitively — which makes them the natural addressing scheme.

The existing join-request flow already provides the pieces to reuse: an invitee-facing inbox, explicit accept/decline, membership reactivation, and a group system message on join. An invite feature should reuse those patterns rather than invent a parallel one.

This decision refines the "no public user search" rule in `MVP.md`: there is still no search, browsing, or discovery, but group admins may resolve an exact username for the sole purpose of sending a private invite.

## Decision

- **Add a `direct_invites` table**: `id`, `groupId`, `inviterId`, `inviteeId`, a unique `token` (backs the share link), `status` (`pending | revoked`), `expiresAt`, `createdAt`, with `UNIQUE (groupId, inviteeId)` so a user has at most one invite per group.
- **Delete rows when they are consumed.** Acceptance, decline, and first-detected expiry remove the row; only `pending` and admin-`revoked` rows persist. This keeps the unique index meaningful, lets a re-invite insert a fresh row, and leaves nothing to clean up later.
- **Admins only** may send a direct invite, using the same membership check as `createInviteLink`.
- **Dual delivery**: the invite appears in the invitee's in-app inbox and as a shareable link pre-bound to that user (`/join/<token>`).
- **Explicit accept/decline by the invitee only**, mirroring join requests. Acceptance reactivates or inserts `groupMembers`, posts the group system message, and emits the usual realtime broadcasts; decline is silent and posts nothing.
- **Exact-username lookup** (`lower(users.username) = <input>`) that excludes provisional onboarding accounts (`needsUsername: true`, whose `user_<hex>` handles are internal). Unknown usernames return "User not found" so admins can catch typos, accepting that admins can probe username existence.
- **7-day default expiry**, enforced lazily at read/respond time — no expiry cron.
- **Stale invites are cleaned on every join path**: joining via share link or an approved join request deletes the invitee's direct-invite rows; responding to an invite while already an active member is a silent no-op that deletes the row without a duplicate system message; the inbox and admin-list queries additionally filter out rows for active members. A pending invite can never outlive the membership it was created for.
- **Token resolution** on `/join/[token]` checks `invite_links` first, then `direct_invites`, so the two link types coexist deterministically.
- **Live client feedback**: the send dialog checks the typed username against the loaded members and pending invites, showing an inline "already a member" / "already has a pending invite" hint and disabling Send — the server-side 409 remains authoritative.

## Consequences

- Admins can invite a person rather than a location, which is the only workable path in a contact-free product.
- Username existence becomes probeable by group admins. Accepted: the lookup is exact-match, admin-only, and yields the same information an invite attempt would anyway.
- Deleting consumed rows keeps one invite per user per group enforceable and makes re-invites trivial; it also means revoked and expired states are the only lingering statuses.
- Expiry and cleanup are lazy. An invite nobody re-opens can linger as `pending` until the next re-invite attempt resets it; with rows scoped to a group and a 7-day expiry this is acceptable and avoids a scheduler.
- The join page, service layer, and API layering are extended rather than duplicated: one extra table, one extra token branch, and the existing accept/decline UI patterns.
- No email or push notification is sent; the invitee learns of an invite on their next inbox load, consistent with join requests today.

## Alternatives considered

- **Status-only lifecycle** (persist `accepted`/`declined`/`expired` rows): rejected — a consumed invite carries no value, and keeping rows would require a partial unique index to permit a fresh re-invite.
- **Silent lookup** ("invite sent" regardless of whether the username exists): rejected — typo detection and honest admin feedback were judged more valuable than hiding username existence.
- **Direct membership without acceptance**: rejected — grants access without consent and bypasses the consent model join requests already establish.
- **Reusing `join_requests` or `invite_links` rows**: rejected — direct invites have different authorization (invitee-bound) and a different lifecycle; overloading existing tables would entangle three distinct flows.
- **Real-time inbox push**: deferred — invitees are outside the group's WebSocket scope, and the inbox already loads on page visit like join requests.
- **A public user search or contact import**: rejected — conflicts with the privacy-first, contact-free design.
