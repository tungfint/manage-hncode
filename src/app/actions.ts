"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ExcelJS from "exceljs";
import { z } from "zod";
import {
  AttendanceStatus,
  ClassStatus,
  CommentType,
  EnrollmentStatus,
  ExamType,
  Gender,
  PaymentMethod,
  PermissionEffect,
  PermissionScope,
  PayrollStatus,
  SalaryRuleStatus,
  SalaryType,
  ScheduleStatus,
  SessionStatus,
  SessionTeacherRole,
  StaffAttendanceStatus,
  StaffStatus,
  StaffType,
  StudentStatus,
  TeacherAssignmentRole,
  TuitionCalculationMode,
  TuitionStatus,
  UserStatus,
} from "@/generated/prisma/client";
import { hashPassword, requirePermission } from "@/lib/auth";
import {
  canAccessClass,
  canAccessStudent,
  isClassRestrictedStaff,
} from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";
import {
  getStudentImportPreview,
  saveStudentImportPreview,
  updateStudentImportPreview,
  type StudentImportError,
  type StudentImportRow,
} from "@/lib/student-import-preview";

const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) => (value.length ? value : undefined)),
);

const dateField = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) =>
      value ? new Date(`${value}T00:00:00.000Z`) : undefined,
    ),
);

const numberField = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) => (value ? Number(value) : undefined)),
);

const TEMP_LINKED_ACCOUNT_PASSWORD = "HNCODElaptrinhvuive";
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

function dayOfWeekFromDate(date: Date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

async function ensureClassPermission(
  session: Awaited<ReturnType<typeof requirePermission>>,
  classId: string,
  permission: Parameters<typeof canAccessClass>[2],
) {
  if (!(await canAccessClass(session, classId, permission))) {
    redirect("/forbidden");
  }
}

async function ensureStudentPermission(
  session: Awaited<ReturnType<typeof requirePermission>>,
  studentId: string,
  permission: Parameters<typeof canAccessStudent>[2],
) {
  if (!(await canAccessStudent(session, studentId, permission))) {
    redirect("/forbidden");
  }
}

function cellText(value: ExcelJS.CellValue | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }

    if ("result" in value) {
      return cellText(value.result as ExcelJS.CellValue);
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("").trim();
    }
  }

  return String(value).trim();
}

function parseVietnameseDate(value: ExcelJS.CellValue | undefined) {
  if (value instanceof Date) {
    return value;
  }

  const text = cellText(value);

  if (!text) {
    return undefined;
  }

  const normalized = text.replace(/-/g, "/");
  const parts = normalized.split("/");

  if (parts.length === 3) {
    const [first, second, third] = parts.map((part) => Number(part));

    if (first > 1900 && second >= 1 && second <= 12 && third >= 1 && third <= 31) {
      return new Date(Date.UTC(first, second - 1, third));
    }

    const [day, month, year] = [first, second, third];

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year > 1900) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseGender(value: string) {
  const normalized = value.trim().toLowerCase();

  if (["nam", "male"].includes(normalized)) {
    return Gender.MALE;
  }

  if (["nữ", "nu", "female"].includes(normalized)) {
    return Gender.FEMALE;
  }

  return normalized ? Gender.OTHER : undefined;
}

function parseStudentStatus(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized || normalized === "đang học" || normalized === "dang hoc") {
    return StudentStatus.STUDYING;
  }

  if (normalized === "tạm nghỉ" || normalized === "tam nghi") {
    return StudentStatus.PAUSED;
  }

  if (normalized === "bảo lưu" || normalized === "bao luu") {
    return StudentStatus.RESERVED;
  }

  if (normalized === "nghỉ hẳn" || normalized === "nghi han") {
    return StudentStatus.LEFT;
  }

  return StudentStatus.STUDYING;
}

function phoneText(value: ExcelJS.CellValue | undefined) {
  const text = cellText(value).replace(/\s+/g, "");

  if (/^\d{9}$/.test(text)) {
    return `0${text}`;
  }

  return text;
}

function normalizeClassCode(value?: string | null) {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function previewDate(value?: Date) {
  return value ? value.toISOString() : undefined;
}

function parseImportDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isValidEmail(value?: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function saveUploadedFile(file: File, folder: string) {
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const fileName = `${Date.now()}-${randomUUID()}-${safeName}`;
  const relativePath = `/uploads/${folder}/${fileName}`;
  const targetFolder = path.join(UPLOAD_ROOT, folder);
  const targetPath = path.join(targetFolder, fileName);

  await mkdir(targetFolder, { recursive: true });
  await writeFile(targetPath, Buffer.from(await file.arrayBuffer()));

  return {
    fileName: file.name,
    fileUrl: relativePath,
    fileType: file.type || undefined,
  };
}

async function audit(input: {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  afterData?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      afterData:
        input.afterData === undefined
          ? undefined
          : (JSON.parse(JSON.stringify(input.afterData)) as never),
    },
  });
}

async function findRoleIdByCode(code: string) {
  const role = await prisma.role.findUnique({
    where: { code },
    select: { id: true },
  });

  if (!role) {
    throw new Error(`Role ${code} is not seeded.`);
  }

  return role.id;
}

async function createOrActivateLinkedUser(input: {
  name: string;
  email: string;
  phone?: string;
  roleCode: "student" | "parent";
}) {
  const email = input.email.trim().toLowerCase();
  const roleId = await findRoleIdByCode(input.roleCode);
  const existing = await prisma.user.findUnique({ where: { email } });
  const phoneOwner = input.phone
    ? await prisma.user.findUnique({ where: { phone: input.phone } })
    : null;

  if (existing) {
    const safePhone =
      phoneOwner && phoneOwner.id !== existing.id
        ? existing.phone
        : (input.phone ?? existing.phone);

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        phone: safePhone,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
      },
    });
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: existing.id,
          roleId,
        },
      },
      update: {},
      create: {
        userId: existing.id,
        roleId,
      },
    });

    return existing.id;
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email,
      phone: phoneOwner ? undefined : input.phone,
      passwordHash: await hashPassword(TEMP_LINKED_ACCOUNT_PASSWORD),
      mustChangePassword: true,
      status: UserStatus.ACTIVE,
      roles: {
        create: {
          roleId,
        },
      },
    },
    select: { id: true },
  });

  return user.id;
}

export async function createStudentAction(formData: FormData) {
  const session = await requirePermission("student.create");
  const schema = z.object({
    fullName: z.string().trim().min(2),
    dateOfBirth: dateField,
    gender: z.enum(Gender).optional(),
    phone: optionalString,
    email: optionalString,
    school: optionalString,
    schoolGrade: optionalString,
    clubClass: optionalString,
    entryLevel: optionalString,
    hncodeAccount: optionalString,
    status: z.enum(StudentStatus).default(StudentStatus.STUDYING),
    note: optionalString,
    parentName: optionalString,
    parentPhone: optionalString,
    parentEmail: optionalString,
    relationship: optionalString,
  });
  const parsed = schema.parse({
    fullName: formData.get("fullName"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender") || undefined,
    phone: formData.get("phone"),
    email: formData.get("email"),
    school: formData.get("school"),
    schoolGrade: formData.get("schoolGrade"),
    clubClass: formData.get("clubClass"),
    entryLevel: formData.get("entryLevel"),
    hncodeAccount: formData.get("hncodeAccount"),
    status: formData.get("status") || StudentStatus.STUDYING,
    note: formData.get("note"),
    parentName: formData.get("parentName"),
    parentPhone: formData.get("parentPhone"),
    parentEmail: formData.get("parentEmail"),
    relationship: formData.get("relationship"),
  });

  const studentUserId = parsed.email
    ? await createOrActivateLinkedUser({
        name: parsed.fullName,
        email: parsed.email,
        phone: parsed.phone,
        roleCode: "student",
      })
    : undefined;

  const student = await prisma.student.create({
    data: {
      userId: studentUserId,
      fullName: parsed.fullName,
      dateOfBirth: parsed.dateOfBirth,
      gender: parsed.gender,
      phone: parsed.phone,
      email: parsed.email?.toLowerCase(),
      school: parsed.school,
      schoolGrade: parsed.schoolGrade,
      clubClass: parsed.clubClass,
      entryLevel: parsed.entryLevel,
      hncodeAccount: parsed.hncodeAccount,
      status: parsed.status,
      note: parsed.note,
    },
  });

  if (parsed.parentName || parsed.parentPhone || parsed.parentEmail) {
    const existingParent = parsed.parentPhone
      ? await prisma.parent.findFirst({ where: { phone: parsed.parentPhone } })
      : parsed.parentEmail
        ? await prisma.parent.findFirst({ where: { email: parsed.parentEmail.toLowerCase() } })
      : null;
    const parentUserId = parsed.parentEmail
      ? await createOrActivateLinkedUser({
          name: parsed.parentName ?? `Phụ huynh của ${parsed.fullName}`,
          email: parsed.parentEmail,
          phone: parsed.parentPhone,
          roleCode: "parent",
        })
      : undefined;
    const parent =
      existingParent ??
      (await prisma.parent.create({
        data: {
          fullName: parsed.parentName ?? "Phụ huynh chưa đặt tên",
          phone: parsed.parentPhone,
          email: parsed.parentEmail?.toLowerCase(),
          userId: parentUserId,
        },
      }));

    if (existingParent) {
      await prisma.parent.update({
        where: { id: existingParent.id },
        data: {
          fullName: parsed.parentName ?? existingParent.fullName,
          phone: parsed.parentPhone ?? existingParent.phone,
          email: parsed.parentEmail?.toLowerCase() ?? existingParent.email,
          userId: parentUserId ?? existingParent.userId,
        },
      });
    }

    await prisma.studentParent.create({
      data: {
        studentId: student.id,
        parentId: parent.id,
        relationship: parsed.relationship ?? "Phụ huynh",
      },
    });
  }

  await audit({
    userId: session.userId,
    action: "student.create",
    entityType: "student",
    entityId: student.id,
    afterData: { fullName: student.fullName },
  });
  revalidatePath("/students");
  redirect("/students?created=1");
}

export async function updateStudentAction(studentId: string, formData: FormData) {
  const session = await requirePermission("student.update");
  const schema = z.object({
    fullName: z.string().trim().min(2),
    dateOfBirth: dateField,
    gender: z.enum(Gender).optional(),
    phone: optionalString,
    email: optionalString,
    school: optionalString,
    schoolGrade: optionalString,
    clubClass: optionalString,
    entryLevel: optionalString,
    hncodeAccount: optionalString,
    status: z.enum(StudentStatus),
    note: optionalString,
    parentName: optionalString,
    parentPhone: optionalString,
    parentEmail: optionalString,
    relationship: optionalString,
  });
  const parsed = schema.parse({
    fullName: formData.get("fullName"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender") || undefined,
    phone: formData.get("phone"),
    email: formData.get("email"),
    school: formData.get("school"),
    schoolGrade: formData.get("schoolGrade"),
    clubClass: formData.get("clubClass"),
    entryLevel: formData.get("entryLevel"),
    hncodeAccount: formData.get("hncodeAccount"),
    status: formData.get("status"),
    note: formData.get("note"),
    parentName: formData.get("parentName"),
    parentPhone: formData.get("parentPhone"),
    parentEmail: formData.get("parentEmail"),
    relationship: formData.get("relationship"),
  });

  await ensureStudentPermission(session, studentId, "student.update");

  await prisma.student.update({
    where: { id: studentId },
    data: {
      fullName: parsed.fullName,
      dateOfBirth: parsed.dateOfBirth,
      gender: parsed.gender,
      phone: parsed.phone,
      email: parsed.email?.toLowerCase(),
      school: parsed.school,
      schoolGrade: parsed.schoolGrade,
      clubClass: parsed.clubClass,
      entryLevel: parsed.entryLevel,
      hncodeAccount: parsed.hncodeAccount,
      status: parsed.status,
      note: parsed.note,
    },
  });

  if (parsed.parentName || parsed.parentPhone || parsed.parentEmail) {
    const existingLink = await prisma.studentParent.findFirst({
      where: { studentId },
      include: { parent: true },
      orderBy: { id: "asc" },
    });
    const existingParent =
      existingLink?.parent ??
      (parsed.parentPhone
        ? await prisma.parent.findFirst({ where: { phone: parsed.parentPhone } })
        : parsed.parentEmail
          ? await prisma.parent.findFirst({ where: { email: parsed.parentEmail.toLowerCase() } })
          : null);
    const parent = existingParent
      ? await prisma.parent.update({
          where: { id: existingParent.id },
          data: {
            fullName: parsed.parentName ?? existingParent.fullName,
            phone: parsed.parentPhone ?? existingParent.phone,
            email: parsed.parentEmail?.toLowerCase() ?? existingParent.email,
          },
        })
      : await prisma.parent.create({
          data: {
            fullName: parsed.parentName ?? "Phụ huynh chưa đặt tên",
            phone: parsed.parentPhone,
            email: parsed.parentEmail?.toLowerCase(),
          },
        });

    await prisma.studentParent.upsert({
      where: {
        studentId_parentId: {
          studentId,
          parentId: parent.id,
        },
      },
      update: { relationship: parsed.relationship ?? existingLink?.relationship ?? "Phụ huynh" },
      create: {
        studentId,
        parentId: parent.id,
        relationship: parsed.relationship ?? "Phụ huynh",
      },
    });
  }
  await audit({
    userId: session.userId,
    action: "student.update",
    entityType: "student",
    entityId: studentId,
  });
  revalidatePath("/students");
  redirect("/students?updated=1");
}

export async function deleteStudentAction(studentId: string) {
  const session = await requirePermission("student.delete");
  await ensureStudentPermission(session, studentId, "student.delete");
  await prisma.student.delete({ where: { id: studentId } });
  await audit({
    userId: session.userId,
    action: "student.delete",
    entityType: "student",
    entityId: studentId,
  });
  revalidatePath("/students");
  redirect("/students?deleted=1");
}

export async function createStudentLoginAction(studentId: string) {
  const session = await requirePermission("student.update");
  await ensureStudentPermission(session, studentId, "student.update");
  const student = await prisma.student.findUnique({ where: { id: studentId } });

  if (!student?.email) {
    redirect(`/students/${studentId}/edit?error=student_email`);
  }

  const userId = await createOrActivateLinkedUser({
    name: student.fullName,
    email: student.email,
    phone: student.phone ?? undefined,
    roleCode: "student",
  });

  await prisma.student.update({
    where: { id: studentId },
    data: {
      userId,
      hncodeAccount: student.hncodeAccount ?? student.email,
    },
  });
  await audit({
    userId: session.userId,
    action: "student.create_login",
    entityType: "student",
    entityId: studentId,
    afterData: { linkedUserId: userId },
  });
  revalidatePath(`/students/${studentId}/edit`);
  redirect(`/students/${studentId}/edit?studentAccount=1`);
}

export async function createParentLoginAction(studentId: string) {
  const session = await requirePermission("student.update");
  await ensureStudentPermission(session, studentId, "student.update");
  const link = await prisma.studentParent.findFirst({
    where: { studentId },
    include: {
      parent: true,
      student: true,
    },
    orderBy: { id: "asc" },
  });

  if (!link?.parent.email) {
    redirect(`/students/${studentId}/edit?error=parent_email`);
  }

  const userId = await createOrActivateLinkedUser({
    name: link.parent.fullName,
    email: link.parent.email,
    phone: link.parent.phone ?? undefined,
    roleCode: "parent",
  });

  await prisma.parent.update({
    where: { id: link.parentId },
    data: { userId },
  });
  await audit({
    userId: session.userId,
    action: "parent.create_login",
    entityType: "parent",
    entityId: link.parentId,
    afterData: { linkedUserId: userId, studentId },
  });
  revalidatePath(`/students/${studentId}/edit`);
  redirect(`/students/${studentId}/edit?parentAccount=1`);
}

function getHeaderMap(sheet: ExcelJS.Worksheet) {
  const headers = new Map<string, number>();

  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers.set(cellText(cell.value).toLowerCase(), colNumber);
  });

  return headers;
}

