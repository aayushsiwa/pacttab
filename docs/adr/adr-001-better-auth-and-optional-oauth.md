# ADR 001: Better Auth with optional Google and GitHub sign-in

## Status

Accepted

## Context

PactTab began with a custom handle/password session implementation. We need optional Google and GitHub sign-in without requiring either provider, collecting contacts, or making a provider identity visible to group members.

The existing application data model references `users.id` throughout groups, expenses, chat, and settlements. Replacing those IDs or keeping two unrelated identity systems would make migration and authorization error-prone.

Better Auth also requires an email field on credential accounts, which forces a decision about local handle-and-password accounts that have no email by design.

## Decision

- Use Better Auth with the existing PostgreSQL/Drizzle database.
- Preserve the existing `users.id` as Better Auth's user identity, extending the current table and adding `accounts` and `verifications`.
- Keep the legacy session helpers during the staged cutover; session lookup recognizes both existing sessions and Better Auth sessions.
- **Gate providers with one server-only module.** `src/lib/social-auth-config.ts` is the single source of truth: a provider is active only when its client ID and client secret are both non-empty, with no global feature flag. The module exposes secret-bearing configuration to server code only and a safe `{ id, label }` list for UI, so provider buttons appear only for fully configured providers without leaking credentials into client bundles. Each provider is evaluated independently; with every credential blank, the deployment is handle/password-only.
- Keep handle/password sign-in available. For Better Auth compatibility, local accounts use an internal `<handle>@pacttab.local` email that is never displayed, emailed, exported, or used for a group identity.
- Provisionally name an OAuth user until they choose a PactTab handle; group-facing UI uses only the PactTab handle — never a provider display name, email, avatar, or token.
- Request the smallest practical scopes: Google `openid email profile`, GitHub `read:user user:email`. No contact upload, no repository access, and no offline access without a real feature need. Provider tokens are treated as sensitive and never exposed to clients or logs.
- Link Google or GitHub only explicitly from authenticated account settings. Never merge a provider identity into an account merely because emails match; automatic linking for verified provider emails requires prior evidence and a security review.
- Explain before redirecting that the provider may share an email and basic profile with PactTab, and preserve `returnTo` through OAuth state with server-side validation to prevent open redirects.
- Public copy must not claim "zero personal data" once OAuth is enabled; use "No email required — use a PactTab handle and password, or optionally connect Google or GitHub."

## Consequences

- Existing foreign keys remain valid because user IDs do not change.
- Self-hosters can leave every OAuth credential blank and retain a handle/password-only deployment, including hidden provider buttons.
- OAuth provider email is authentication data, so PactTab must no longer claim that all users provide zero personal data.
- The privacy promise is precise rather than absolute: a synthetic local email, and possibly a provider email, exist only in the authentication layer — neither is ever used for communication or shown to groups.
- Deployment requires running the generated Drizzle migration before enabling providers.
- The staged bridge must be removed after local credentials and sessions are fully migrated to Better Auth.
- Deferred open decisions: long-term retention of provider email (prefer minimum retention, used only for account matching); whether a user may unlink their last provider (an account must never be left with no sign-in path); provider avatars are not imported.

## Alternatives considered

- **Custom OAuth implementation:** rejected because Better Auth already provides provider, account, callback, and session handling.
- **Separate Better Auth user table:** rejected because it would require mapping or rewriting every existing user foreign key.
- **Always require OAuth:** rejected because it conflicts with PactTab's privacy-first and self-hostable design.
- **Auto-linking by matching provider email:** rejected for launch because explicit linking from authenticated settings prevents account takeover via provider email churn.
- **Using the provider display name or email as the PactTab handle:** rejected because group identity must remain the user-chosen, stable handle.
- **A global feature flag for social sign-in:** rejected because per-provider credential presence is sufficient state and avoids a second configuration mechanism.
- **Importing provider avatars or contacts:** rejected because both add exposure with no group-facing value.

## References

- [Better Auth social sign-on](https://better-auth.com/docs/basic-usage)
- [Better Auth OAuth and account linking](https://better-auth.com/docs/concepts/oauth)
- [Better Auth users and accounts](https://better-auth.com/docs/concepts/users-accounts)
- [Better Auth database model and migrations](https://better-auth.com/docs/concepts/database)
