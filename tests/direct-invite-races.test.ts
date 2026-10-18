import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { directInvites, groupMembers, groups, messages, users } from "../src/db/schema";
import {
  createDirectInvite,
  respondToDirectInvite,
  revokeDirectInvite,
} from "../src/lib/group-service";
import * as wsHub from "../src/lib/ws-hub";

describe("direct invite authorization and acceptance races", () => {
  const admin = { id: randomUUID(), username: `admin_${randomUUID().slice(0, 8)}` };
  const invitee = { id: randomUUID(), username: `invitee_${randomUUID().slice(0, 8)}` };
  let groupId: string;
  let inviteId: string;

  beforeAll(async () => {
    await db.insert(users).values([admin, invitee]);
  });

  beforeEach(async () => {
    vi.spyOn(wsHub, "broadcastWsEvent").mockResolvedValue(undefined);
    groupId = randomUUID();
    inviteId = randomUUID();
    await db.insert(groups).values({ id: groupId, name: "Invite races", createdBy: admin.id });
    await db.insert(groupMembers).values({
      id: randomUUID(),
      groupId,
      userId: admin.id,
      role: "admin",
      status: "active",
    });
    await db.insert(directInvites).values({
      id: inviteId,
      groupId,
      inviterId: admin.id,
      inviteeId: invitee.id,
      token: randomUUID(),
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete(groups).where(eq(groups.id, groupId));
  });

  afterAll(async () => {
    await db.delete(users).where(inArray(users.id, [admin.id, invitee.id]));
  });

  const inviteeMembership = () =>
    db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, invitee.id)));

  it("rejects sending and revoking invites by an inactive admin without changing the invite", async () => {
    await db
      .update(groupMembers)
      .set({ status: "inactive" })
      .where(eq(groupMembers.groupId, groupId));

    expect(await createDirectInvite(admin, groupId, { username: invitee.username })).toMatchObject({
      success: false,
      status: 403,
    });
    expect(await revokeDirectInvite(admin, groupId, inviteId)).toMatchObject({
      success: false,
      status: 403,
    });
    expect(
      await db.select().from(directInvites).where(eq(directInvites.id, inviteId))
    ).toMatchObject([{ status: "pending", inviterId: admin.id }]);
    expect(await inviteeMembership()).toHaveLength(0);
  });

  it("reactivates a former admin as a member using the same membership ID", async () => {
    const membershipId = randomUUID();
    await db.insert(groupMembers).values({
      id: membershipId,
      groupId,
      userId: invitee.id,
      role: "admin",
      status: "inactive",
    });

    expect(await respondToDirectInvite(invitee, inviteId, "accepted")).toEqual({ success: true });
    expect(await inviteeMembership()).toMatchObject([
      { id: membershipId, role: "member", status: "active" },
    ]);
  });

  it.each(["new", "inactive"])(
    "consumes an invite once during concurrent acceptance for a %s membership",
    async (membershipState) => {
      if (membershipState === "inactive") {
        await db.insert(groupMembers).values({
          id: randomUUID(),
          groupId,
          userId: invitee.id,
          role: "admin",
          status: "inactive",
        });
      }

      // Both requests must finish their preflight reads before either transaction starts.
      const transaction = db.transaction.bind(db);
      let arrivals = 0;
      let release!: () => void;
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.spyOn(db, "transaction").mockImplementation(async (callback, config) => {
        if (++arrivals === 2) release();
        await ready;
        return transaction(callback, config);
      });

      const results = await Promise.all([
        respondToDirectInvite(invitee, inviteId, "accepted"),
        respondToDirectInvite(invitee, inviteId, "accepted"),
      ]);

      expect(results.filter((result) => result.success)).toHaveLength(1);
      expect(results.find((result) => !result.success)).toMatchObject({ status: 409 });
      expect(await inviteeMembership()).toMatchObject([{ role: "member", status: "active" }]);
      expect(
        await db.select().from(directInvites).where(eq(directInvites.id, inviteId))
      ).toHaveLength(0);
      expect(await db.select().from(messages).where(eq(messages.groupId, groupId))).toMatchObject([
        {
          type: "system",
          body: `${invitee.username} accepted the invite from @${admin.username}.`,
        },
      ]);
      expect(wsHub.broadcastWsEvent).toHaveBeenCalledTimes(2);
      expect(wsHub.broadcastWsEvent).toHaveBeenCalledWith({
        type: "member_joined",
        groupId,
        username: invitee.username,
      });
    }
  );

  it.each(["revoked", "deleted"])(
    "rejects acceptance if the invite is %s after preflight, with no membership or acceptance effects",
    async (state) => {
      const transaction = db.transaction.bind(db);
      vi.spyOn(db, "transaction").mockImplementationOnce(async (callback, config) => {
        if (state === "revoked") {
          expect(await revokeDirectInvite(admin, groupId, inviteId)).toEqual({ success: true });
        } else {
          expect(await respondToDirectInvite(invitee, inviteId, "declined")).toEqual({
            success: true,
          });
        }
        return transaction(callback, config);
      });

      expect(await respondToDirectInvite(invitee, inviteId, "accepted")).toMatchObject({
        success: false,
        status: 409,
      });
      expect(await inviteeMembership()).toHaveLength(0);
      expect(await db.select().from(messages).where(eq(messages.groupId, groupId))).toHaveLength(0);
      expect(wsHub.broadcastWsEvent).not.toHaveBeenCalled();
      const invites = await db.select().from(directInvites).where(eq(directInvites.id, inviteId));
      if (state === "revoked") {
        expect(invites).toMatchObject([{ status: "revoked" }]);
      } else {
        expect(invites).toHaveLength(0);
      }
    }
  );
});