function headerIndex(headers: Map<string, number>, ...names: string[]) {
  for (const name of names) {
    const index = headers.get(name.toLowerCase());

    if (index) {
      return index;
    }
  }

  return undefined;
}

function rowHasAnyValue(row: ExcelJS.Row) {
  let hasAnyValue = false;

  row.eachCell((cell) => {
    if (cellText(cell.value)) {
      hasAnyValue = true;
    }
  });

  return hasAnyValue;
}

async function readStudentImportRows(file: File) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];

  if (!sheet) {
    return { error: "sheet" as const };
  }

  const headers = getHeaderMap(sheet);
  const nameCol = headerIndex(headers, "Họ tên học viên");

  if (!nameCol) {
    return { error: "headers" as const };
  }

  const columns = {
    nameCol,
    dateOfBirthCol: headerIndex(headers, "Ngày sinh"),
    genderCol: headerIndex(headers, "Giới tính"),
    phoneCol: headerIndex(headers, "Số điện thoại học viên"),
    emailCol: headerIndex(headers, "Email học viên"),
    schoolCol: headerIndex(headers, "Trường học"),
    schoolGradeCol: headerIndex(headers, "Lớp ở trường"),
    classCodeCol: headerIndex(headers, "Mã lớp học", "Lớp ở CLB"),
    hncodeAccountCol: headerIndex(headers, "Tài khoản HNCode"),
    entryLevelCol: headerIndex(headers, "Trình độ đầu vào"),
    statusCol: headerIndex(headers, "Trạng thái"),
    parentNameCol: headerIndex(headers, "Họ tên phụ huynh"),
    parentPhoneCol: headerIndex(headers, "Số điện thoại phụ huynh"),
    parentEmailCol: headerIndex(headers, "Email phụ huynh"),
    relationshipCol: headerIndex(headers, "Quan hệ"),
    noteCol: headerIndex(headers, "Ghi chú"),
  };

  const rawRows = [];
  const classCodes = new Set<string>();

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);

    if (!rowHasAnyValue(row)) {
      continue;
    }

    const classCode = normalizeClassCode(
      columns.classCodeCol ? cellText(row.getCell(columns.classCodeCol).value) : "",
    );

    if (classCode) {
      classCodes.add(classCode);
    }

    rawRows.push({
      rowNumber,
      fullName: cellText(row.getCell(columns.nameCol).value),
      dateOfBirth: columns.dateOfBirthCol
        ? parseVietnameseDate(row.getCell(columns.dateOfBirthCol).value)
        : undefined,
      gender: columns.genderCol
        ? parseGender(cellText(row.getCell(columns.genderCol).value))
        : undefined,
      phone: columns.phoneCol
        ? phoneText(row.getCell(columns.phoneCol).value) || undefined
        : undefined,
      email: columns.emailCol
        ? cellText(row.getCell(columns.emailCol).value).toLowerCase() || undefined
        : undefined,
      school: columns.schoolCol
        ? cellText(row.getCell(columns.schoolCol).value) || undefined
        : undefined,
      schoolGrade: columns.schoolGradeCol
        ? cellText(row.getCell(columns.schoolGradeCol).value) || undefined
        : undefined,
      classCode: classCode || undefined,
      entryLevel: columns.entryLevelCol
        ? cellText(row.getCell(columns.entryLevelCol).value) || undefined
        : undefined,
      hncodeAccount: columns.hncodeAccountCol
        ? cellText(row.getCell(columns.hncodeAccountCol).value) || undefined
        : undefined,
      status: columns.statusCol
        ? parseStudentStatus(cellText(row.getCell(columns.statusCol).value))
        : StudentStatus.STUDYING,
      note: columns.noteCol
        ? cellText(row.getCell(columns.noteCol).value) || undefined
        : undefined,
      parentName: columns.parentNameCol
        ? cellText(row.getCell(columns.parentNameCol).value) || undefined
        : undefined,
      parentPhone: columns.parentPhoneCol
        ? phoneText(row.getCell(columns.parentPhoneCol).value) || undefined
        : undefined,
      parentEmail: columns.parentEmailCol
        ? cellText(row.getCell(columns.parentEmailCol).value).toLowerCase() || undefined
        : undefined,
      relationship: columns.relationshipCol
        ? cellText(row.getCell(columns.relationshipCol).value) || undefined
        : undefined,
    });
  }

  const classes = classCodes.size
    ? await prisma.courseClass.findMany({
        where: { classCode: { in: [...classCodes] } },
        select: { id: true, name: true, classCode: true },
      })
    : [];
  const classByCode = new Map(classes.map((item) => [item.classCode, item]));
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const seenAccounts = new Set<string>();
  const validRows: StudentImportRow[] = [];
  const errors: StudentImportError[] = [];

  for (const row of rawRows) {
    const rowErrors: string[] = [];

    if (!row.fullName) {
      rowErrors.push("Thiếu họ tên học viên.");
    }

    if (!isValidEmail(row.email)) {
      rowErrors.push("Email học viên không đúng định dạng.");
    }

    if (!isValidEmail(row.parentEmail)) {
      rowErrors.push("Email phụ huynh không đúng định dạng.");
    }

    if (row.email && seenEmails.has(row.email)) {
      rowErrors.push("Email học viên bị trùng trong file.");
    }

    if (row.phone && seenPhones.has(row.phone)) {
      rowErrors.push("Số điện thoại học viên bị trùng trong file.");
    }

    if (row.hncodeAccount && seenAccounts.has(row.hncodeAccount.toLowerCase())) {
      rowErrors.push("Tài khoản HNCode bị trùng trong file.");
    }

    const courseClass = row.classCode ? classByCode.get(row.classCode) : undefined;

    if (row.classCode && !courseClass) {
      rowErrors.push(`Mã lớp học "${row.classCode}" không tồn tại.`);
    }

    const duplicateConditions = [
      ...(row.email ? [{ email: row.email }] : []),
      ...(row.phone ? [{ phone: row.phone }] : []),
      ...(row.hncodeAccount ? [{ hncodeAccount: row.hncodeAccount }] : []),
    ];
    const existing = duplicateConditions.length
      ? await prisma.student.findFirst({ where: { OR: duplicateConditions } })
      : null;

    if (existing) {
      rowErrors.push("Trùng email, số điện thoại hoặc tài khoản HNCode trong hệ thống.");
    }

    if (rowErrors.length) {
      errors.push({
        rowNumber: row.rowNumber,
        message: rowErrors.join(" "),
      });
      continue;
    }

    if (row.email) {
      seenEmails.add(row.email);
    }

    if (row.phone) {
      seenPhones.add(row.phone);
    }

    if (row.hncodeAccount) {
      seenAccounts.add(row.hncodeAccount.toLowerCase());
    }

    validRows.push({
      ...row,
      dateOfBirth: previewDate(row.dateOfBirth),
      classId: courseClass?.id,
      className: courseClass?.name,
    });
  }

  return { validRows, errors };
}

