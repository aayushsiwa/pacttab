CREATE TABLE "direct_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"inviter_id" text NOT NULL,
	"invitee_id" text NOT NULL,
	"token" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "direct_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "direct_invites" ADD CONSTRAINT "direct_invites_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_invites" ADD CONSTRAINT "direct_invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_invites" ADD CONSTRAINT "direct_invites_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "direct_invite_unique_idx" ON "direct_invites" USING btree ("group_id","invitee_id");