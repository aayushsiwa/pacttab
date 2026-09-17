# Proof of Concept (POC): End-to-End Group Encryption for PactTab

## 1. Executive Summary

This document outlines the architecture, design, and proof-of-concept (POC) plan for introducing **end-to-end group encryption (E2EE)** into **PactTab**.

PactTab's core premise is privacy — zero emails, zero phone numbers, zero trackers, self-hostable, open source. Today, that privacy protects **who you are**, but not the **content you store**: expense descriptions, chat messages, and settlement notes use case sit in PostgreSQL as plaintext and are readable by anyone who can access the database (hosting provider, compromised host, or database exporter).

By implementing E2EE, PactTab will extend its privacy promise from "we don't collect your identity" to **"we cannot read what you and your friends wrote"**:

1. **At-rest confidentiality**: Chat messages, expense descriptions, and other free-text content are encrypted before they leave the client.
2. **Per-group isolation**: Each group has an independent group encryption key (GEK); no two groups share material.
3. **Self-hosted threat model**: Even the operator of a PactTab instance cannot decrypt content — the keys never touch the server in plaintext.

This POC intentionally ships a **single, well-scoped vertical slice** (group chat + expense descriptions) to validate the cryptography, key ceremonies, and client integration before broad adoption across the schema.

---

## 2. Goals & Non-Goals

### Goals

- Encrypt message bodies (`messages.body`) and expense descriptions (`expenses.description`) at rest using AES-256-GCM under a per-group key.
- Keep the **privacy architecture** — no email, phone, or address book — while enabling key management **in-band** (friends already share a group invite link + password).
- Granular key testing and migration paths with **zero downtime** for existing groups.
- Provide forward secrecy when a member leaves: rotate the group key and re-wrap for remaining members.

### Non-Goals (for this POC)

- **Encrypting numeric data** (amounts, splits, balances). Server-side balance computation and settlement-netting need plaintext numerics; encrypting them would require homomorphic or client-side-only ledger math, which is out of scope.
- **Encrypting group names / member handles**. These are needed server-side for rendering and search.
- **Photos / attachments**. PactTab currently has no media pipeline; when/if added, files follow the same GEK scheme.
- **Full zero-knowledge against a malicious operator who captures passwords**. The POC uses password-derived key wrapping (see Threat Model below); stopping even that requires an out-of-band key ceremony, which is documented as a future hardening path.
- **Web of trust / key verification UX** (fingerprint comparison, QR scanning) — noted as post-POC polish.

---

## 3. Threat Model

The POC targets the following classes of adversary:

| Adversary                                                     | Capability                      | Protected? |
| :------------------------------------------------------------ | :------------------------------ | :--------- |
| Database dumper / breached host / backup leak                 | Reads all rows                  | **Yes**    |
| PactTab instance operator (observer only, not at login)       | Reads all rows, logs queries    | **Yes**    |
| Other group members (non-admin read/write)                    | Reads group DB rows             | **Yes**    |
| PactTab operator that intercepts plaintext passwords at login | Can derive wrapped private keys | **No** ⚠️  |

**Honest limitation**: Because members sign in with a username + password that the server sees, private keys wrapped under a password-derived key are derivable by a server that captures the login password. E2EE therefore provides **confidentiality at rest and against database compromise**, but a determined operator can still recover content. This is acceptable for the POC and is the same trust level most password-based E2EE apps accept; the "zero-trust operator" follow-up is an out-of-band key ceremony (Sec. 10).

Threat assumptions:

1. Web Crypto (SubtleCrypto) is available in the target environment (all modern browsers + installed PWA).
2. TLS 1.2+ in transit; no HTTP fallback.
3. The server never stores or logs the plaintext private key or any _unwrapped_ group key.
4. Nonces/IVs are generated fresh per encryption with `crypto.getRandomValues`; GCM collision avoidance requires no nonce reuse under the same key.

---

## 4. Cryptographic Design

### 4.1 Key Hierarchy

```
┌────────────────────────────────────────────────────────────┐
│                    Per-Member Identity Keys                 │
│                                                            │
│  AccountPassword ──(PBKDF2-SHA256)→ KEK (256-bit)           │
│  KEK ─(AES-256-GCM)→ wraps  PrivateKey (Ed25519 / ECDH)     │
│  PublicKey  = stored plaintext on `user_keys`               │
│  EncryptedPrivateKey = stored on `user_keys`                │
└────────────────────────────────────────────────────────────┘
                    │
                    │ wrap / unwrap via ECDH (X25519) or
                    │ direct AES-KW with shared secret
                    ▼
┌────────────────────────────────────────────────────────────┐
│                    Group Keys (per group)                   │
│                                                            │
│  GroupEncryptionKey (GEK) = random 256-bit AES key          │
│  GEK_wrapped[member] = wrap(GEK, memberPublicKey)           │
│   stored on `group_key_wraps` (one row per member/version)  │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│              Encrypted Content (AES-256-GCM)                │
│  messages.body         → ciphertext + iv                    │
│  expenses.description  → ciphertext + iv                    │
│  store: key_version for rotation awareness                  │
└────────────────────────────────────────────────────────────┘
```