export async function previewImportStudentsAction(formData: FormData) {
  await requirePermission("student.create");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/students/import?error=file");
  }

  const result = await readStudentImportRows(file);

  if ("error" in result) {
    redirect(`/students/import?error=${result.error}`);
  }

  const preview = await saveStudentImportPreview({
    fileName: file.name,
    validRows: result.validRows,
    errors: result.errors,
  });

  redirect(`/students/import?preview=${preview.token}`);
}

export async function confirmImportStudentsAction(token: string) {
  const session = await requirePermission("student.create");
  const preview = await getStudentImportPreview(token);

  if (!preview) {
    redirect("/students/import?error=preview");
  }

  const importedRows: StudentImportRow[] = [];
  const importErrors: StudentImportError[] = [...(preview.importErrors ?? [])];

  for (const row of preview.validRows) {
    const duplicateConditions = [
      ...(row.email ? [{ email: row.email }] : []),
      ...(row.phone ? [{ phone: row.phone }] : []),
      ...(row.hncodeAccount ? [{ hncodeAccount: row.hncodeAccount }] : []),
    ];
    const existing = duplicateConditions.length
      ? await prisma.student.findFirst({ where: { OR: duplicateConditions } })
      : null;

    if (existing) {
      importErrors.push({
        rowNumber: row.rowNumber,
        message: "Dữ liệu vừa bị trùng trong hệ thống, chưa import dòng này.",
      });
      continue;
    }

    try {
      const studentUserId = row.email
        ? await createOrActivateLinkedUser({
            name: row.fullName,
            email: row.email,
            phone: row.phone,
            roleCode: "student",
          })
        : undefined;
      const student = await prisma.student.create({
        data: {
          userId: studentUserId,
          fullName: row.fullName,
          dateOfBirth: parseImportDate(row.dateOfBirth),
          gender: row.gender,
          phone: row.phone,
          email: row.email,
          school: row.school,
          schoolGrade: row.schoolGrade,
          clubClass: row.classCode,
          entryLevel: row.entryLevel,
          hncodeAccount: row.hncodeAccount,
          status: row.status,
          note: row.note,
        },
      });

      if (row.classId) {
        await prisma.classStudent.upsert({
          where: {
            classId_studentId: {
              classId: row.classId,
              studentId: student.id,
            },
          },
          update: { status: EnrollmentStatus.ACTIVE },
          create: {
            classId: row.classId,
            studentId: student.id,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      }

      if (row.parentName || row.parentPhone || row.parentEmail) {
        const parentUserId = row.parentEmail
          ? await createOrActivateLinkedUser({
              name: row.parentName || `Phụ huynh của ${row.fullName}`,
              email: row.parentEmail,
              phone: row.parentPhone,
              roleCode: "parent",
            })
          : undefined;
        const parent =
          (row.parentPhone
            ? await prisma.parent.findFirst({ where: { phone: row.parentPhone } })
            : row.parentEmail
              ? await prisma.parent.findFirst({ where: { email: row.parentEmail } })
              : null) ??
          (await prisma.parent.create({
            data: {
              fullName: row.parentName || "Phụ huynh chưa đặt tên",
              phone: row.parentPhone,
              email: row.parentEmail,
              userId: parentUserId,
            },
          }));

        if (parentUserId && !parent.userId) {
          await prisma.parent.update({
            where: { id: parent.id },
            data: { userId: parentUserId },
          });
        }

        await prisma.studentParent.upsert({
          where: {
            studentId_parentId: {
              studentId: student.id,
              parentId: parent.id,
            },
          },
          update: { relationship: row.relationship ?? "Phụ huynh" },
          create: {
            studentId: student.id,
            parentId: parent.id,
            relationship: row.relationship ?? "Phụ huynh",
          },
        });
      }

      importedRows.push(row);
    } catch (error) {
      importErrors.push({
        rowNumber: row.rowNumber,
        message:
          (error as { code?: string }).code === "P2002"
            ? "Dữ liệu bị trùng trong hệ thống, chưa import dòng này."
            : "Không thể import dòng này. Vui lòng kiểm tra lại dữ liệu.",
      });
    }
  }

  preview.importedRows = importedRows;
  preview.importErrors = importErrors;
  preview.confirmedAt = new Date().toISOString();
  await updateStudentImportPreview(preview);
  await audit({
    userId: session.userId,
    action: "student.import_excel",
    entityType: "student",
    afterData: {
      imported: importedRows.length,
      skipped: preview.errors.length + importErrors.length,
    },
  });
  revalidatePath("/students");
  redirect(`/students/import?result=${preview.token}`);
}

export async function importStudentsAction(formData: FormData) {
  return previewImportStudentsAction(formData);
}

export async function importStudentsDirectAction(formData: FormData) {
  const session = await requirePermission("student.create");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/students/import?error=file");
  }

  const workbook = new ExcelJS.Workbook();
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];

  if (!sheet) {
    redirect("/students/import?error=sheet");
  }

  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers.set(cellText(cell.value).toLowerCase(), colNumber);
  });

  const header = (name: string) => headers.get(name.toLowerCase());
  const requiredNameCol = header("Họ tên học viên");

  if (!requiredNameCol) {
    redirect("/students/import?error=headers");
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const fullName = cellText(row.getCell(requiredNameCol).value);

    if (!fullName) {
      let hasAnyValue = false;
      row.eachCell((cell) => {
        if (cellText(cell.value)) {
          hasAnyValue = true;
        }
      });

      if (hasAnyValue) {
        errors.push(`Dòng ${rowNumber}: thiếu họ tên học viên.`);
      }

      continue;
    }

    const phone = header("Số điện thoại học viên")
      ? cellText(row.getCell(header("Số điện thoại học viên")!).value)
      : undefined;
    const email = header("Email học viên")
      ? cellText(row.getCell(header("Email học viên")!).value).toLowerCase() || undefined
      : undefined;
    const hncodeAccount = header("Tài khoản HNCode")
      ? cellText(row.getCell(header("Tài khoản HNCode")!).value) || undefined
      : undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped += 1;
      errors.push(`Dòng ${rowNumber}: Email học viên không đúng định dạng.`);
      continue;
    }

    const duplicateConditions = [
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : []),
      ...(hncodeAccount ? [{ hncodeAccount }] : []),
    ];
    const existing = duplicateConditions.length
      ? await prisma.student.findFirst({
          where: { OR: duplicateConditions },
        })
      : null;

    if (existing) {
      skipped += 1;
      errors.push(`Dòng ${rowNumber}: trùng email, số điện thoại hoặc tài khoản HNCode.`);
      continue;
    }

    const data = {
      fullName,
      dateOfBirth: header("Ngày sinh")
        ? parseVietnameseDate(row.getCell(header("Ngày sinh")!).value)
        : undefined,
      gender: header("Giới tính")
        ? parseGender(cellText(row.getCell(header("Giới tính")!).value))
        : undefined,
      phone: phone || undefined,
      email,
      school: header("Trường học")
        ? cellText(row.getCell(header("Trường học")!).value) || undefined
        : undefined,
      schoolGrade: header("Lớp ở trường")
        ? cellText(row.getCell(header("Lớp ở trường")!).value) || undefined
        : undefined,
      clubClass: header("Lớp ở CLB")
        ? cellText(row.getCell(header("Lớp ở CLB")!).value) || undefined
        : undefined,
      entryLevel: header("Trình độ đầu vào")
        ? cellText(row.getCell(header("Trình độ đầu vào")!).value) || undefined
        : undefined,
      hncodeAccount,
      status: header("Trạng thái")
        ? parseStudentStatus(cellText(row.getCell(header("Trạng thái")!).value))
        : StudentStatus.STUDYING,
      note: header("Ghi chú")
        ? cellText(row.getCell(header("Ghi chú")!).value) || undefined
        : undefined,
    };

    const studentUserId = email
      ? await createOrActivateLinkedUser({
          name: fullName,
          email,
          phone,
          roleCode: "student",
        })
      : undefined;
    const student = await prisma.student.create({
      data: {
        ...data,
        userId: studentUserId,
      },
    });

    const parentName = header("Họ tên phụ huynh")
      ? cellText(row.getCell(header("Họ tên phụ huynh")!).value)
      : "";
    const parentPhone = header("Số điện thoại phụ huynh")
      ? cellText(row.getCell(header("Số điện thoại phụ huynh")!).value)
      : "";
    const parentEmail = header("Email phụ huynh")
      ? cellText(row.getCell(header("Email phụ huynh")!).value).toLowerCase()
      : "";
    if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      skipped += 1;
      errors.push(`Dòng ${rowNumber}: Email phụ huynh không đúng định dạng.`);
      continue;
    }

    const relationship = header("Quan hệ")
      ? cellText(row.getCell(header("Quan hệ")!).value) || "Phụ huynh"
      : "Phụ huynh";

    if (parentName || parentPhone || parentEmail) {
      const parentUserId = parentEmail
        ? await createOrActivateLinkedUser({
            name: parentName || `Phụ huynh của ${fullName}`,
            email: parentEmail,
            phone: parentPhone || undefined,
            roleCode: "parent",
          })
        : undefined;
      const parent =
        (parentPhone
          ? await prisma.parent.findFirst({ where: { phone: parentPhone } })
          : parentEmail
            ? await prisma.parent.findFirst({ where: { email: parentEmail } })
          : null) ??
        (await prisma.parent.create({
          data: {
            fullName: parentName || "Phụ huynh chưa đặt tên",
            phone: parentPhone || undefined,
            email: parentEmail || undefined,
            userId: parentUserId,
          },
        }));
      if (parentUserId && !parent.userId) {
        await prisma.parent.update({
          where: { id: parent.id },
          data: { userId: parentUserId },
        });
      }
      const existingLink = await prisma.studentParent.findFirst({
        where: {
          studentId: student.id,
          parentId: parent.id,
        },
      });

      if (!existingLink) {
        await prisma.studentParent.create({
          data: {
            studentId: student.id,
            parentId: parent.id,
            relationship,
          },
        });
      }
    }

    imported += 1;
  }

  await audit({
    userId: session.userId,
    action: "student.import_excel",
    entityType: "student",
    afterData: { imported, skipped, errors: errors.length },
  });
  revalidatePath("/students");
  const errorQuery = errors.length
    ? `&errors=${encodeURIComponent(errors.slice(0, 12).join("||"))}`
    : "";
  redirect(`/students/import?imported=${imported}&skipped=${skipped}${errorQuery}`);
}

