-- Add account lifecycle flag.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Staff banking and responsibility fields.
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "responsibility" TEXT;

-- Student profile fields and optional linked account.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "clubClass" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "hncodeAccount" TEXT;

-- Parent optional linked account.
ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Uniques and indexes. PostgreSQL allows multiple NULL values in unique indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "students_userId_key" ON "students"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "students_email_key" ON "students"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "students_hncodeAccount_key" ON "students"("hncodeAccount");
CREATE INDEX IF NOT EXISTS "students_clubClass_idx" ON "students"("clubClass");
CREATE UNIQUE INDEX IF NOT EXISTS "parents_userId_key" ON "parents"("userId");

-- Foreign keys are added after nullable columns to keep existing rows valid.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'students_userId_fkey'
  ) THEN
    ALTER TABLE "students"
    ADD CONSTRAINT "students_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'parents_userId_fkey'
  ) THEN
    ALTER TABLE "parents"
    ADD CONSTRAINT "parents_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