### 4.2 Primitives (WebCrypto / SubtleCrypto)

| Purpose             | Algorithm                                                                                                                      |
| :------------------ | :----------------------------------------------------------------------------------------------------------------------------- |
| Identity keypair    | `ECDH` P-256 (`X25519` unsupported in some browsers — P-256 is the POC-safe choice)                                            |
| Key wrapping        | `AES-GCM` with the ECDH-derived shared secret, or `AES-KW` (`wrapKey`/`unwrapKey`)                                             |
| Private key at rest | `AES-GCM` 256-bit, wrapped with KEK                                                                                            |
| Password KDF        | `PBKDF2-SHA256` (WebCrypto-native); **Argon2id is the requested future upgrade** — needs WASM (`@noble/hashes` or `hash-wasm`) |
| Content encryption  | `AES-GCM` 256-bit, 96-bit IV generated per operation                                                                           |

All key material is stored as **base64url-encoded JWK** in PostgreSQL `text` columns so it round-trips cleanly through `crypto.subtle.importKey`/`exportKey`.

### 4.3 Key Versions

Every wrapped GEK and every ciphertext carries a `key_version` integer. On any member removal (or an explicit "re-encrypt group" admin action), a **new GEK is generated** (version++) and re-wrapped for each surviving member. Old ciphertexts are re-encrypted lazily on read or by a background sweep; readers always attempt the current version first and fall back to historical versions for in-flight data.

---

## 5. Data Model / Schema Changes

New tables (`src/db/schema.ts` + a Drizzle migration):

```typescript
// Per-user identity keys
export const userKeys = pgTable("user_keys", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  publicKeyJwk: text("public_key_jwk").notNull(), // { crv, kty, x, y }
  encryptedPrivateKeyJwk: text("encrypted_private_key_jwk").notNull(), // AES-GCM wrapped
  kdfSalt: text("kdf_salt").notNull(), // base64url, 16 bytes
  kdfIterations: integer("kdf_iterations").notNull().default(310_000),
  keyVersion: integer("key_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Group key wraps — one row per (member, current GEK version)
export const groupKeyWraps = pgTable(
  "group_key_wraps",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wrappedGroupKey: text("wrapped_group_key").notNull(), // base64url AES-GCM/AES-KW blob
    keyVersion: integer("key_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("group_key_wrap_unique_idx").on(table.groupId, table.userId, table.keyVersion),
  ]
);
```

Column changes to existing tables (backward-compatible: plaintext columns retained during rollout):

| Table      | New columns                                                                               | Semantics                                                                                               |
| :--------- | :---------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| `groups`   | `current_key_version` `int` default 1                                                     | GEK version that new content should be encrypted under.                                                 |
| `messages` | `ciphertext` `text`, `iv` `text`, `key_version` `int`                                     | Null while the group encrypts; once enabled, `body` is set to `NULL` and content lives in `ciphertext`. |
| `expenses` | `description_ciphertext` `text`, `description_iv` `text`, `description_key_version` `int` | Same pattern for `description`.                                                                         |

Migration strategy: additive columns + a `flags` column (or a `group_settings` row) holding `encryption_enabled bool`. Clients check the flag and switch write paths; a data sweep re-encrypts history in the background.

---

## 6. Key Ceremonies

### 6.1 Account Register / First Login

1. Client derives `KEK = PBKDF2(password, salt, 310k iters, SHA-256)`.
2. Client generates `ECDH P-256` keypair; wraps the private key with KEK (AES-GCM).
3. Server stores `public_key_jwk`, `encrypted_private_key_jwk`, `kdf_salt` on `user_keys`.
4. A re-login on a **new device** cannot decrypt the private key without the password — same password ⇒ same KEK ⇒ same keys. **Changing the password MUST re-wrap the private key** (and, as a follow-up, re-wrap every GEK the user holds — see Sec. 10).

### 6.2 Group Creation

1. Creator's client generates a fresh `GEK` (random 256-bit AES key).
2. Wraps GEK with the creator's public key → `group_key_wraps` row (version 1).
3. Server records `groups.current_key_version = 1` and enables `encryption_enabled`.

### 6.3 Member Joins (Invite Link)

