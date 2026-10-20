import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { accounts, users } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { POST } from "../src/app/api/auth/delete-account/route";

const testRunId = crypto.randomBytes(4).toString("hex");
const password = "MemberPassword123!";

const account = { id: crypto.randomUUID(), username: `da_account_${testRunId}` };
const other = { id: crypto.randomUUID(), username: `da_other_${testRunId}` };

function deleteRequest(body: unknown = { password }) {
  return new Request("http://localhost/api/auth/delete-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeAll(async () => {
  await db.insert(users).values([account, other]);

  const hash = await hashPassword(password);
  await db.insert(accounts).values([
    {
      id: crypto.randomUUID(),
      accountId: account.id,
      providerId: "credential",
      userId: account.id,
      password: hash,
    },
    {
      id: crypto.randomUUID(),
      accountId: other.id,
      providerId: "credential",
      userId: other.id,
      password: hash,
    },
  ]);
});

afterAll(async () => {
  await db.delete(accounts).where(eq(accounts.userId, account.id));
  await db.delete(accounts).where(eq(accounts.userId, other.id));
  await db.delete(users).where(eq(users.id, account.id));
  await db.delete(users).where(eq(users.id, other.id));
});

beforeEach(() => {
  delete process.env.TEST_CURRENT_USER_ID;
});

afterEach(() => {
  delete process.env.TEST_CURRENT_USER_ID;
});

describe("delete account route layering", () => {
  it("answers 401 when the request is signed out", async () => {
    const response = await POST(deleteRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("answers 401 when the password is wrong", async () => {
    process.env.TEST_CURRENT_USER_ID = account.id;

    const response = await POST(deleteRequest({ password: "WrongPassword123!" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Incorrect password." });

    const [row] = await db.select().from(users).where(eq(users.id, account.id));
    expect(row.username).toBe(account.username);
  });

  it("answers 400 for a malformed body", async () => {
    process.env.TEST_CURRENT_USER_ID = account.id;

    const response = await POST(deleteRequest("not-json"));

    expect(response.status).toBe(400);
  });

  it("deletes the account and answers 200 on success", async () => {
    process.env.TEST_CURRENT_USER_ID = other.id;

    const response = await POST(deleteRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    const [row] = await db.select().from(users).where(eq(users.id, other.id));
    expect(row.username).toMatch(/^deleted_/);
  });
});