export async function createParentAction(formData: FormData) {
  const session = await requirePermission("parent.create");
  const schema = z.object({
    fullName: z.string().trim().min(2),
    phone: optionalString,
    email: optionalString,
    address: optionalString,
    note: optionalString,
  });
  const parsed = schema.parse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    note: formData.get("note"),
  });

  const parent = await prisma.parent.create({ data: parsed });

  await audit({
    userId: session.userId,
    action: "parent.create",
    entityType: "parent",
    entityId: parent.id,
    afterData: { fullName: parent.fullName },
  });
  revalidatePath("/parents");
  redirect("/parents?created=1");
}

export async function updateParentAction(parentId: string, formData: FormData) {
  const session = await requirePermission("parent.update");
  const schema = z.object({
    fullName: z.string().trim().min(2),
    phone: optionalString,
    email: optionalString,
    address: optionalString,
    note: optionalString,
  });
  const parsed = schema.parse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    note: formData.get("note"),
  });

  await prisma.parent.update({ where: { id: parentId }, data: parsed });
  await audit({
    userId: session.userId,
    action: "parent.update",
    entityType: "parent",
    entityId: parentId,
  });
  revalidatePath("/parents");
  redirect("/parents?updated=1");
}

export async function deleteParentAction(parentId: string) {
  const session = await requirePermission("parent.delete");
  await prisma.parent.delete({ where: { id: parentId } });
  await audit({
    userId: session.userId,
    action: "parent.delete",
    entityType: "parent",
    entityId: parentId,
  });
  revalidatePath("/parents");
  redirect("/parents?deleted=1");
}

export async function createClassAction(formData: FormData) {
  const session = await requirePermission("class.create");
  const schema = z.object({
    classCode: z.string().trim().min(2),
    name: z.string().trim().min(2),
    subject: optionalString,
    level: optionalString,
    branchId: optionalString,
    roomId: optionalString,
    startDate: dateField,
    expectedEndDate: dateField,
    status: z.enum(ClassStatus).default(ClassStatus.PLANNED),
    tuitionFee: numberField,
    tuitionMode: z.enum(TuitionCalculationMode).default(TuitionCalculationMode.COURSE),
    tuitionPerSession: numberField,
    chargeByActualSessions: z.preprocess((value) => value === "on", z.boolean()),
    totalSessions: numberField,
    note: optionalString,
  });
  const parsed = schema.parse({
    classCode: formData.get("classCode"),
    name: formData.get("name"),
    subject: formData.get("subject"),
    level: formData.get("level"),
    branchId: formData.get("branchId"),
    roomId: formData.get("roomId"),
    startDate: formData.get("startDate"),
    expectedEndDate: formData.get("expectedEndDate"),
    status: formData.get("status") || ClassStatus.PLANNED,
    tuitionFee: formData.get("tuitionFee"),
    tuitionMode: formData.get("tuitionMode") || TuitionCalculationMode.COURSE,
    tuitionPerSession: formData.get("tuitionPerSession"),
    chargeByActualSessions: formData.get("chargeByActualSessions"),
    totalSessions: formData.get("totalSessions"),
    note: formData.get("note"),
  });
  const classCode = normalizeClassCode(parsed.classCode);

  if (!classCode) {
    redirect("/classes/new?error=class_code");
  }

  const existing = await prisma.courseClass.findUnique({
    where: { classCode },
    select: { id: true },
  });

  if (existing) {
    redirect("/classes/new?error=class_code_duplicate");
  }

  const courseClass = await prisma.courseClass.create({
    data: {
      ...parsed,
      classCode,
      tuitionFee: parsed.tuitionFee ? String(parsed.tuitionFee) : undefined,
      tuitionPerSession: parsed.tuitionPerSession
        ? String(parsed.tuitionPerSession)
        : undefined,
      totalSessions: parsed.totalSessions
        ? Math.trunc(parsed.totalSessions)
        : undefined,
    },
  });

  await audit({
    userId: session.userId,
    action: "class.create",
    entityType: "class",
    entityId: courseClass.id,
    afterData: { name: courseClass.name },
  });
  revalidatePath("/classes");
  redirect("/classes?created=1");
}

export async function updateClassAction(classId: string, formData: FormData) {
  const session = await requirePermission("class.update");
  const schema = z.object({
    classCode: z.string().trim().min(2),
    name: z.string().trim().min(2),
    subject: optionalString,
    level: optionalString,
    branchId: optionalString,
    roomId: optionalString,
    startDate: dateField,
    expectedEndDate: dateField,
    status: z.enum(ClassStatus),
    tuitionFee: numberField,
    tuitionMode: z.enum(TuitionCalculationMode).default(TuitionCalculationMode.COURSE),
    tuitionPerSession: numberField,
    chargeByActualSessions: z.preprocess((value) => value === "on", z.boolean()),
    totalSessions: numberField,
    note: optionalString,
  });
  const parsed = schema.parse({
    classCode: formData.get("classCode"),
    name: formData.get("name"),
    subject: formData.get("subject"),
    level: formData.get("level"),
    branchId: formData.get("branchId"),
    roomId: formData.get("roomId"),
    startDate: formData.get("startDate"),
    expectedEndDate: formData.get("expectedEndDate"),
    status: formData.get("status"),
    tuitionFee: formData.get("tuitionFee"),
    tuitionMode: formData.get("tuitionMode") || TuitionCalculationMode.COURSE,
    tuitionPerSession: formData.get("tuitionPerSession"),
    chargeByActualSessions: formData.get("chargeByActualSessions"),
    totalSessions: formData.get("totalSessions"),
    note: formData.get("note"),
  });

  await ensureClassPermission(session, classId, "class.update");
  const classCode = normalizeClassCode(parsed.classCode);

  if (!classCode) {
    redirect(`/classes/${classId}/edit?error=class_code`);
  }

  const duplicate = await prisma.courseClass.findFirst({
    where: {
      classCode,
      id: { not: classId },
    },
    select: { id: true },
  });

  if (duplicate) {
    redirect(`/classes/${classId}/edit?error=class_code_duplicate`);
  }

  await prisma.courseClass.update({
    where: { id: classId },
    data: {
      ...parsed,
      classCode,
      tuitionFee: parsed.tuitionFee ? String(parsed.tuitionFee) : null,
      tuitionPerSession: parsed.tuitionPerSession
        ? String(parsed.tuitionPerSession)
        : null,
      totalSessions: parsed.totalSessions
        ? Math.trunc(parsed.totalSessions)
        : null,
    },
  });
  await audit({
    userId: session.userId,
    action: "class.update",
    entityType: "class",
    entityId: classId,
  });
  revalidatePath("/classes");
  revalidatePath(`/classes/${classId}`);
  redirect(`/classes/${classId}?updated=1`);
}

export async function deleteClassAction(classId: string) {
  const session = await requirePermission("class.delete");
  await ensureClassPermission(session, classId, "class.delete");
  await prisma.courseClass.delete({ where: { id: classId } });
  await audit({
    userId: session.userId,
    action: "class.delete",
    entityType: "class",
    entityId: classId,
  });
  revalidatePath("/classes");
  redirect("/classes?deleted=1");
}

export async function enrollStudentAction(classId: string, formData: FormData) {
  const session = await requirePermission("class.update");
  const studentId = String(formData.get("studentId") ?? "");

  if (!studentId) {
    redirect(`/classes/${classId}?error=student`);
  }

  await ensureClassPermission(session, classId, "class.update");
  await ensureStudentPermission(session, studentId, "student.view");

  await prisma.classStudent.upsert({
    where: {
      classId_studentId: {
        classId,
        studentId,
      },
    },
    update: { status: EnrollmentStatus.ACTIVE, leftAt: null },
    create: {
      classId,
      studentId,
      status: EnrollmentStatus.ACTIVE,
    },
  });

  await audit({
    userId: session.userId,
    action: "class_student.enroll",
    entityType: "class",
    entityId: classId,
    afterData: { studentId },
  });
  revalidatePath(`/classes/${classId}`);
  redirect(`/classes/${classId}?enrolled=1`);
}

export async function enrollStudentsByEmailAction(
  classId: string,
  formData: FormData,
) {
  const session = await requirePermission("class.update");
  await ensureClassPermission(session, classId, "class.update");
  const raw = String(formData.get("emails") ?? "");
  const emails = [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  if (!emails.length) {
    redirect(`/classes/${classId}?emailError=empty`);
  }

  const students = await prisma.student.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  const foundEmails = new Set(students.map((student) => student.email));
  let added = 0;
  let duplicated = 0;

  for (const student of students) {
    const existing = await prisma.classStudent.findUnique({
      where: {
        classId_studentId: {
          classId,
          studentId: student.id,
        },
      },
    });

    if (existing) {
      duplicated += 1;
      continue;
    }

    await prisma.classStudent.create({
      data: {
        classId,
        studentId: student.id,
        status: EnrollmentStatus.ACTIVE,
      },
    });
    added += 1;
  }

  const missing = emails.filter((email) => !foundEmails.has(email)).length;

  await audit({
    userId: session.userId,
    action: "class_student.enroll_by_email",
    entityType: "class",
    entityId: classId,
    afterData: { added, missing, duplicated },
  });
  revalidatePath(`/classes/${classId}`);
  redirect(
    `/classes/${classId}?emailAdded=${added}&emailMissing=${missing}&emailDuplicated=${duplicated}`,
  );
}

export async function previewEnrollStudentsByEmailAction(
  classId: string,
  formData: FormData,
) {
  const session = await requirePermission("class.update");
  await ensureClassPermission(session, classId, "class.update");
  const raw = String(formData.get("emails") ?? "");
  const emails = [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  if (!emails.length) {
    redirect(`/classes/${classId}?emailError=empty`);
  }

  const students = await prisma.student.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, fullName: true },
  });
  const existing = await prisma.classStudent.findMany({
    where: {
      classId,
      studentId: { in: students.map((student) => student.id) },
    },
    select: { studentId: true },
  });
  const foundEmails = new Set(students.map((student) => student.email));
  const duplicatedStudentIds = new Set(existing.map((item) => item.studentId));
  const addableStudents = students.filter(
    (student) => !duplicatedStudentIds.has(student.id),
  );
  const addedNames = addableStudents.map((student) => student.fullName).slice(0, 8);
  const missingEmails = emails.filter((email) => !foundEmails.has(email));

  redirect(
    `/classes/${classId}?emailPreview=1&previewEmails=${encodeURIComponent(
      emails.join("\n"),
    )}&emailFound=${addableStudents.length}&emailDuplicated=${
      duplicatedStudentIds.size
    }&emailMissing=${missingEmails.length}&emailFoundNames=${encodeURIComponent(
      addedNames.join("||"),
    )}&emailMissingList=${encodeURIComponent(missingEmails.slice(0, 8).join("||"))}`,
  );
}

export async function removeStudentFromClassAction(
  classId: string,
  studentId: string,
) {
  const session = await requirePermission("class.update");
  await ensureClassPermission(session, classId, "class.update");
  await ensureStudentPermission(session, studentId, "student.view");
  await prisma.classStudent.update({
    where: {
      classId_studentId: {
        classId,
        studentId,
      },
    },
    data: {
      status: EnrollmentStatus.LEFT,
      leftAt: new Date(),
    },
  });
  await audit({
    userId: session.userId,
    action: "class_student.remove",
    entityType: "class",
    entityId: classId,
    afterData: { studentId },
  });
  revalidatePath(`/classes/${classId}`);
  redirect(`/classes/${classId}?studentRemoved=1`);
}