1. New member authenticates, unwraps their private key client-side.
2. Server (or client) wraps the **current GEK with the new member's public key** and inserts a `group_key_wraps` row.
   - **Design choice**: the GEK never appears server-side in plaintext. Two safe options:
     a. Existing member performs the re-wrap in their client and sends the wrapped GEK to the server (offline key ceremony — recommended).
     b. Server holds a **group escrow key** to facilitate re-wraps (reduces reliability but weakens the threat model; not for the POC default).
3. The new member decrypts `wrapped_group_key` with their private key and can now read/write group content.

### 6.4 Member Removal / Reset (Rotation)

1. Admin removes a member.
2. A surviving member (admin) generates a **new GEK**, re-wraps it for every surviving member, bumps `current_key_version`.
3. Old `group_key_wraps` for the removed member and the old version are deleted.
4. Content sweep re-encrypts old ciphertexts to the new version (lazy on-read fallback supported during transition).

---

## 7. Client Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      Next.js Client                         │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  keyStore.ts    │    │  groupCrypto.ts              │   │
│  │  · derive KEK   │───▶│  · unwrap GEK (member key)   │   │
│  │  · unwrap priv  │    │  · encrypt / decrypt content │   │
│  │  · cache (tab)  │    │  · nonce mgmt                │   │
│  └─────────────────┘    └──────────────┬───────────────┘   │
└───────────────────┬────────────────────┬────────────────────┘
                    │                    │
       register/login│        encrypt/decrypt payload
                    ▼                    ▼
┌────────────────────────────────────────────────────────────┐
│                   Server Actions / API                      │
│  registerUserKeys · saveWrappedGroupKey · rotateGroupKey    │
│  saveMessage (ciphertext) · listMessages (ciphertext)      │
└────────────────────────────────────────────────────────────┘
```

Key rules for the client module:

- **Zero plaintext persistence**: the private key and unwrapped GEK live only in an in-memory (module-scope) cache for the page session; never written to `localStorage`/`IndexedDB`.
- **Nonce uniqueness**: a monotonic counter or `crypto.getRandomValues` 96-bit IV per encryption; assert `key_version` on every decrypt.
- **Decrypt-on-read**: chat and expense views accept ciphertext rows, decrypt with the member's unwrapped GEK, and render locally.
- **Failure handling**: an undecryptable message renders as a "🔒 Locked — encryptable content requires your key" placeholder, never a crash.

---

## 8. Proof of Concept: Prototype Implementation

### 8.1 Private-key setup on register (`src/lib/crypto/user-keys.ts`)

```typescript
import { webcrypto } from "crypto";
const subtle = webcrypto.subtle;

export interface UserKeyMaterial {
  publicKeyJwk: JsonWebKey;
  encryptedPrivateKey: string; // base64url(AES-GCM(KEK, privKey))
  kdfSalt: string; // base64url, 16 bytes
}

export async function generateUserKeys(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 310_000;

  const baseKey = await subtle.importKey("raw", enc(password), "PBKDF2", false, ["deriveKey"]);
  const kek = await subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );

  const pair = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const publicKeyJwk = await subtle.exportKey("jwk", pair.publicKey);

  // Wrap the private key with the KEK (AES-GCM via wrapKey is not available for symmetric
  // -> use explicit encrypt of the exported private JWK instead)
  const privateJwk = await subtle.exportKey("jwk", pair.privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv },
    kek,
    enc(JSON.stringify(privateJwk))
  );

  return {
    publicKeyJwk,
    encryptedPrivateKey: b64url(ciphertext) + "." + b64url(iv),
    kdfSalt: b64url(salt),
    kdfIterations: iterations,
  } satisfies UserKeyMaterial;
}
```

### 8.2 Group-key wrap on member join (`src/lib/crypto/group-crypto.ts`)

```typescript
export async function wrapGroupKeyForMember(
  groupKey: CryptoKey, // AES-GCM 256 (the GEK)
  memberPublicKey: JsonWebKey
): Promise<string> {
  const spki = await subtle.importKey(
    "jwk",
    memberPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const ephemeral = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveKey",
  ]);
  const shared = await subtle.deriveKey(
    { name: "ECDH", public: spki },
    ephemeral.privateKey,
    { name: "AES-KW", length: 256 },
    true,
    ["wrapKey"]
  );
  const wrapped = await subtle.wrapKey("raw", groupKey, shared, { name: "AES-KW" });
  return b64url(new Uint8Array(wrapped));
}
```

### 8.3 Content encryption (chat message)

```typescript
export async function encryptGroupContent(
  plaintext: string,
  groupKeyRaw: Uint8Array
): Promise<{ ciphertext: string; iv: string }> {
  const key = await subtle.importKey("raw", groupKeyRaw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, enc(plaintext));
  return { ciphertext: b64url(new Uint8Array(ct)), iv: b64url(iv) };
}
```

### 8.4 Server action — attach wrapped key on join (`src/actions/group-encryption.ts`)

```typescript
"use server";

