ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "needs_username" boolean DEFAULT false NOT NULL;
