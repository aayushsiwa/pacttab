# MVP: Private Group Expenses & Chat

## Product summary

A privacy-first progressive web app for small, closed groups to chat, track shared expenses, and settle balances. People sign up using only a username and password—no email, phone number, contact syncing, or public discovery.

The product is for flatmates, trips, friend groups, couples, and small teams that want a simple shared tab without handing over their address book or personal details.

## Problem

Existing expense-splitting apps often require personal information, build social graphs, and include more financial features than a small group needs. They can feel excessive for a private trip, household, or event.

Users need a lightweight private space where they can:

- Invite only the people relevant to a group
- Discuss plans and expenses in one place
- Record who paid and who owes what
- Settle up without complicated financial workflows

## MVP goal

Validate that closed groups will use a simple private app to coordinate spending and conversation.

The MVP should let a group go from creation to a settled balance in a few minutes.

## Target users

- Flatmates splitting household costs
- Friends organizing a trip or event
- Couples managing shared purchases
- Small informal teams sharing event costs

## Core user flow

1. A person creates an account with a unique username and password.
2. They create a private group.
3. They generate an invite link and share it with the intended people.
4. Invitees sign in or create an account, then join the group through that link.
5. Group members chat and add shared expenses.
6. The app calculates balances and suggested settlements.
7. Members record a settlement when someone pays another member.

## MVP features

### Accounts

- Username and password sign-up
- Sign-in and sign-out
- Optional Google and GitHub sign-in, enabled per provider only when its credentials are configured (see `docs/adr/adr-001-better-auth-and-optional-oauth.md`)
- Secure password hashing and cookie-based sessions
- No email address, phone number, contact importing, or public user search
  (local accounts never need an email; an optional provider may share a provider email with the auth layer only — it never appears in groups; group admins may look up an exact username solely to send a private direct invite — see `docs/adr/adr-002-direct-invites-by-username.md`)
- Clear notice: passwords cannot be recovered in the MVP
- Account deletion erases personal details and replaces the handle with an anonymised label, so shared group history is preserved; it is refused while the member owes or is owed money in any group (see `docs/adr/adr-004-anonymising-account-deletion-and-non-destructive-foreign-keys.md`)
- Optional one-time recovery codes can be added after the initial release

### Private groups

- Create a group with a name and optional description
- Group roles:
  - Admin: manages group settings, people, and invites
  - Member: chats, adds expenses, and records settlements
- Only group members can view its messages, expenses, and balances
- Groups are not publicly searchable
- Leaving requires an exactly zero balance. An admin must promote another active member to admin before leaving; the last active admin cannot leave at all — deleting the group is the only way to close it

### Invites and join approval

- Admins can create a unique invite link for a group
- A valid invite lets an authenticated user join immediately
- Admins can revoke an invite link
- Invite links use long, random, unguessable tokens
- A person without a valid invitation cannot browse or join a group
- If a future shared group reference creates a join request, it remains pending until an admin approves or declines it

For the initial MVP, a direct invite link is the only practical join path. Join requests can be included as a small admin queue if there is a way for non-members to submit them without exposing group data.

### Group chat

- Text messages in each group
- Chronological message list
- Messages show username and timestamp
- System activity messages, such as:
  - “Maya added Dinner — ₹1,200”
  - “Arjun recorded a settlement of ₹600 to Maya”
- No direct messages, reactions, image uploads, threads, read receipts, or notifications in the first version

### Expenses

- Add an expense with:
  - Description
  - Amount
  - Person who paid
  - Date
  - Participants
  - Split method
- Support equal splits first
- Support custom exact amounts if implementation remains simple
- Edit or delete an expense created by the member
- Show an activity record when expenses change

### Balances and settlements

- Show each member’s net balance:
  - Positive: is owed money
  - Negative: owes money
- Show simplified suggested repayments
- Keep departed members in the balance math as ghosts so the ledger stays zero-sum; a member may only leave with an exact-zero balance
- Record a settlement: payer, recipient, amount, and date
- Settlements update balances but do not process payments
- No bank integrations, wallets, payment collection, exchange rates, or recurring expenses in the MVP

## Non-goals

The MVP explicitly does not include:

