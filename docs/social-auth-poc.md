# POC: Optional Google and GitHub Sign-In

## Summary

This POC adds Google and GitHub as **optional** sign-in providers through Better Auth. PactTab's existing handle-and-password flow stays the default and remains usable without an email address, phone number, contact upload, or third-party identity.

The purpose is convenience, not identity collection. People who prefer a familiar sign-in flow may connect Google or GitHub; everyone else can continue using a local PactTab account.

## Product Principles

- Keep handle + password as the privacy-first default.
- Never require a social provider to create, join, or use a group.
- Request the smallest practical scopes: Google `openid email profile`; GitHub `read:user user:email` only when needed to identify the account.
- On first provider sign-in, require a unique PactTab handle. Groups show that handle, never provider email or profile name.
- Explain before redirecting that the provider may share an identity-linked email and basic profile with PactTab.
- Do not upload contacts, request repository access, or use provider tokens beyond authentication.
- Treat provider tokens as sensitive: encrypt at rest if retained, request no offline access without a real feature need, and never expose them to clients or logs.

## Local credential identity

Better Auth requires an email field for credential accounts. PactTab's local handle-and-password accounts will receive an internal, non-deliverable value of the form `<normalized-handle>@pacttab.local`. It exists only for Better Auth account lookup: it is never displayed, emailed, exported, or used as a group identity. Google and GitHub users retain their provider email solely in the authentication layer; group UI continues to use the PactTab handle.

## Why This Was a Migration, Not Just Two Buttons

PactTab originally owned authentication through custom `users` and `sessions` tables, bcrypt password hashes, and a `splitwise_session` cookie. Better Auth is now the active authentication system; this migration has been carried out and the custom session layer retired.

Better Auth social sign-in requires an auth route, Better Auth session handling, and `user`, `session`, `account`, and `verification` data. Existing groups, expenses, messages, and invites reference current user IDs. The POC must preserve those IDs or migrate every foreign-key reference transactionally.

## Proposed Architecture

### 1. Gate providers with one server-only configuration module

`src/lib/social-auth-config.ts` is the single source of truth for whether a provider is enabled. A provider is available only when:

1. its client ID and client secret are both non-empty.

The module returns secret-bearing configuration only to server code and exposes a separate safe `{ id, label }` representation for UI. This lets login/sign-up controls appear only for fully configured providers without leaking credentials into client bundles.

### 2. Use Better Auth as the single auth authority

Create Better Auth server configuration and mount its Next.js catch-all handler at `/api/auth/[...all]`. Configure the existing PostgreSQL/Drizzle database with:

```ts
socialProviders: {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  },
}
```

Set `BETTER_AUTH_URL` to the canonical public URL. Register these callback URLs with both providers:

```text
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/callback/github
https://<production-domain>/api/auth/callback/google
https://<production-domain>/api/auth/callback/github
```

### 3. Preserve handle-based PactTab identity

The Better Auth user record needs the existing `username` field, including its uniqueness and validation rules. Never make a provider display name the PactTab handle automatically.

For a new social account:

1. Complete the OAuth callback.
2. Create a provisional authenticated record.
3. Redirect to a protected “choose your PactTab handle” page.
4. Validate and persist the handle.
5. Redirect to the original safe `returnTo` destination, including a group invite when applicable.

Do not put provider email, real name, avatar, or access token into group-facing payloads.

### 4. Migrate local credentials and sessions deliberately

Before enabling providers, rehearse a one-time migration that:

- creates Better Auth-compatible credential accounts for current local users while retaining their IDs where the adapter permits;
- migrates or intentionally invalidates existing sessions during a documented maintenance window;
- preserves every foreign-key relationship to users;
- keeps local credentials enabled after migration;
- is idempotent and has a tested backup/restore procedure.

Do not run two independent production session systems. Make a single cutover and retire `splitwise_session` with the custom auth helpers.

### 5. Start with explicit account linking

Initially, users link Google or GitHub only from authenticated account settings. Do **not** merge a provider identity into a local account merely because their emails match.

After explicit linking is proven, automatic linking may be considered only for verified provider emails and after a security review. Provider-linking changes need a recent authenticated session and confirmation screen.

## UI Copy and Consent

Keep local sign-in first. Under a divider, show:

> Prefer a familiar sign-in? Continue with Google or GitHub. Connecting a provider may share your email and basic profile with PactTab. It is optional.

Use “Continue with Google” and “Continue with GitHub.” Preserve `returnTo` via OAuth state/callback handling and validate it server-side to prevent open redirects.

Public copy must not call PactTab “zero personal data” once OAuth is enabled. Use:

> No email required. Use a PactTab handle and password, or optionally connect Google or GitHub if you are comfortable sharing provider identity details.

## Configuration

These settings are present in `.env.example`:

```env
BETTER_AUTH_SECRET="generate-a-long-random-secret"
BETTER_AUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
```

Leave both credential pairs empty to hide every provider. Google and GitHub are evaluated independently, so each provider remains hidden unless its own client ID and secret are both set. This keeps self-hosted handle-and-password-only deployments fully local and prevents partially configured buttons from being shown.

## Rollout Plan

1. Build Better Auth configuration, schema, and a migration rehearsal in a disposable database.
2. Add local-credential compatibility and verify all user-ID relationships.
3. Add Google in development, then GitHub, using separate development and production OAuth applications.
4. Implement handle selection, safe return paths, and explicit linking.
5. Render provider buttons and consent copy only from the enabled-provider configuration.
6. Test in staging: new and existing users, invitations, account linking/unlinking, sign-out, and disabled providers.
7. Back up production, migrate, enable the providers, and monitor auth failures without logging tokens or profile data.

## Acceptance Criteria

- Local handle/password registration and sign-in continue to work.
- Google and GitHub only appear when configured.
- New provider users choose a unique PactTab handle before accessing groups.
- Provider identity fields never appear in group UI or exported data.
- Existing user IDs and related data survive migration.
- Initial account linking is explicit.
- Callback and `returnTo` handling reject untrusted destinations.
- Tests cover local credentials, both providers, handle selection, linking, invitation redirects, and disabled providers.

## Open Decisions

- Whether provider email is retained long-term or only used for Better Auth matching; prefer minimum retention.
- Whether a user may unlink their last provider while retaining a local password; never leave an account with no sign-in path.
- Whether provider avatars are worth the additional exposure; POC recommendation: do not import them.

## References

- [Better Auth social sign-on](https://better-auth.com/docs/basic-usage)
- [Better Auth OAuth and account linking](https://better-auth.com/docs/concepts/oauth)
- [Better Auth users and accounts](https://better-auth.com/docs/concepts/users-accounts)
- [Better Auth database model and migrations](https://better-auth.com/docs/concepts/database)