import { db } from "@/db";
import { groupKeyWraps } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function attachWrappedGroupKey(input: {
  groupId: string;
  memberUserId: string;
  wrappedGroupKey: string; // produced client-side by an existing member
  keyVersion: number;
}) {
  // Authorization: current user must be an active, non-removed member
  // (this is enforced by getServerSession + membership check in the caller)

  await db.insert(groupKeyWraps).values({
    id: crypto.randomUUID(),
    groupId: input.groupId,
    userId: input.memberUserId,
    wrappedGroupKey: input.wrappedGroupKey,
    keyVersion: input.keyVersion,
  });

  revalidatePath(`/groups/${input.groupId}`);
  return { ok: true };
}
```

### 8.5 Message write path (Client → Server)

1. Unwrap GEK from `group_key_wraps[me].wrappedGroupKey`.
2. `encryptGroupContent(body, geK)` → `{ ciphertext, iv }`.
3. Call `sendMessage({ ciphertext, iv, keyVersion })`; server inserts into `messages(ciphertext, iv, key_version)` and `body = NULL`.
4. WebSocket hub (`src/lib/ws-hub.ts`) broadcasts the ciphertext row to all online members; each client decrypts on receipt.

---

## 9. Performance & UX Considerations

- **PBKDF2 at 310k iterations** costs ~40–80 ms on modern hardware. Run it once per page load, cache the unwrapped GEK per group in module state, and reuse for the whole session.
- **Batching**: decrypt a page of 25 messages in a single `Promise.all` to avoid layout jank; keep a small in-memory LRU of decrypted rows per group.
- **Offline/PWA**: the service worker must cache **ciphertext**, never plaintext; decryption happens in the live window only.
- **Latency**: encryption/decryption of a chat message is sub-millisecond with a cached key; no perceptible cost.
- **Onboarding**: existing (plaintext) groups stay readable — E2EE is opt-in per group; new groups default to encrypted once the feature flag ships.

---

## 10. Future Hardening & Out-of-Scope Ideas

- **Out-of-band key ceremony**: let one member encrypt the GEK to the new member off the server (a one-time "key handoff" code shown in-person or in a private channel) → closes the "operator captures login password" hole.
- **Argon2id** over PBKDF2 via WASM for stronger KDF resistance.
- **Fingerprint / QR key verification** so members can confirm the group key matches (MITM protection between members).
- **Encrypted attachments**: same GEK wrapping, files encrypted before upload to storage.
- **Password-change re-wrap flow**: re-wrap the user's private key and every held GEK wrap on password change.

---

## 11. Implementation Milestones

| Phase       | Objective                           | Deliverables                                                                                                  | Est. Effort |
| :---------- | :---------------------------------- | :------------------------------------------------------------------------------------------------------------ | :---------- |
| **Phase 1** | **Crypto Core**                     | `user-keys.ts`, `group-crypto.ts`, unit tests for wrap/unwrap/encrypt/decrypt and IV uniqueness.              | 2 days      |
| **Phase 2** | **Schema & Migration**              | Drizzle migration for `user_keys`, `group_key_wraps`, additive ciphertext columns; backward-compatible reads. | 1 day       |
| **Phase 3** | **Key Ceremonies**                  | Register/user-key setup, group-create GEK, join re-wrap, remove→rotate server actions + client wiring.        | 3 days      |
| **Phase 4** | **Chat + Expense Encryption Slice** | Encrypt/decrypt on send/receive for messages and expense descriptions; locked-placeholder UX.                 | 3 days      |
| **Phase 5** | **Verification & Tests**            | Vitest crypto suite + an integration test proving a DB dump yields no plaintext message bodies.               | 1 day       |

---

## 12. Success Criteria

1. **At-rest confidentiality**: Running `pg_dump` on a live instance yields **zero** plaintext message bodies or expense descriptions for any group with encryption enabled.
2. **Round-trip integrity**: A message sent in group A is only decryptable by members of group A; a cross-group test with swapped keys must fail to decrypt (GCM auth tag rejection).
3. **Ceremony correctness**: (a) adding a member lets them read all history; (b) removing a member, then restricting the old key, denies them any future content (rotation works); (c) key rotation leaves no readable old ciphertext after the sweep.
4. **No plaintext leakage in logs or cache**: the test suite asserts outgoing payloads, Next.js server logs, and the service-worker cache contain only ciphertext frames.
5. **Feature-parity for existing users**: plaintext groups keep working unchanged; encryption is a per-group opt-in with no forced migration.
