# Auth CSR Refactor — Checklist

## 1. Cookie prerequisite: add `nextCookies()` plugin

- [x] Edit `src/lib/auth.ts` — import `nextCookies` from `better-auth/next-js`, append as last plugin in `plugins: [username({...}), nextCookies()]`

## 2. Shared logic module: `src/lib/auth-service.ts`

- [x] Create new file with pure functions:
  - [x] `signUpUser({ username, password, confirmPassword })` — Zod schema + duplicate-username/status mapping
  - [x] `signInUser({ username, password })`
  - [x] `signOutUser(requestHeaders)`
  - [x] `deleteUserAccount({ password }, requestHeaders)`
- [x] All return `{ ok: true } | { ok: false, error: string, username?: string }`
- [x] No `"use server"`, no `redirect()`

## 3. Route handlers (under `/api/auth/`)

- [x] `src/app/api/auth/login/route.ts` — POST, calls `signInUser`
- [x] `src/app/api/auth/signup/route.ts` — POST, calls `signUpUser`
- [x] `src/app/api/auth/logout/route.ts` — POST, calls `signOutUser`
- [x] `src/app/api/auth/delete-account/route.ts` — POST, calls `deleteUserAccount`
- [x] Each: `await headers()`, call service fn, `NextResponse.json(result, { status })`

## 4. Client components → `fetch`

- [x] `src/app/(auth)/login/login-form.tsx` — drop `useActionState`, use `useState` + `fetch` + `router.push`/`router.refresh`
- [x] `src/app/(auth)/signup/signup-form.tsx` — same pattern
- [x] `src/app/(auth)/login/page.tsx` — strip server `searchParams`/provider props, keep `Suspense`
- [x] `src/app/(auth)/signup/page.tsx` — same
- [x] `src/components/navbar.tsx` — `handleSignOut` → `fetch("/api/auth/logout")` + redirect
- [x] `src/components/user-settings-dialog.tsx` — `handleDeleteAccount` → `fetch("/api/auth/delete-account")`
- [x] `src/components/auth/social-sign-in-options.tsx` — read public flags internally, drop `providers` prop
- [x] Delete `src/actions/auth.ts`

## 5. Public social flags

- [x] Add `getPublicSocialAuthProviderOptions()` to `src/lib/social-auth-config.ts` reading `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` / `NEXT_PUBLIC_GITHUB_OAUTH_ENABLED`
- [x] Add both to `.env` (defaults `false`) and `.env.example`

## 6. Proxy rename (Next 16)

- [x] Rename `src/middleware.ts` → `src/proxy.ts`
- [x] Rename exported `middleware` → `proxy`
- [x] Keep `config.matcher` unchanged

## 7. Tests

- [x] `tests/auth-invite-flow.test.ts` — import `signUpUser` from `src/lib/auth-service.ts`, keep validation cases, assert `{ ok: true }` for success
- [x] `tests/social-auth-config.test.ts` — add cases for public-flags helper

## 8. Verify

- [x] `DATABASE_URL=... pnpm test:auth` (4 tests pass)
- [x] `pnpm test -- tests/social-auth-config.test.ts` (8 tests pass)
- [x] `pnpm lint` (passes)
- [x] `pnpm format:check` (passes)
- [x] `npx tsc --noEmit` (passes)
- [ ] Manual: login in browser → session cookie set → `/groups` reachable
