ALTER TABLE "invite_links" ADD COLUMN "requires_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "status" varchar(20) DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;