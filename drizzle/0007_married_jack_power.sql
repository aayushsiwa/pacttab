ALTER TABLE "direct_invites" DROP CONSTRAINT IF EXISTS "direct_invites_inviter_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "direct_invites" DROP CONSTRAINT IF EXISTS "direct_invites_invitee_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "expense_splits" DROP CONSTRAINT IF EXISTS "expense_splits_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_paid_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "group_members" DROP CONSTRAINT IF EXISTS "group_members_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "groups" DROP CONSTRAINT IF EXISTS "groups_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "invite_links" DROP CONSTRAINT IF EXISTS "invite_links_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "join_requests" DROP CONSTRAINT IF EXISTS "join_requests_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "settlements" DROP CONSTRAINT IF EXISTS "settlements_paid_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "settlements" DROP CONSTRAINT IF EXISTS "settlements_received_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "settlements" DROP CONSTRAINT IF EXISTS "settlements_created_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "direct_invites" ADD CONSTRAINT "direct_invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_invites" ADD CONSTRAINT "direct_invites_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;