-- Groups that ended up with more than one active admin (two concurrent admin
-- transfers could race before the transfer took the group advisory lock) are
-- normalised before the single-admin index is created: the longest-standing
-- admin keeps the role and the others are demoted to plain members.
UPDATE "group_members" AS "duplicate"
SET "role" = 'member'
WHERE "duplicate"."role" = 'admin'
  AND "duplicate"."status" = 'active'
  AND EXISTS (
    SELECT 1
    FROM "group_members" AS "keeper"
    WHERE "keeper"."group_id" = "duplicate"."group_id"
      AND "keeper"."role" = 'admin'
      AND "keeper"."status" = 'active'
      AND ("keeper"."joined_at", "keeper"."id") < ("duplicate"."joined_at", "duplicate"."id")
  );
--> statement-breakpoint
CREATE UNIQUE INDEX "group_members_active_admin_unique_idx" ON "group_members" USING btree ("group_id") WHERE "group_members"."role" = 'admin' AND "group_members"."status" = 'active';
