# ADR 001: Better Auth with optional Google and GitHub sign-in

## Status

Accepted

## Context

PactTab began with a custom handle/password session implementation. We need optional Google and GitHub sign-in without requiring either provider, collecting contacts, or making a provider identity visible to group members.

The existing application data model references `users.id` throughout groups, expenses, chat, and settlements. Replacing those IDs or keeping two unrelated identity systems would make migration and authorization error-prone.

## Decision

- Use Better Auth with the existing PostgreSQL/Drizzle database.
- Preserve the existing `users.id` as Better Auth's user identity, extending the current table and adding `accounts` and `verifications`.
- Keep the legacy session helpers during the staged cutover; session lookup recognizes both existing sessions and Better Auth sessions.
- Configure Google and GitHub only when their respective client ID and secret are present. No global feature flag is required.
- Keep handle/password sign-in available. For Better Auth compatibility, local accounts use an internal `<handle>@pacttab.local` email that is never displayed or used for communication.
- Request social sign-in through Better Auth and expose provider buttons only from server-safe provider metadata.
- Provisionally name an OAuth user until they choose a PactTab handle; group-facing UI uses only the PactTab handle.

## Consequences

- Existing foreign keys remain valid because user IDs do not change.
- Self-hosters can leave every OAuth credential blank and retain a handle/password-only deployment.
- OAuth provider email is authentication data, so PactTab must no longer claim that all users provide zero personal data.
- Deployment requires running the generated Drizzle migration before enabling providers.
- The staged bridge must be removed after local credentials and sessions are fully migrated to Better Auth.

## Alternatives considered

- **Custom OAuth implementation:** rejected because Better Auth already provides provider, account, callback, and session handling.
- **Separate Better Auth user table:** rejected because it would require mapping or rewriting every existing user foreign key.
- **Always require OAuth:** rejected because it conflicts with PactTab's privacy-first and self-hostable design.
