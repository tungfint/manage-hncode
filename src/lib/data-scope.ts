import { PermissionEffect, PermissionScope } from "@/generated/prisma/client";
import { hasGlobalPermission, type AuthSession } from "@/lib/auth";
import type { PermissionCode } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const unrestrictedRoles = new Set([
  "admin",
  "accountant",
  "academic",
  "receptionist",
]);

const classRestrictedRoles = new Set([
  "teacher_main",
  "teacher_assistant",
  "collaborator",
  "part_time",
]);

export function hasUnrestrictedDataAccess(session: AuthSession) {
  return session.roles.some((role) => unrestrictedRoles.has(role));
}

export function isStudentAccount(session: AuthSession) {
  return session.roles.includes("student") && !hasUnrestrictedDataAccess(session);
}

export function isParentAccount(session: AuthSession) {
  return session.roles.includes("parent") && !hasUnrestrictedDataAccess(session);
}

export function isClassRestrictedStaff(session: AuthSession) {
  return (
    session.roles.some((role) => classRestrictedRoles.has(role)) &&
    !hasUnrestrictedDataAccess(session)
  );
}

function scopedIds(session: AuthSession, permission: PermissionCode, scope: PermissionScope) {
  const denied = new Set(
    session.scopedPermissions
      .filter(
        (item) =>
          item.code === permission &&
          item.scopeType === scope &&
          item.effect === PermissionEffect.DENY &&
          item.scopeId,
      )
      .map((item) => item.scopeId as string),
  );

  return session.scopedPermissions
    .filter(
      (item) =>
        item.code === permission &&
        item.scopeType === scope &&
        item.effect === PermissionEffect.ALLOW &&
        item.scopeId &&
        !denied.has(item.scopeId),
    )
    .map((item) => item.scopeId as string);
}

export async function getAccessibleStudentIds(
  session: AuthSession,
  permission: PermissionCode = "student.view",
) {
  if (hasUnrestrictedDataAccess(session) && hasGlobalPermission(session, permission)) {
    return null;
  }

  const ids = new Set<string>(scopedIds(session, permission, PermissionScope.STUDENT));
  const classScopeIds = scopedIds(session, permission, PermissionScope.CLASS);

  if (isStudentAccount(session)) {
    const student = await prisma.student.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (student) {
      ids.add(student.id);
    }
  }

  if (isParentAccount(session)) {
    const parent = await prisma.parent.findUnique({
      where: { userId: session.userId },
      include: { students: { select: { studentId: true } } },
    });

    parent?.students.forEach((item) => ids.add(item.studentId));
  }

  if (isClassRestrictedStaff(session)) {
    const assignments = await prisma.classTeacher.findMany({
      where: { teacherUserId: session.userId, status: "ACTIVE" },
      select: { classId: true },
    });
    const classIds = assignments.map((item) => item.classId);

    if (classIds.length) {
      const enrollments = await prisma.classStudent.findMany({
        where: { classId: { in: classIds }, status: "ACTIVE" },
        select: { studentId: true },
      });
      enrollments.forEach((item) => ids.add(item.studentId));
    }
  }

  if (classScopeIds.length) {
    const enrollments = await prisma.classStudent.findMany({
      where: { classId: { in: classScopeIds }, status: "ACTIVE" },
      select: { studentId: true },
    });
    enrollments.forEach((item) => ids.add(item.studentId));
  }

  return [...ids];
}

export async function getAccessibleClassIds(
  session: AuthSession,
  permission: PermissionCode = "class.view",
) {
  if (hasUnrestrictedDataAccess(session) && hasGlobalPermission(session, permission)) {
    return null;
  }

  const ids = new Set<string>(scopedIds(session, permission, PermissionScope.CLASS));

  if (isClassRestrictedStaff(session)) {
    const assignments = await prisma.classTeacher.findMany({
      where: { teacherUserId: session.userId, status: "ACTIVE" },
      select: { classId: true },
    });
    assignments.forEach((item) => ids.add(item.classId));
  }

  const studentIds = await getAccessibleStudentIds(session, "student.view");

  if (studentIds?.length) {
    const enrollments = await prisma.classStudent.findMany({
      where: { studentId: { in: studentIds }, status: "ACTIVE" },
      select: { classId: true },
    });
    enrollments.forEach((item) => ids.add(item.classId));
  }

  return [...ids];
}

export async function canAccessClass(
  session: AuthSession,
  classId: string,
  permission: PermissionCode,
) {
  if (hasUnrestrictedDataAccess(session) && hasGlobalPermission(session, permission)) {
    return true;
  }

  const classIds = await getAccessibleClassIds(session, permission);
  return Boolean(classIds?.includes(classId));
}

export async function canAccessStudent(
  session: AuthSession,
  studentId: string,
  permission: PermissionCode,
) {
  if (hasUnrestrictedDataAccess(session) && hasGlobalPermission(session, permission)) {
    return true;
  }

  const studentIds = await getAccessibleStudentIds(session, permission);
  return Boolean(studentIds?.includes(studentId));
}

export async function getSessionClassId(sessionId: string) {
  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { classId: true },
  });

  return classSession?.classId ?? null;
}
