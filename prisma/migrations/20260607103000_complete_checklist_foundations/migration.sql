CREATE TYPE "TuitionCalculationMode" AS ENUM ('COURSE', 'PER_SESSION_TOTAL', 'PER_SESSION_ACTUAL');

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");

ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "tuitionMode" "TuitionCalculationMode" NOT NULL DEFAULT 'COURSE';
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "tuitionPerSession" DECIMAL(12,2);
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "chargeByActualSessions" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "session_attachments" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "session_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "session_attachments_sessionId_idx" ON "session_attachments"("sessionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'session_attachments_sessionId_fkey'
  ) THEN
    ALTER TABLE "session_attachments"
    ADD CONSTRAINT "session_attachments_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "exam_attachments" (
  "id" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "exam_attachments_examId_idx" ON "exam_attachments"("examId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'exam_attachments_examId_fkey'
  ) THEN
    ALTER TABLE "exam_attachments"
    ADD CONSTRAINT "exam_attachments_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "periodFrom" TIMESTAMP(3);
ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "periodTo" TIMESTAMP(3);
ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "paidByUserId" TEXT;
ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "paidNote" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payrolls_paidByUserId_fkey'
  ) THEN
    ALTER TABLE "payrolls"
    ADD CONSTRAINT "payrolls_paidByUserId_fkey"
    FOREIGN KEY ("paidByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payroll_adjustments" (
  "id" TEXT NOT NULL,
  "payrollId" TEXT NOT NULL,
  "payrollItemId" TEXT,
  "staffUserId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "note" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payroll_adjustments_payrollId_idx" ON "payroll_adjustments"("payrollId");
CREATE INDEX IF NOT EXISTS "payroll_adjustments_staffUserId_idx" ON "payroll_adjustments"("staffUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payroll_adjustments_payrollId_fkey'
  ) THEN
    ALTER TABLE "payroll_adjustments"
    ADD CONSTRAINT "payroll_adjustments_payrollId_fkey"
    FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payroll_adjustments_payrollItemId_fkey'
  ) THEN
    ALTER TABLE "payroll_adjustments"
    ADD CONSTRAINT "payroll_adjustments_payrollItemId_fkey"
    FOREIGN KEY ("payrollItemId") REFERENCES "payroll_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payroll_adjustments_staffUserId_fkey'
  ) THEN
    ALTER TABLE "payroll_adjustments"
    ADD CONSTRAINT "payroll_adjustments_staffUserId_fkey"
    FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payroll_adjustments_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "payroll_adjustments"
    ADD CONSTRAINT "payroll_adjustments_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
