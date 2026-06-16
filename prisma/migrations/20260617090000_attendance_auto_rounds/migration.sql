CREATE TYPE "AttendanceAutoRoundStatus" AS ENUM ('ACTIVE', 'CLOSED');

CREATE TABLE "attendance_auto_rounds" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "targetCount" INTEGER NOT NULL,
  "status" "AttendanceAutoRoundStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),

  CONSTRAINT "attendance_auto_rounds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance_auto_attempts" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "userId" TEXT,
  "submittedCode" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "accepted" BOOLEAN NOT NULL DEFAULT false,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendance_auto_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_auto_rounds_sessionId_status_idx"
ON "attendance_auto_rounds"("sessionId", "status");

CREATE INDEX "attendance_auto_attempts_roundId_accepted_submittedAt_idx"
ON "attendance_auto_attempts"("roundId", "accepted", "submittedAt");

CREATE INDEX "attendance_auto_attempts_studentId_submittedAt_idx"
ON "attendance_auto_attempts"("studentId", "submittedAt");

ALTER TABLE "attendance_auto_rounds"
ADD CONSTRAINT "attendance_auto_rounds_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "class_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_auto_rounds"
ADD CONSTRAINT "attendance_auto_rounds_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_auto_attempts"
ADD CONSTRAINT "attendance_auto_attempts_roundId_fkey"
FOREIGN KEY ("roundId") REFERENCES "attendance_auto_rounds"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_auto_attempts"
ADD CONSTRAINT "attendance_auto_attempts_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_auto_attempts"
ADD CONSTRAINT "attendance_auto_attempts_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