export async function assignTeacherAction(classId: string, formData: FormData) {
  const session = await requirePermission("class.assign_teacher");
  await ensureClassPermission(session, classId, "class.assign_teacher");
  const schema = z.object({
    teacherUserId: z.string().min(1),
    teacherRole: z.enum(TeacherAssignmentRole),
  });
  const parsed = schema.parse({
    teacherUserId: formData.get("teacherUserId"),
    teacherRole: formData.get("teacherRole"),
  });

  await prisma.classTeacher.upsert({
    where: {
      classId_teacherUserId_teacherRole: {
        classId,
        teacherUserId: parsed.teacherUserId,
        teacherRole: parsed.teacherRole,
      },
    },
    update: { status: "ACTIVE" },
    create: {
      classId,
      teacherUserId: parsed.teacherUserId,
      teacherRole: parsed.teacherRole,
      status: "ACTIVE",
    },
  });

  await audit({
    userId: session.userId,
    action: "class_teacher.assign",
    entityType: "class",
    entityId: classId,
    afterData: parsed,
  });
  revalidatePath(`/classes/${classId}`);
  redirect(`/classes/${classId}?assigned=1`);
}

export async function removeTeacherFromClassAction(
  classId: string,
  assignmentId: string,
) {
  const session = await requirePermission("class.assign_teacher");
  await ensureClassPermission(session, classId, "class.assign_teacher");
  await prisma.classTeacher.update({
    where: { id: assignmentId },
    data: { status: "INACTIVE" },
  });
  await audit({
    userId: session.userId,
    action: "class_teacher.remove",
    entityType: "class",
    entityId: classId,
    afterData: { assignmentId },
  });
  revalidatePath(`/classes/${classId}`);
  redirect(`/classes/${classId}?teacherRemoved=1`);
}

export async function createScheduleAction(classId: string, formData: FormData) {
  const session = await requirePermission("schedule.manage");
  await ensureClassPermission(session, classId, "schedule.manage");
  const schema = z.object({
    dayOfWeek: z.coerce.number().int().min(1).max(7),
    startTime: z.string().trim().min(4),
    endTime: z.string().trim().min(4),
    roomId: optionalString,
    startDate: dateField,
    endDate: dateField,
  });
  const parsed = schema.parse({
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    roomId: formData.get("roomId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  const schedule = await prisma.classSchedule.create({
    data: {
      classId,
      dayOfWeek: parsed.dayOfWeek,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      roomId: parsed.roomId,
      startDate: parsed.startDate ?? new Date(),
      endDate: parsed.endDate,
      status: ScheduleStatus.ACTIVE,
    },
  });

  await audit({
    userId: session.userId,
    action: "schedule.create",
    entityType: "class_schedule",
    entityId: schedule.id,
  });
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/schedule");
  redirect(`/classes/${classId}?scheduled=1`);
}

export async function updateScheduleAction(
  classId: string,
  scheduleId: string,
  formData: FormData,
) {
  const session = await requirePermission("schedule.manage");
  await ensureClassPermission(session, classId, "schedule.manage");
  const schema = z.object({
    dayOfWeek: z.coerce.number().int().min(1).max(7),
    startTime: z.string().trim().min(4),
    endTime: z.string().trim().min(4),
    roomId: optionalString,
    startDate: dateField,
    endDate: dateField,
    status: z.enum(ScheduleStatus),
    futureSessionsMode: z
      .enum(["KEEP", "UPDATE_TIME_ROOM", "CANCEL"])
      .default("KEEP"),
  });
  const parsed = schema.parse({
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    roomId: formData.get("roomId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    status: formData.get("status"),
    futureSessionsMode: formData.get("futureSessionsMode") || "KEEP",
  });

  await prisma.classSchedule.update({
    where: { id: scheduleId },
    data: {
      dayOfWeek: parsed.dayOfWeek,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      roomId: parsed.roomId,
      startDate: parsed.startDate ?? new Date(),
      endDate: parsed.endDate,
      status: parsed.status,
    },
  });

  if (parsed.futureSessionsMode === "UPDATE_TIME_ROOM") {
    await prisma.classSession.updateMany({
      where: {
        scheduleId,
        status: SessionStatus.PLANNED,
        sessionDate: { gte: new Date() },
      },
      data: {
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        roomId: parsed.roomId,
      },
    });
  }

  if (parsed.futureSessionsMode === "CANCEL") {
    await prisma.classSession.updateMany({
      where: {
        scheduleId,
        status: SessionStatus.PLANNED,
        sessionDate: { gte: new Date() },
      },
      data: { status: SessionStatus.CANCELLED },
    });
  }

  await audit({
    userId: session.userId,
    action: "schedule.update",
    entityType: "class_schedule",
    entityId: scheduleId,
  });
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/schedule");
  redirect(`/classes/${classId}?scheduleUpdated=1`);
}

export async function deleteScheduleAction(classId: string, scheduleId: string) {
  const session = await requirePermission("schedule.manage");
  await ensureClassPermission(session, classId, "schedule.manage");
  await prisma.classSchedule.update({
    where: { id: scheduleId },
    data: { status: ScheduleStatus.INACTIVE, endDate: new Date() },
  });
  await prisma.classSession.updateMany({
    where: {
      scheduleId,
      status: SessionStatus.PLANNED,
      sessionDate: { gte: new Date() },
    },
    data: { status: SessionStatus.CANCELLED },
  });
  await audit({
    userId: session.userId,
    action: "schedule.delete",
    entityType: "class_schedule",
    entityId: scheduleId,
  });
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/schedule");
  redirect(`/classes/${classId}?scheduleDeleted=1`);
}

export async function createSessionAction(classId: string, formData: FormData) {
  const session = await requirePermission("session.manage");
  await ensureClassPermission(session, classId, "session.manage");
  const schema = z.object({
    scheduleId: optionalString,
    sessionDate: dateField,
    startTime: z.string().trim().min(4),
    endTime: z.string().trim().min(4),
    roomId: optionalString,
  });
  const parsed = schema.parse({
    scheduleId: formData.get("scheduleId"),
    sessionDate: formData.get("sessionDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    roomId: formData.get("roomId"),
  });
  const sessionDate = parsed.sessionDate ?? new Date();
  const duplicate = await prisma.classSession.findUnique({
    where: {
      classId_sessionDate_startTime: {
        classId,
        sessionDate,
        startTime: parsed.startTime,
      },
    },
  });

  if (duplicate) {
    redirect(`/classes/${classId}?sessionError=duplicate`);
  }

  let matchedScheduleId = parsed.scheduleId;

  if (isClassRestrictedStaff(session)) {
    const fixedSchedule = await prisma.classSchedule.findFirst({
      where: {
        classId,
        status: ScheduleStatus.ACTIVE,
        dayOfWeek: dayOfWeekFromDate(sessionDate),
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        startDate: { lte: sessionDate },
        OR: [{ endDate: null }, { endDate: { gte: sessionDate } }],
      },
      select: { id: true },
    });

    if (!fixedSchedule) {
      redirect(`/classes/${classId}?sessionError=schedule`);
    }

    matchedScheduleId = parsed.scheduleId ?? fixedSchedule.id;
  }

  const classSession = await prisma.classSession.create({
    data: {
      classId,
      scheduleId: matchedScheduleId,
      sessionDate,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      roomId: parsed.roomId,
      status: SessionStatus.PLANNED,
    },
  });

  await audit({
    userId: session.userId,
    action: "session.create",
    entityType: "class_session",
    entityId: classSession.id,
  });
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/sessions");
  redirect(`/sessions/${classSession.id}/attendance`);
}

export async function deleteSessionAction(classId: string, sessionId: string) {
  const session = await requirePermission("session.manage");
  await ensureClassPermission(session, classId, "session.manage");
  await prisma.classSession.update({
    where: { id: sessionId },
    data: { status: SessionStatus.CANCELLED },
  });
  await audit({
    userId: session.userId,
    action: "session.delete",
    entityType: "class_session",
    entityId: sessionId,
  });
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/sessions");
  redirect(`/classes/${classId}?sessionDeleted=1`);
}

export async function createUserAction(formData: FormData) {
  const session = await requirePermission("user.manage");
  const schema = z.object({
    name: z.string().trim().min(2),
    email: z.string().trim().email(),
    phone: optionalString,
    password: z.string().min(8),
    staffType: z.enum(StaffType),
    roleId: z.string().min(1),
    bankName: optionalString,
    bankAccountNumber: optionalString,
    responsibility: optionalString,
    status: z.enum(UserStatus).default(UserStatus.ACTIVE),
  });
  const parsed = schema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    staffType: formData.get("staffType"),
    roleId: formData.get("roleId"),
    bankName: formData.get("bankName"),
    bankAccountNumber: formData.get("bankAccountNumber"),
    responsibility: formData.get("responsibility"),
    status: formData.get("status") || UserStatus.ACTIVE,
  });

  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      phone: parsed.phone,
      passwordHash: await hashPassword(parsed.password),
      mustChangePassword: true,
      status: parsed.status,
      roles: {
        create: {
          roleId: parsed.roleId,
        },
      },
      staffProfile: {
        create: {
          fullName: parsed.name,
          email: parsed.email.toLowerCase(),
          phone: parsed.phone,
          staffType: parsed.staffType,
          bankName: parsed.bankName,
          bankAccountNumber: parsed.bankAccountNumber,
          responsibility: parsed.responsibility,
          status:
            parsed.status === UserStatus.ACTIVE
              ? StaffStatus.ACTIVE
              : StaffStatus.INACTIVE,
          startDate: new Date(),
        },
      },
    },
  });

  await audit({
    userId: session.userId,
    action: "user.create",
    entityType: "user",
    entityId: user.id,
    afterData: { name: user.name },
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?created=1");
}

export async function createStaffAction(formData: FormData) {
  const session = await requirePermission("user.manage");
  const schema = z.object({
    name: z.string().trim().min(2),
    email: z.string().trim().email(),
    phone: optionalString,
    password: z.string().min(8),
    staffType: z.enum(StaffType),
    roleId: z.string().min(1),
    bankName: optionalString,
    bankAccountNumber: optionalString,
    responsibility: optionalString,
    status: z.enum(UserStatus).default(UserStatus.ACTIVE),
    note: optionalString,
  });
  const parsed = schema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    staffType: formData.get("staffType"),
    roleId: formData.get("roleId"),
    bankName: formData.get("bankName"),
    bankAccountNumber: formData.get("bankAccountNumber"),
    responsibility: formData.get("responsibility"),
    status: formData.get("status") || UserStatus.ACTIVE,
    note: formData.get("note"),
  });
  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      phone: parsed.phone,
      passwordHash: await hashPassword(parsed.password),
      mustChangePassword: true,
      status: parsed.status,
      roles: {
        create: {
          roleId: parsed.roleId,
        },
      },
      staffProfile: {
        create: {
          fullName: parsed.name,
          email: parsed.email.toLowerCase(),
          phone: parsed.phone,
          staffType: parsed.staffType,
          bankName: parsed.bankName,
          bankAccountNumber: parsed.bankAccountNumber,
          responsibility: parsed.responsibility,
          status:
            parsed.status === UserStatus.ACTIVE
              ? StaffStatus.ACTIVE
              : StaffStatus.INACTIVE,
          note: parsed.note,
          startDate: new Date(),
        },
      },
    },
    include: { staffProfile: true },
  });

  await audit({
    userId: session.userId,
    action: "staff.create",
    entityType: "staff_profile",
    entityId: user.staffProfile?.id,
    afterData: { name: user.name },
  });
  revalidatePath("/staff");
  revalidatePath("/admin/users");
  redirect("/staff?created=1");
}

