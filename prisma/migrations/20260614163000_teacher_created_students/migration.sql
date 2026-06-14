-- Track the user who created a student so class-restricted teachers can manage
-- their own newly-created students before enrollment.
ALTER TABLE "students"
ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "students_createdByUserId_idx"
ON "students"("createdByUserId");

DO $$
BEGIN
  ALTER TABLE "students"
  ADD CONSTRAINT "students_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "permissions" ("id", "code", "name", "description")
VALUES (
  'perm_class_enroll_student',
  'class.enroll_student',
  'Thêm học viên vào lớp',
  'Cho phép thêm học viên được phép truy cập vào lớp được phân công hoặc quản lý.'
)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT
  'rp_' || r."code" || '_class_enroll_student',
  r."id",
  p."id"
FROM "roles" r
JOIN "permissions" p ON p."code" = 'class.enroll_student'
WHERE r."code" IN ('admin', 'academic', 'teacher_main')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
