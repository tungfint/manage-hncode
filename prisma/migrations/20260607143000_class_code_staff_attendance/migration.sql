-- Add a stable, human-readable class code for import/search.
ALTER TABLE "classes" ADD COLUMN "classCode" TEXT;

UPDATE "classes"
SET "classCode" = upper(
  left(
    regexp_replace(coalesce("name", 'LOP') || '-' || substr("id", 1, 6), '[^A-Za-z0-9]+', '-', 'g'),
    48
  )
)
WHERE "classCode" IS NULL;

ALTER TABLE "classes" ALTER COLUMN "classCode" SET NOT NULL;
CREATE UNIQUE INDEX "classes_classCode_key" ON "classes"("classCode");

-- Staff timekeeping for non-teaching work and payroll calculation.
CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'EXCUSED', 'UNEXCUSED', 'LATE', 'LEFT_EARLY');

CREATE TABLE "staff_attendances" (
  "id" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "workDate" TIMESTAMP(3) NOT NULL,
  "checkIn" TEXT,
  "checkOut" TEXT,
  "hoursCount" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "shiftName" TEXT,
  "workName" TEXT,
  "status" "StaffAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "note" TEXT,
  "confirmedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "staff_attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_attendances_staffUserId_workDate_shiftName_key"
ON "staff_attendances"("staffUserId", "workDate", "shiftName");

CREATE INDEX "staff_attendances_workDate_status_idx"
ON "staff_attendances"("workDate", "status");

CREATE INDEX "staff_attendances_staffUserId_workDate_idx"
ON "staff_attendances"("staffUserId", "workDate");

ALTER TABLE "staff_attendances"
ADD CONSTRAINT "staff_attendances_staffUserId_fkey"
FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staff_attendances"
ADD CONSTRAINT "staff_attendances_confirmedByUserId_fkey"
FOREIGN KEY ("confirmedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