export async function updateStaffAction(staffId: string, formData: FormData) {
  const session = await requirePermission("user.manage");
  const schema = z.object({
    name: z.string().trim().min(2),
    email: z.string().trim().email(),
    phone: optionalString,
    staffType: z.enum(StaffType),
    roleId: z.string().min(1),
    bankName: optionalString,
    bankAccountNumber: optionalString,
    responsibility: optionalString,
    status: z.enum(UserStatus),
    note: optionalString,
  });
  const parsed = schema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    staffType: formData.get("staffType"),
    roleId: formData.get("roleId"),
    bankName: formData.get("bankName"),
    bankAccountNumber: formData.get("bankAccountNumber"),
    responsibility: formData.get("responsibility"),
    status: formData.get("status"),
    note: formData.get("note"),
  });
  const staff = await prisma.staffProfile.findUnique({
    where: { id: staffId },
    select: { userId: true },
  });

  if (!staff) {
    redirect("/staff");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: staff.userId },
      data: {
        name: parsed.name,
        email: parsed.email.toLowerCase(),
        phone: parsed.phone,
        status: parsed.status,
      },
    }),
    prisma.staffProfile.update({
      where: { id: staffId },
      data: {
        fullName: parsed.name,
        email: parsed.email.toLowerCase(),
        phone: parsed.phone,
        staffType: parsed.staffType,
        bankName: parsed.bankName,
        bankAccountNumber: parsed.bankAccountNumber,
        responsibility: parsed.responsibility,
        status:
          parsed.status === UserStatus.ACTIVE
            ? StaffStatus.ACTIVE
            : StaffStatus.INACTIVE,
        note: parsed.note,
      },
    }),
    prisma.userRole.deleteMany({ where: { userId: staff.userId } }),
    prisma.userRole.create({
      data: {
        userId: staff.userId,
        roleId: parsed.roleId,
      },
    }),
  ]);

  await audit({
    userId: session.userId,
    action: "staff.update",
    entityType: "staff_profile",
    entityId: staffId,
    afterData: parsed,
  });
  revalidatePath("/staff");
  revalidatePath(`/staff/${staffId}/edit`);
  revalidatePath("/admin/users");
  redirect(`/staff/${staffId}/edit?updated=1`);
}

function calculateHours(checkIn?: string, checkOut?: string) {
  if (!checkIn || !checkOut) {
    return 0;
  }

  const [inHour, inMinute] = checkIn.split(":").map(Number);
  const [outHour, outMinute] = checkOut.split(":").map(Number);

  if (
    Number.isNaN(inHour) ||
    Number.isNaN(inMinute) ||
    Number.isNaN(outHour) ||
    Number.isNaN(outMinute)
  ) {
    return 0;
  }

  const start = inHour * 60 + inMinute;
  const end = outHour * 60 + outMinute;

  if (end <= start) {
    return 0;
  }

  return Math.round(((end - start) / 60) * 100) / 100;
}

export async function createStaffAttendanceAction(formData: FormData) {
  const session = await requirePermission("staff_attendance.manage");
  const schema = z.object({
    staffUserId: z.string().min(1),
    workDate: dateField,
    checkIn: optionalString,
    checkOut: optionalString,
    hoursCount: numberField,
    shiftName: optionalString,
    workName: optionalString,
    status: z.enum(StaffAttendanceStatus),
    note: optionalString,
  });
  const parsed = schema.parse({
    staffUserId: formData.get("staffUserId"),
    workDate: formData.get("workDate"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    hoursCount: formData.get("hoursCount"),
    shiftName: formData.get("shiftName"),
    workName: formData.get("workName"),
    status: formData.get("status") || StaffAttendanceStatus.PRESENT,
    note: formData.get("note"),
  });

  const staff = await prisma.user.findFirst({
    where: {
      id: parsed.staffUserId,
      staffProfile: { isNot: null },
    },
    select: { id: true },
  });

  if (!staff || !parsed.workDate) {
    redirect("/staff/attendance?error=invalid");
  }

  const hours = parsed.hoursCount ?? calculateHours(parsed.checkIn, parsed.checkOut);
  let attendanceId = "";

  try {
    const attendance = await prisma.staffAttendance.create({
      data: {
        staffUserId: parsed.staffUserId,
        workDate: parsed.workDate,
        checkIn: parsed.checkIn,
        checkOut: parsed.checkOut,
        hoursCount: String(hours),
        shiftName: parsed.shiftName,
        workName: parsed.workName,
        status: parsed.status,
        note: parsed.note,
        confirmedByUserId: session.userId,
      },
    });
    attendanceId = attendance.id;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      redirect("/staff/attendance?error=duplicate");
    }

    throw error;
  }

  await audit({
    userId: session.userId,
    action: "staff_attendance.create",
    entityType: "staff_attendance",
    entityId: attendanceId,
    afterData: parsed,
  });
  revalidatePath("/staff/attendance");
  redirect("/staff/attendance?created=1");
}

export async function updateStaffAttendanceAction(
  attendanceId: string,
  formData: FormData,
) {
  const session = await requirePermission("staff_attendance.manage");
  const schema = z.object({
    staffUserId: z.string().min(1),
    workDate: dateField,
    checkIn: optionalString,
    checkOut: optionalString,
    hoursCount: numberField,
    shiftName: optionalString,
    workName: optionalString,
    status: z.enum(StaffAttendanceStatus),
    note: optionalString,
  });
  const parsed = schema.parse({
    staffUserId: formData.get("staffUserId"),
    workDate: formData.get("workDate"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    hoursCount: formData.get("hoursCount"),
    shiftName: formData.get("shiftName"),
    workName: formData.get("workName"),
    status: formData.get("status") || StaffAttendanceStatus.PRESENT,
    note: formData.get("note"),
  });

  if (!parsed.workDate) {
    redirect("/staff/attendance?error=invalid");
  }

  const hours = parsed.hoursCount ?? calculateHours(parsed.checkIn, parsed.checkOut);

  try {
    await prisma.staffAttendance.update({
      where: { id: attendanceId },
      data: {
        staffUserId: parsed.staffUserId,
        workDate: parsed.workDate,
        checkIn: parsed.checkIn,
        checkOut: parsed.checkOut,
        hoursCount: String(hours),
        shiftName: parsed.shiftName,
        workName: parsed.workName,
        status: parsed.status,
        note: parsed.note,
        confirmedByUserId: session.userId,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      redirect("/staff/attendance?error=duplicate");
    }

    throw error;
  }
  await audit({
    userId: session.userId,
    action: "staff_attendance.update",
    entityType: "staff_attendance",
    entityId: attendanceId,
    afterData: parsed,
  });
  revalidatePath("/staff/attendance");
  redirect("/staff/attendance?updated=1");
}

export async function deleteStaffAttendanceAction(attendanceId: string) {
  const session = await requirePermission("staff_attendance.manage");
  await prisma.staffAttendance.delete({ where: { id: attendanceId } });
  await audit({
    userId: session.userId,
    action: "staff_attendance.delete",
    entityType: "staff_attendance",
    entityId: attendanceId,
  });
  revalidatePath("/staff/attendance");
  redirect("/staff/attendance?deleted=1");
}

export async function setUserStatusAction(userId: string, formData: FormData) {
  const session = await requirePermission("user.manage");
  const schema = z.object({
    status: z.enum(UserStatus),
  });
  const parsed = schema.parse({
    status: formData.get("status"),
  });

  await prisma.user.update({
    where: { id: userId },
    data: { status: parsed.status },
  });
  await audit({
    userId: session.userId,
    action: "user.status.update",
    entityType: "user",
    entityId: userId,
    afterData: parsed,
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?statusUpdated=1");
}

export async function setUserPermissionAction(userId: string, formData: FormData) {
  const session = await requirePermission("role.manage");
  const schema = z.object({
    permissionId: z.string().min(1),
    mode: z.enum(["ROLE_DEFAULT", "ALLOW", "DENY"]),
    scopeType: z.enum(PermissionScope).default(PermissionScope.GLOBAL),
    scopeId: optionalString,
  });
  const parsed = schema.parse({
    permissionId: formData.get("permissionId"),
    mode: formData.get("mode"),
    scopeType: formData.get("scopeType") || PermissionScope.GLOBAL,
    scopeId: formData.get("scopeId"),
  });
  const isGlobal = parsed.scopeType === PermissionScope.GLOBAL;

  await prisma.userPermission.deleteMany({
    where: {
      userId,
      permissionId: parsed.permissionId,
      scopeType: parsed.scopeType,
      scopeId: isGlobal ? null : parsed.scopeId,
    },
  });

  if (parsed.mode !== "ROLE_DEFAULT" && (isGlobal || parsed.scopeId)) {
    await prisma.userPermission.create({
      data: {
        userId,
        permissionId: parsed.permissionId,
        effect:
          parsed.mode === "ALLOW"
            ? PermissionEffect.ALLOW
            : PermissionEffect.DENY,
        scopeType: parsed.scopeType,
        scopeId: isGlobal ? null : parsed.scopeId,
      },
    });
  }

  await audit({
    userId: session.userId,
    action: "user_permission.update",
    entityType: "user",
    entityId: userId,
    afterData: parsed,
  });
  revalidatePath("/admin/users");
  redirect(`/admin/users?permissionsUpdated=${userId}`);
}

export async function saveSessionNotesAction(sessionId: string, formData: FormData) {
  const session = await requirePermission("session.manage");
  const schema = z.object({
    lessonContent: optionalString,
    homework: optionalString,
    generalNote: optionalString,
    status: z.enum(SessionStatus),
  });
  const parsed = schema.parse({
    lessonContent: formData.get("lessonContent"),
    homework: formData.get("homework"),
    generalNote: formData.get("generalNote"),
    status: formData.get("status"),
  });
  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { classId: true },
  });

  if (!classSession) {
    redirect("/sessions");
  }

  await ensureClassPermission(session, classSession.classId, "session.manage");

  await prisma.classSession.update({
    where: { id: sessionId },
    data: {
      lessonContent: parsed.lessonContent,
      homework: parsed.homework,
      generalNote: parsed.generalNote,
      status: parsed.status,
      completedAt: parsed.status === "COMPLETED" ? new Date() : undefined,
    },
  });

  await audit({
    userId: session.userId,
    action: "session.update",
    entityType: "class_session",
    entityId: sessionId,
  });
  revalidatePath(`/sessions/${sessionId}/attendance`);
  revalidatePath("/sessions");
}

export async function updateSessionTeachersAction(
  sessionId: string,
  formData: FormData,
) {
  const session = await requirePermission("session.manage");
  const schema = z.object({
    mainTeacherUserId: optionalString,
    assistantTeacherUserId: optionalString,
  });
  const parsed = schema.parse({
    mainTeacherUserId: formData.get("mainTeacherUserId"),
    assistantTeacherUserId: formData.get("assistantTeacherUserId"),
  });
  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { classId: true },
  });

  if (!classSession) {
    redirect("/sessions");
  }

  await ensureClassPermission(session, classSession.classId, "session.manage");
  await prisma.sessionTeacher.deleteMany({
    where: {
      sessionId,
      role: { in: [SessionTeacherRole.MAIN, SessionTeacherRole.ASSISTANT] },
    },
  });

  const rows = [
    parsed.mainTeacherUserId
      ? {
          sessionId,
          teacherUserId: parsed.mainTeacherUserId,
          role: SessionTeacherRole.MAIN,
        }
      : null,
    parsed.assistantTeacherUserId
      ? {
          sessionId,
          teacherUserId: parsed.assistantTeacherUserId,
          role: SessionTeacherRole.ASSISTANT,
        }
      : null,
  ].filter(Boolean);

  if (rows.length) {
    await prisma.sessionTeacher.createMany({
      data: rows as {
        sessionId: string;
        teacherUserId: string;
        role: SessionTeacherRole;
      }[],
      skipDuplicates: true,
    });
  }

  await audit({
    userId: session.userId,
    action: "session_teacher.update",
    entityType: "class_session",
    entityId: sessionId,
    afterData: parsed,
  });
  revalidatePath(`/sessions/${sessionId}/attendance`);
  revalidatePath("/sessions");
  redirect(`/sessions/${sessionId}/attendance?teachersUpdated=1`);
}

export async function uploadSessionAttachmentAction(
  sessionId: string,
  formData: FormData,
) {
  const session = await requirePermission("session.manage");
  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { classId: true },
  });

  if (!classSession) {
    redirect("/sessions");
  }

  await ensureClassPermission(session, classSession.classId, "session.manage");
  const file = formData.get("file");
  const saved = file instanceof File ? await saveUploadedFile(file, "sessions") : null;

  if (!saved) {
    redirect(`/sessions/${sessionId}/attendance?uploadError=1`);
  }

  await prisma.sessionAttachment.create({
    data: {
      sessionId,
      ...saved,
    },
  });
  await audit({
    userId: session.userId,
    action: "session_attachment.upload",
    entityType: "class_session",
    entityId: sessionId,
    afterData: saved,
  });
  revalidatePath(`/sessions/${sessionId}/attendance`);
  redirect(`/sessions/${sessionId}/attendance?uploaded=1`);
}

