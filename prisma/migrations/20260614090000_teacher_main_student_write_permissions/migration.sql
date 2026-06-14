INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT
  'rp_teacher_main_' || p."code",
  r."id",
  p."id"
FROM "roles" r
JOIN "permissions" p ON p."code" IN ('student.create', 'student.update', 'student.delete')
WHERE r."code" = 'teacher_main'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
