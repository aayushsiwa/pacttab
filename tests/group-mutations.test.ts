import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { groupMembers, groups, users } from "../src/db/schema";
import { POST } from "../src/app/api/groups/route";
import { DELETE, PATCH } from "../src/app/api/groups/[id]/route";
import { completeOnboardingAction } from "../src/actions/onboarding";

describe("group mutation APIs and onboarding authorization", () => {
  const adminId = randomUUID();
  const memberId = randomUUID();
  const onboardingId = randomUUID();
  const adminUsername = `admin_${adminId.slice(0, 8)}`;
  let groupId: string;

  const props = () => ({ params: Promise.resolve({ id: groupId }) });
  const request = (method: string, body?: unknown) =>
    new Request("http://localhost:3000/api/groups", {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  beforeAll(async () => {
    await db.insert(users).values([
      { id: adminId, username: adminUsername },
      { id: memberId, username: `member_${memberId.slice(0, 8)}` },
      { id: onboardingId, username: `temp_${onboardingId.slice(0, 8)}`, needsUsername: true },
    ]);
  });

  beforeEach(() => {
    delete process.env.TEST_CURRENT_USER_ID;
  });

  afterAll(async () => {
    delete process.env.TEST_CURRENT_USER_ID;
    await db.delete(groups).where(eq(groups.createdBy, adminId));
    await db.delete(users).where(inArray(users.id, [adminId, memberId, onboardingId]));
  });

  it("rejects unauthenticated mutations with JSON errors", async () => {
    for (const response of [
      await POST(request("POST", { name: "Trip" })),
      await PATCH(request("PATCH", { name: "Trip" }), props()),
      await DELETE(request("DELETE"), props()),
    ]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    }
  });

  it("requires onboarding before group mutations", async () => {
    process.env.TEST_CURRENT_USER_ID = onboardingId;
    expect((await POST(request("POST", { name: "Trip" }))).status).toBe(403);
    expect((await PATCH(request("PATCH", { name: "Trip" }), props())).status).toBe(403);
    expect((await DELETE(request("DELETE"), props())).status).toBe(403);
  });

  it("rejects malformed JSON and invalid group details", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;
    for (const mutate of [
      (input: Request) => POST(input),
      (input: Request) => PATCH(input, props()),
    ]) {
      expect(
        (
          await mutate(
            new Request("http://localhost:3000/api/groups", { method: "POST", body: "{" })
          )
        ).status
      ).toBe(400);
      for (const body of [
        null,
        {},
        { name: 42 },
        { name: " " },
        { name: "x".repeat(101) },
        { name: "Trip", description: 42 },
      ]) {
        expect((await mutate(request("POST", body))).status).toBe(400);
      }
    }
  });

  it("creates a persisted group and admin membership", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;
    const response = await POST(request("POST", { name: " Trip ", description: " Weekend " }));
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.success).toBe(true);
    groupId = result.groupId;
    expect(await db.select().from(groups).where(eq(groups.id, groupId))).toMatchObject([
      { name: "Trip", description: "Weekend", createdBy: adminId },
    ]);
    expect(
      await db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId))
    ).toMatchObject([{ userId: adminId, role: "admin" }]);
    await db.insert(groupMembers).values({ id: randomUUID(), groupId, userId: memberId });
  });

  it("rejects updates and deletion by a non-admin without changing the group", async () => {
    process.env.TEST_CURRENT_USER_ID = memberId;
    expect((await PATCH(request("PATCH", { name: "Unauthorized edit" }), props())).status).toBe(
      403
    );
    expect((await DELETE(request("DELETE"), props())).status).toBe(403);
    expect(await db.select().from(groups).where(eq(groups.id, groupId))).toMatchObject([
      { name: "Trip" },
    ]);
  });

  it("rejects settings updates and deletion by an inactive admin", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;
    await db
      .update(groupMembers)
      .set({ status: "inactive" })
      .where(eq(groupMembers.userId, adminId));
    try {
      expect((await PATCH(request("PATCH", { name: "Unauthorized edit" }), props())).status).toBe(
        403
      );
      expect((await DELETE(request("DELETE"), props())).status).toBe(403);
      expect(await db.select().from(groups).where(eq(groups.id, groupId))).toMatchObject([
        { name: "Trip", description: "Weekend" },
      ]);
    } finally {
      await db
        .update(groupMembers)
        .set({ status: "active" })
        .where(eq(groupMembers.userId, adminId));
    }
  });

  it("preserves the stored description when PATCH omits it", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;
    const response = await PATCH(request("PATCH", { name: "Renamed Trip" }), props());
    expect(response.status).toBe(200);
    expect(await db.select().from(groups).where(eq(groups.id, groupId))).toMatchObject([
      { name: "Renamed Trip", description: "Weekend" },
    ]);
  });

  it.each([null, "", "   "])(
    "clears the description with explicit value %j",
    async (description) => {
      process.env.TEST_CURRENT_USER_ID = adminId;
      await db.update(groups).set({ description: "Weekend" }).where(eq(groups.id, groupId));
      const response = await PATCH(request("PATCH", { name: "Trip", description }), props());
      expect(response.status).toBe(200);
      expect(await db.select().from(groups).where(eq(groups.id, groupId))).toMatchObject([
        { name: "Trip", description: null },
      ]);
    }
  );

  it("creates a group with a null description", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;
    const response = await POST(request("POST", { name: "No description", description: null }));
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(await db.select().from(groups).where(eq(groups.id, result.groupId))).toMatchObject([
      { name: "No description", description: null },
    ]);
  });

  it("persists admin updates and deletion", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;
    const updated = await PATCH(
      request("PATCH", { name: "New Trip", description: " Updated " }),
      props()
    );
    expect(updated.status).toBe(200);
    expect(await updated.json()).toEqual({ success: true });
    expect(await db.select().from(groups).where(eq(groups.id, groupId))).toMatchObject([
      { name: "New Trip", description: "Updated" },
    ]);
    const deleted = await DELETE(request("DELETE"), props());
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ success: true });
    expect(await db.select().from(groups).where(eq(groups.id, groupId))).toEqual([]);
  });

  it("preserves onboarding authentication, validation, and username-taken checks", async () => {
    const formData = new FormData();
    formData.set("username", adminUsername);
    expect(await completeOnboardingAction(formData)).toEqual({
      success: false,
      error: "Not authenticated",
    });
    process.env.TEST_CURRENT_USER_ID = onboardingId;
    expect(await completeOnboardingAction(formData)).toEqual({
      success: false,
      error: "username-taken",
    });
    formData.set("username", "!");
    expect(await completeOnboardingAction(formData)).toEqual({
      success: false,
      error: "Invalid username",
    });
  });

  it("completes onboarding once and rejects subsequent username changes", async () => {
    process.env.TEST_CURRENT_USER_ID = onboardingId;
    const username = `chosen_${onboardingId.slice(0, 8)}`;
    const formData = new FormData();
    formData.set("username", username);
    expect(await completeOnboardingAction(formData)).toEqual({ success: true });
    formData.set("username", `changed_${onboardingId.slice(0, 8)}`);
    expect(await completeOnboardingAction(formData)).toEqual({
      success: false,
      error: "Onboarding already completed",
    });
    expect(await db.select().from(users).where(eq(users.id, onboardingId))).toMatchObject([
      { username, needsUsername: false },
    ]);
  });
});