export async function markAttendanceAction(sessionId: string, formData: FormData) {
  const session = await requirePermission("attendance.manage");
  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      courseClass: {
        include: {
          students: {
            where: { status: EnrollmentStatus.ACTIVE },
            select: { studentId: true },
          },
        },
      },
    },
  });

  if (!classSession) {
    redirect("/sessions");
  }

  await ensureClassPermission(session, classSession.classId, "attendance.manage");

  for (const enrollment of classSession.courseClass.students) {
    const studentId = enrollment.studentId;
    const status = formData.get(`attendance:${studentId}`);
    const note = formData.get(`note:${studentId}`);

    if (!status || !Object.values(AttendanceStatus).includes(status as AttendanceStatus)) {
      continue;
    }

    await prisma.attendance.upsert({
      where: {
        sessionId_studentId: {
          sessionId,
          studentId,
        },
      },
      update: {
        status: status as AttendanceStatus,
        note: String(note ?? "").trim() || undefined,
        markedByUserId: session.userId,
        markedAt: new Date(),
      },
      create: {
        sessionId,
        studentId,
        status: status as AttendanceStatus,
        note: String(note ?? "").trim() || undefined,
        markedByUserId: session.userId,
      },
    });
  }

  await audit({
    userId: session.userId,
    action: "attendance.bulk_upsert",
    entityType: "class_session",
    entityId: sessionId,
  });
  revalidatePath(`/sessions/${sessionId}/attendance`);
  redirect(`/sessions/${sessionId}/attendance?saved=1`);
}

export async function createSessionCommentAction(
  sessionId: string,
  formData: FormData,
) {
  const session = await requirePermission("comment.manage");
  const schema = z.object({
    studentId: z.string().min(1),
    content: z.string().trim().min(3),
  });
  const parsed = schema.parse({
    studentId: formData.get("studentId"),
    content: formData.get("content"),
  });
  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { classId: true },
  });

  if (!classSession) {
    redirect("/sessions");
  }

  await ensureClassPermission(session, classSession.classId, "comment.manage");
  await ensureStudentPermission(session, parsed.studentId, "student.view");

  const comment = await prisma.studentComment.create({
    data: {
      studentId: parsed.studentId,
      classId: classSession.classId,
      sessionId,
      commentType: CommentType.SESSION,
      content: parsed.content,
      createdByUserId: session.userId,
    },
  });

  await audit({
    userId: session.userId,
    action: "comment.create",
    entityType: "student_comment",
    entityId: comment.id,
  });
  revalidatePath(`/sessions/${sessionId}/attendance`);
  redirect(`/sessions/${sessionId}/attendance?commented=1`);
}

export async function saveScoresAction(examId: string, formData: FormData) {
  const session = await requirePermission("score.manage");
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      courseClass: {
        include: {
          students: {
            where: { status: EnrollmentStatus.ACTIVE },
            select: { studentId: true },
          },
        },
      },
    },
  });

  if (!exam) {
    redirect("/exams");
  }

  await ensureClassPermission(session, exam.classId, "score.manage");

  for (const enrollment of exam.courseClass.students) {
    const studentId = enrollment.studentId;
    const score = String(formData.get(`score:${studentId}`) ?? "").trim();
    const comment = String(formData.get(`comment:${studentId}`) ?? "").trim();

    if (!score) {
      continue;
    }

    await prisma.score.upsert({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
      update: {
        score,
        comment: comment || undefined,
        updatedByUserId: session.userId,
      },
      create: {
        examId,
        studentId,
        score,
        comment: comment || undefined,
        createdByUserId: session.userId,
      },
    });
  }

  await audit({
    userId: session.userId,
    action: "score.bulk_upsert",
    entityType: "exam",
    entityId: examId,
  });
  revalidatePath(`/exams/${examId}/scores`);
  redirect(`/exams/${examId}/scores?saved=1`);
}