- Email or phone verification
- Password recovery by email
- Social discovery or contact syncing
- Public groups
- Direct messages
- Media sharing
- Push notifications
- Payment processing
- Multiple currencies
- Receipt scanning
- Recurring bills
- Advanced split rules such as percentages, shares, or itemized receipts
- Native mobile apps

## Privacy principles

- Collect the minimum information: username and password for local accounts
- Never request contacts, a phone number, or a required email address; optional Google/GitHub sign-in exposes only the provider's minimal scopes to the authentication layer (see `docs/adr/adr-001-better-auth-and-optional-oauth.md`)
- Make groups private by default and permanently non-discoverable
- Use opaque random identifiers for invite links
- Never expose a group’s membership, messages, or expenses to non-members
- Group deletion and account deletion are available from settings; account deletion anonymises the member instead of erasing shared history
- Avoid behavioral advertising and unnecessary third-party tracking

## Technical approach

- Framework: Next.js 16 (App Router), full-stack application
- PWA: web manifest, installable experience, mobile-first responsive UI, basic offline shell
- Authentication: Better Auth with username/password credentials (CSR login/signup via fetch), plus optional Google/GitHub sign-in gated by credential presence (see `docs/adr/adr-001-better-auth-and-optional-oauth.md`)
- Database: PostgreSQL
- ORM: Drizzle ORM
- Client Data: TanStack Query v5 for all client-side data fetching, optimistic updates, cache
- Hosting: Vercel or Railway for the app, managed PostgreSQL through Neon, Supabase, or Railway
- Real-time updates: WebSockets with Redis Pub/Sub and group `@mention` autocomplete

## Core data entities

```text
User
  id, username, passwordHash, createdAt
  email (internal, non-deliverable for local accounts; provider email for OAuth — ADR 001)
  on deletion: username replaced with a tombstone label, personal fields cleared — ADR 004

Group
  id, name, description, createdBy, createdAt

GroupMember
  id, groupId, userId, role, status, joinedAt
  status is "inactive" once a member leaves; the row is kept so their history stays in the ledger

InviteLink
  id, groupId, token, createdBy, expiresAt, maxUses, useCount, revokedAt

JoinRequest
  id, groupId, userId, status, reviewedBy, reviewedAt

Message
  id, groupId, authorId, body, type, createdAt

Expense
  id, groupId, description, amount, paidByUserId, expenseDate, createdBy, createdAt

ExpenseSplit
  id, expenseId, userId, owedAmount

Settlement
  id, groupId, paidByUserId, receivedByUserId, amount, settledAt, createdAt
```

## Success criteria

A successful MVP allows a new user to:

1. Create an account in under one minute.
2. Create a group and share an invite link.
3. Have another person join privately.
4. Add an equal-split expense.
5. See an accurate balance.
6. Record a settlement.
7. Use group chat alongside the financial activity without leaving the app.

## Suggested release sequence

### Release 1 (Shipped)

Authentication, private groups, direct invite links, equal-split expenses, balances, settlements, and basic group chat.

### Release 2 (Shipped)

- Invite expiry, usage limits, custom invite tokens, and revoke/rotate actions
- Admin join-request queue with pending status chips for requesters & notification indicators for admins
- Custom splits (exact amounts per participant) alongside equal splits
- Settlement affirmation workflow (payer records, receiver affirms/disputes)
- Real-time WebSockets with Redis pub/sub and group `@mention` autocomplete
- Installable PWA with offline fallback shell and manifest
- Automated test coverage via Vitest

### Release 3 (Shipped)

- Direct invites by exact username for group admins (see `docs/adr/adr-002-direct-invites-by-username.md`)
- Optional Google and GitHub sign-in with server-side provider gating (see `docs/adr/adr-001-better-auth-and-optional-oauth.md`)
- Group deletion and account deletion from settings (account deletion anonymises the member so other members' history survives)

### Release 4 (Planned)

Offline expense drafts, external push notifications, attachments/receipt uploads, recurring expenses, multiple currencies, Web MCP (Model Context Protocol) agent connectivity ([POC](docs/pocs/web-mcp/README.md)), and optional payment-link integrations.