export async function importScoresAction(examId: string, formData: FormData) {
  const session = await requirePermission("score.manage");
  const file = formData.get("file");
  const overwrite = formData.get("overwrite") === "on";

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/exams/${examId}/scores?importError=file`);
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      courseClass: {
        include: {
          students: {
            where: { status: EnrollmentStatus.ACTIVE },
            include: { student: true },
          },
        },
      },
    },
  });

  if (!exam) {
    redirect("/exams");
  }

  await ensureClassPermission(session, exam.classId, "score.manage");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];

  if (!sheet) {
    redirect(`/exams/${examId}/scores?importError=sheet`);
  }

  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers.set(cellText(cell.value).toLowerCase(), colNumber);
  });
  const header = (name: string) => headers.get(name.toLowerCase());
  const identifierCol = header("Email học viên") ?? header("Tài khoản HNCode");
  const scoreCol = header("Điểm");

  if (!identifierCol || !scoreCol) {
    redirect(`/exams/${examId}/scores?importError=headers`);
  }

  const studentByIdentifier = new Map<string, string>();

  for (const enrollment of exam.courseClass.students) {
    if (enrollment.student.email) {
      studentByIdentifier.set(enrollment.student.email.toLowerCase(), enrollment.studentId);
    }

    if (enrollment.student.hncodeAccount) {
      studentByIdentifier.set(enrollment.student.hncodeAccount.toLowerCase(), enrollment.studentId);
    }
  }

  let imported = 0;
  let skipped = 0;
  let missing = 0;
  const errors: string[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const identifier = cellText(row.getCell(identifierCol).value).toLowerCase();
    const score = cellText(row.getCell(scoreCol).value);
    const comment = header("Nhận xét")
      ? cellText(row.getCell(header("Nhận xét")!).value)
      : "";

    if (!identifier || !score) {
      errors.push(`Dòng ${rowNumber}: thiếu email/tài khoản HNCode hoặc điểm.`);
      continue;
    }

    if (Number.isNaN(Number(score))) {
      skipped += 1;
      errors.push(`Dòng ${rowNumber}: điểm không đúng định dạng số.`);
      continue;
    }

    const studentId = studentByIdentifier.get(identifier);

    if (!studentId) {
      missing += 1;
      errors.push(`Dòng ${rowNumber}: học viên không tồn tại hoặc không thuộc lớp.`);
      continue;
    }

    const existing = await prisma.score.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
    });

    if (existing && !overwrite) {
      skipped += 1;
      errors.push(`Dòng ${rowNumber}: học viên đã có điểm, cần tick ghi đè để cập nhật.`);
      continue;
    }

    await prisma.score.upsert({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
      update: {
        score,
        comment: comment || existing?.comment,
        updatedByUserId: session.userId,
      },
      create: {
        examId,
        studentId,
        score,
        comment: comment || undefined,
        createdByUserId: session.userId,
      },
    });
    imported += 1;
  }

  await audit({
    userId: session.userId,
    action: "score.import_excel",
    entityType: "exam",
    entityId: examId,
    afterData: { imported, skipped, missing, overwrite, errors: errors.length },
  });
  revalidatePath(`/exams/${examId}/scores`);
  const errorQuery = errors.length
    ? `&errors=${encodeURIComponent(errors.slice(0, 12).join("||"))}`
    : "";
  redirect(
    `/exams/${examId}/scores?imported=${imported}&skipped=${skipped}&missing=${missing}${errorQuery}`,
  );
}

export async function uploadExamAttachmentAction(examId: string, formData: FormData) {
  const session = await requirePermission("exam.manage");
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { classId: true },
  });

  if (!exam) {
    redirect("/exams");
  }

  await ensureClassPermission(session, exam.classId, "exam.manage");
  const file = formData.get("file");
  const saved = file instanceof File ? await saveUploadedFile(file, "exams") : null;

  if (!saved) {
    redirect(`/exams/${examId}/scores?uploadError=1`);
  }

  await prisma.examAttachment.create({
    data: {
      examId,
      ...saved,
    },
  });
  await audit({
    userId: session.userId,
    action: "exam_attachment.upload",
    entityType: "exam",
    entityId: examId,
    afterData: saved,
  });
  revalidatePath(`/exams/${examId}/scores`);
  redirect(`/exams/${examId}/scores?uploaded=1`);
}

export async function createExamAction(formData: FormData) {
  const session = await requirePermission("exam.manage");
  const schema = z.object({
    classId: z.string().min(1),
    name: z.string().trim().min(2),
    examDate: dateField,
    examType: z.enum(ExamType),
    maxScore: z.string().trim().min(1),
    description: optionalString,
  });
  const parsed = schema.parse({
    classId: formData.get("classId"),
    name: formData.get("name"),
    examDate: formData.get("examDate"),
    examType: formData.get("examType"),
    maxScore: formData.get("maxScore"),
    description: formData.get("description"),
  });

  await ensureClassPermission(session, parsed.classId, "exam.manage");

  const exam = await prisma.exam.create({
    data: {
      classId: parsed.classId,
      name: parsed.name,
      examDate: parsed.examDate ?? new Date(),
      examType: parsed.examType,
      maxScore: parsed.maxScore,
      description: parsed.description,
      createdByUserId: session.userId,
    },
  });

  await audit({
    userId: session.userId,
    action: "exam.create",
    entityType: "exam",
    entityId: exam.id,
  });
  revalidatePath("/exams");
  redirect("/exams?created=1");
}

export async function recordPaymentAction(chargeId: string, formData: FormData) {
  const session = await requirePermission("payment.manage");
  const schema = z.object({
    amount: z.string().trim().min(1),
    method: z.enum(PaymentMethod),
    note: optionalString,
  });
  const parsed = schema.parse({
    amount: formData.get("amount"),
    method: formData.get("method"),
    note: formData.get("note"),
  });
  const charge = await prisma.tuitionCharge.findUnique({
    where: { id: chargeId },
  });

  if (!charge) {
    redirect("/tuition");
  }

  if (charge.classId) {
    await ensureClassPermission(session, charge.classId, "payment.manage");
  } else {
    await ensureStudentPermission(session, charge.studentId, "payment.manage");
  }

  const amount = Number(parsed.amount);
  const newAmountPaid = Number(charge.amountPaid.toString()) + amount;
  const amountDue =
    Number(charge.amountDue.toString()) - Number(charge.discountAmount.toString());
  const status = newAmountPaid >= amountDue ? TuitionStatus.PAID : TuitionStatus.PARTIAL;

  const payment = await prisma.payment.create({
    data: {
      tuitionChargeId: chargeId,
      amount: parsed.amount,
      method: parsed.method,
      note: parsed.note,
      receivedByUserId: session.userId,
    },
  });

  await prisma.tuitionCharge.update({
    where: { id: chargeId },
    data: {
      amountPaid: String(newAmountPaid),
      status,
    },
  });

  await audit({
    userId: session.userId,
    action: "payment.create",
    entityType: "payment",
    entityId: payment.id,
  });
  revalidatePath("/tuition");
  revalidatePath("/payments");
  redirect("/tuition?paid=1");
}

export async function createTuitionChargeAction(formData: FormData) {
  const session = await requirePermission("tuition.manage");
  const schema = z.object({
    studentId: z.string().min(1),
    classId: optionalString,
    amountDue: z.string().trim().min(1),
    discountAmount: optionalString,
    dueDate: dateField,
    note: optionalString,
  });
  const parsed = schema.parse({
    studentId: formData.get("studentId"),
    classId: formData.get("classId"),
    amountDue: formData.get("amountDue"),
    discountAmount: formData.get("discountAmount"),
    dueDate: formData.get("dueDate"),
    note: formData.get("note"),
  });

  await ensureStudentPermission(session, parsed.studentId, "tuition.manage");

  if (parsed.classId) {
    await ensureClassPermission(session, parsed.classId, "tuition.manage");
  }

  const charge = await prisma.tuitionCharge.create({
    data: {
      studentId: parsed.studentId,
      classId: parsed.classId,
      amountDue: parsed.amountDue,
      discountAmount: parsed.discountAmount ?? "0",
      dueDate: parsed.dueDate,
      status: TuitionStatus.UNPAID,
      note: parsed.note,
      createdByUserId: session.userId,
    },
  });

  await audit({
    userId: session.userId,
    action: "tuition_charge.create",
    entityType: "tuition_charge",
    entityId: charge.id,
  });
  revalidatePath("/tuition");
  redirect("/tuition?created=1");
}

export async function createSalaryRuleAction(formData: FormData) {
  const session = await requirePermission("salary.manage");
  const schema = z.object({
    staffUserId: z.string().min(1),
    classId: optionalString,
    workName: optionalString,
    staffRole: optionalString,
    salaryType: z.enum(SalaryType),
    amount: optionalString,
    description: optionalString,
    effectiveFrom: dateField,
  });
  const parsed = schema.parse({
    staffUserId: formData.get("staffUserId"),
    classId: formData.get("classId"),
    workName: formData.get("workName"),
    staffRole: formData.get("staffRole"),
    salaryType: formData.get("salaryType"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    effectiveFrom: formData.get("effectiveFrom"),
  });
  const rule = await prisma.salaryRule.create({
    data: {
      ...parsed,
      effectiveFrom: parsed.effectiveFrom ?? new Date(),
      status: SalaryRuleStatus.ACTIVE,
    },
  });

  await audit({
    userId: session.userId,
    action: "salary_rule.create",
    entityType: "salary_rule",
    entityId: rule.id,
  });
  revalidatePath("/salary/rules");
  redirect("/salary/rules?created=1");
}

function defaultPeriod(month: number, year: number) {
  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 0)),
  };
}

export async function createPayrollAction(formData: FormData) {
  const session = await requirePermission("salary.manage");
  const schema = z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2020).max(2100),
    periodFrom: dateField,
    periodTo: dateField,
  });
  const parsed = schema.parse({
    month: formData.get("month"),
    year: formData.get("year"),
    periodFrom: formData.get("periodFrom"),
    periodTo: formData.get("periodTo"),
  });
  const period = defaultPeriod(parsed.month, parsed.year);
  const periodFrom = parsed.periodFrom ?? period.from;
  const periodTo = parsed.periodTo ?? period.to;
  const payroll = await prisma.payroll.upsert({
    where: {
      month_year: {
        month: parsed.month,
        year: parsed.year,
      },
    },
    update: {
      periodFrom,
      periodTo,
      status: PayrollStatus.DRAFT,
    },
    create: {
      month: parsed.month,
      year: parsed.year,
      periodFrom,
      periodTo,
      status: PayrollStatus.DRAFT,
      createdByUserId: session.userId,
    },
  });
  const salaryRules = await prisma.salaryRule.findMany({
    where: {
      status: SalaryRuleStatus.ACTIVE,
      effectiveFrom: { lte: periodTo },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodFrom } }],
    },
  });

  for (const rule of salaryRules) {
    const sessionsCount =
      rule.classId && rule.salaryType === SalaryType.PER_SESSION
        ? await prisma.sessionTeacher.count({
            where: {
              teacherUserId: rule.staffUserId,
              session: {
                classId: rule.classId,
                sessionDate: { gte: periodFrom, lte: periodTo },
                status: "COMPLETED",
              },
            },
          })
        : 0;
    const staffAttendances =
      !rule.classId &&
      (rule.salaryType === SalaryType.PER_HOUR ||
        rule.salaryType === SalaryType.PER_SHIFT ||
        rule.salaryType === SalaryType.PER_TASK)
        ? await prisma.staffAttendance.findMany({
            where: {
              staffUserId: rule.staffUserId,
              workDate: { gte: periodFrom, lte: periodTo },
              status: { in: ["PRESENT", "LATE", "LEFT_EARLY"] },
            },
            select: { hoursCount: true },
          })
        : [];
    const hoursCount = staffAttendances.reduce(
      (sum, item) => sum + Number(item.hoursCount.toString()),
      0,
    );
    const taskCount =
      rule.salaryType === SalaryType.PER_SHIFT ||
      rule.salaryType === SalaryType.PER_TASK
        ? staffAttendances.length
        : 0;
    const multiplier =
      rule.salaryType === SalaryType.PER_SESSION
        ? Math.max(sessionsCount, 0)
        : rule.salaryType === SalaryType.PER_HOUR
          ? Math.max(hoursCount, 0)
          : rule.salaryType === SalaryType.PER_SHIFT ||
              rule.salaryType === SalaryType.PER_TASK
            ? Math.max(taskCount, 0)
            : 1;
    const baseAmount =
      Number(rule.amount?.toString() ?? 0) * multiplier;
    const existing = await prisma.payrollItem.findFirst({
      where: {
        payrollId: payroll.id,
        staffUserId: rule.staffUserId,
        salaryRuleId: rule.id,
        classId: rule.classId,
      },
    });
    const data = {
      sessionsCount,
      hoursCount: String(hoursCount),
      taskCount,
      baseAmount: String(baseAmount),
      totalAmount: String(baseAmount),
    };

    if (existing) {
      await prisma.payrollItem.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.payrollItem.create({
        data: {
          payrollId: payroll.id,
          staffUserId: rule.staffUserId,
          salaryRuleId: rule.id,
          classId: rule.classId,
          ...data,
        },
      });
    }
  }

  await audit({
    userId: session.userId,
    action: "payroll.create",
    entityType: "payroll",
    entityId: payroll.id,
  });
  revalidatePath("/payrolls");
  redirect("/payrolls?created=1");
}

export async function adjustPayrollItemAction(
  payrollId: string,
  itemId: string,
  formData: FormData,
) {
  const session = await requirePermission("salary.manage");
  const schema = z.object({
    type: z.enum(["ALLOWANCE", "BONUS", "DEDUCTION"]),
    amount: z.string().trim().min(1),
    note: optionalString,
  });
  const parsed = schema.parse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    note: formData.get("note"),
  });
  const item = await prisma.payrollItem.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    redirect("/payrolls");
  }

  const amount = Number(parsed.amount);
  const nextAllowance =
    Number(item.allowanceAmount.toString()) +
    (parsed.type === "ALLOWANCE" || parsed.type === "BONUS" ? amount : 0);
  const nextDeduction =
    Number(item.deductionAmount.toString()) +
    (parsed.type === "DEDUCTION" ? amount : 0);
  const total =
    Number(item.baseAmount.toString()) + nextAllowance - nextDeduction;

  await prisma.payrollAdjustment.create({
    data: {
      payrollId,
      payrollItemId: itemId,
      staffUserId: item.staffUserId,
      type: parsed.type,
      amount: parsed.amount,
      note: parsed.note,
      createdByUserId: session.userId,
    },
  });
  await prisma.payrollItem.update({
    where: { id: itemId },
    data: {
      allowanceAmount: String(nextAllowance),
      deductionAmount: String(nextDeduction),
      totalAmount: String(total),
    },
  });
  await audit({
    userId: session.userId,
    action: "payroll_item.adjust",
    entityType: "payroll_item",
    entityId: itemId,
    afterData: parsed,
  });
  revalidatePath("/payrolls");
  revalidatePath(`/payrolls/${payrollId}`);
  redirect(`/payrolls/${payrollId}?adjusted=1`);
}

export async function confirmPayrollPaidAction(
  payrollId: string,
  formData: FormData,
) {
  const session = await requirePermission("salary.manage");
  const note = String(formData.get("paidNote") ?? "").trim() || undefined;

  await prisma.payroll.update({
    where: { id: payrollId },
    data: {
      status: PayrollStatus.PAID,
      paidAt: new Date(),
      paidByUserId: session.userId,
      paidNote: note,
    },
  });
  await audit({
    userId: session.userId,
    action: "payroll.paid",
    entityType: "payroll",
    entityId: payrollId,
    afterData: { note },
  });
  revalidatePath("/payrolls");
  revalidatePath(`/payrolls/${payrollId}`);
  redirect(`/payrolls/${payrollId}?paid=1`);
}
