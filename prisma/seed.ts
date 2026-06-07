import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import {
  AssignmentStatus,
  AttendanceStatus,
  ClassStatus,
  CommentType,
  EnrollmentStatus,
  ExamType,
  Gender,
  PaymentMethod,
  PayrollStatus,
  PrismaClient,
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
} from "../src/generated/prisma/client";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES, type RoleCode } from "../src/lib/permissions";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function seedPermissionsAndRoles() {
  const permissions = new Map<string, { id: string }>();
  const roles = new Map<RoleCode, { id: string }>();

  for (const permission of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { code: permission.code },
      update: { name: permission.name, description: permission.description },
      create: permission,
      select: { id: true },
    });
    permissions.set(permission.code, record);
  }

  for (const role of ROLES) {
    const record = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: role,
      select: { id: true },
    });
    roles.set(role.code, record);
  }

  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSIONS) as [
    RoleCode,
    string[],
  ][]) {
    const role = roles.get(roleCode);

    if (!role) {
      continue;
    }

    for (const permissionCode of permissionCodes) {
      const permission = permissions.get(permissionCode);

      if (!permission) {
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  return roles;
}

async function seedUser(input: {
  name: string;
  email: string;
  phone: string;
  staffType: StaffType;
  roleCodes: RoleCode[];
  bankName?: string;
  bankAccountNumber?: string;
}) {
  const passwordHash = await hash("Password123!", 12);
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      phone: input.phone,
      status: UserStatus.ACTIVE,
    },
    create: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.staffProfile.upsert({
    where: { userId: user.id },
    update: {
      fullName: input.name,
      phone: input.phone,
      email: input.email,
      staffType: input.staffType,
      bankName: input.bankName,
      bankAccountNumber: input.bankAccountNumber,
      status: StaffStatus.ACTIVE,
    },
    create: {
      userId: user.id,
      fullName: input.name,
      phone: input.phone,
      email: input.email,
      staffType: input.staffType,
      bankName: input.bankName,
      bankAccountNumber: input.bankAccountNumber,
      startDate: date("2026-06-01"),
      status: StaffStatus.ACTIVE,
    },
  });

  const roles = await prisma.role.findMany({
    where: { code: { in: input.roleCodes } },
    select: { id: true },
  });

  for (const role of roles) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
      },
    });
  }

  return user;
}

async function findOrCreateBranch() {
  const existing = await prisma.branch.findFirst({ where: { name: "Co so chinh" } });

  if (existing) {
    return prisma.branch.update({
      where: { id: existing.id },
      data: {
        address: "123 Nguyen Trai, Quan 1, TP.HCM",
        phone: "0280000000",
        status: StaffStatus.ACTIVE,
      },
    });
  }

  return prisma.branch.create({
    data: {
      name: "Co so chinh",
      address: "123 Nguyen Trai, Quan 1, TP.HCM",
      phone: "0280000000",
      status: StaffStatus.ACTIVE,
    },
  });
}

async function seedPortalUser(input: {
  name: string;
  email: string;
  phone?: string;
  roleCode: "student" | "parent";
}) {
  const passwordHash = await hash("Password123!", 12);
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      phone: input.phone,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    },
    create: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    },
  });
  const role = await prisma.role.findUnique({
    where: { code: input.roleCode },
    select: { id: true },
  });

  if (role) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
      },
    });
  }

  return user;
}

async function seedParent(input: {
  fullName: string;
  phone: string;
  email: string;
  address?: string;
}) {
  const user = await seedPortalUser({
    name: input.fullName,
    email: input.email,
    phone: input.phone,
    roleCode: "parent",
  });
  const existing =
    (await prisma.parent.findFirst({ where: { phone: input.phone } })) ??
    (await prisma.parent.findFirst({ where: { email: input.email } }));

  if (existing) {
    return prisma.parent.update({
      where: { id: existing.id },
      data: {
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        address: input.address,
        userId: user.id,
      },
    });
  }

  return prisma.parent.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      address: input.address,
      userId: user.id,
    },
  });
}

async function seedStudent(input: {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  school: string;
  schoolGrade: string;
  hncodeAccount: string;
  parent: Awaited<ReturnType<typeof seedParent>>;
  relationship?: string;
}) {
  const user = await seedPortalUser({
    name: input.fullName,
    email: input.email,
    phone: input.phone,
    roleCode: "student",
  });
  const student = await prisma.student.upsert({
    where: { email: input.email },
    update: {
      userId: user.id,
      fullName: input.fullName,
      phone: input.phone,
      dateOfBirth: date(input.dateOfBirth),
      gender: input.gender,
      school: input.school,
      schoolGrade: input.schoolGrade,
      hncodeAccount: input.hncodeAccount,
      status: StudentStatus.STUDYING,
    },
    create: {
      userId: user.id,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      dateOfBirth: date(input.dateOfBirth),
      gender: input.gender,
      school: input.school,
      schoolGrade: input.schoolGrade,
      hncodeAccount: input.hncodeAccount,
      status: StudentStatus.STUDYING,
    },
  });

  await prisma.studentParent.upsert({
    where: {
      studentId_parentId: {
        studentId: student.id,
        parentId: input.parent.id,
      },
    },
    update: { relationship: input.relationship ?? "Phụ huynh" },
    create: {
      studentId: student.id,
      parentId: input.parent.id,
      relationship: input.relationship ?? "Phụ huynh",
    },
  });

  return student;
}

async function seedClass(input: {
  classCode: string;
  name: string;
  subject: string;
  level: string;
  branchId: string;
  roomId: string;
  startDate: string;
  expectedEndDate: string;
  tuitionFee: string;
  tuitionMode?: TuitionCalculationMode;
  tuitionPerSession?: string;
  totalSessions: number;
}) {
  const existing = await prisma.courseClass.findUnique({
    where: { classCode: input.classCode },
  });
  const data = {
    name: input.name,
    subject: input.subject,
    level: input.level,
    branchId: input.branchId,
    roomId: input.roomId,
    startDate: date(input.startDate),
    expectedEndDate: date(input.expectedEndDate),
    status: ClassStatus.ACTIVE,
    tuitionFee: input.tuitionFee,
    tuitionMode: input.tuitionMode ?? TuitionCalculationMode.COURSE,
    tuitionPerSession: input.tuitionPerSession,
    totalSessions: input.totalSessions,
  };

  if (existing) {
    return prisma.courseClass.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.courseClass.create({
    data: {
      classCode: input.classCode,
      ...data,
    },
  });
}

async function seedClassStudent(classId: string, studentId: string, joinedAt: string) {
  await prisma.classStudent.upsert({
    where: {
      classId_studentId: {
        classId,
        studentId,
      },
    },
    update: { status: EnrollmentStatus.ACTIVE },
    create: {
      classId,
      studentId,
      joinedAt: date(joinedAt),
      status: EnrollmentStatus.ACTIVE,
    },
  });
}

async function seedClassTeacher(input: {
  classId: string;
  teacherUserId: string;
  teacherRole: TeacherAssignmentRole;
}) {
  await prisma.classTeacher.upsert({
    where: {
      classId_teacherUserId_teacherRole: input,
    },
    update: { status: AssignmentStatus.ACTIVE },
    create: {
      ...input,
      status: AssignmentStatus.ACTIVE,
    },
  });
}

async function seedSession(input: {
  classId: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  roomId: string;
  lessonContent: string;
  teacherUserId: string;
  assistantUserId?: string;
}) {
  const session = await prisma.classSession.upsert({
    where: {
      classId_sessionDate_startTime: {
        classId: input.classId,
        sessionDate: date(input.sessionDate),
        startTime: input.startTime,
      },
    },
    update: {
      roomId: input.roomId,
      endTime: input.endTime,
      lessonContent: input.lessonContent,
      status: SessionStatus.COMPLETED,
      completedAt: date(input.sessionDate),
    },
    create: {
      classId: input.classId,
      sessionDate: date(input.sessionDate),
      startTime: input.startTime,
      endTime: input.endTime,
      roomId: input.roomId,
      lessonContent: input.lessonContent,
      homework: "Hoàn thành bài tập trên hệ thống HNCode",
      status: SessionStatus.COMPLETED,
      completedAt: date(input.sessionDate),
    },
  });

  await prisma.sessionTeacher.upsert({
    where: {
      sessionId_teacherUserId_role: {
        sessionId: session.id,
        teacherUserId: input.teacherUserId,
        role: SessionTeacherRole.MAIN,
      },
    },
    update: { actualStartTime: input.startTime, actualEndTime: input.endTime },
    create: {
      sessionId: session.id,
      teacherUserId: input.teacherUserId,
      role: SessionTeacherRole.MAIN,
      actualStartTime: input.startTime,
      actualEndTime: input.endTime,
    },
  });

  if (input.assistantUserId) {
    await prisma.sessionTeacher.upsert({
      where: {
        sessionId_teacherUserId_role: {
          sessionId: session.id,
          teacherUserId: input.assistantUserId,
          role: SessionTeacherRole.ASSISTANT,
        },
      },
      update: { actualStartTime: input.startTime, actualEndTime: input.endTime },
      create: {
        sessionId: session.id,
        teacherUserId: input.assistantUserId,
        role: SessionTeacherRole.ASSISTANT,
        actualStartTime: input.startTime,
        actualEndTime: input.endTime,
      },
    });
  }

  return session;
}

async function main() {
  await seedPermissionsAndRoles();

  const admin = await seedUser({
    name: "Quan ly trung tam",
    email: "admin@trungtam.test",
    phone: "0900000001",
    staffType: StaffType.ADMIN,
    roleCodes: ["admin"],
  });

  const teacher = await seedUser({
    name: "Co Linh",
    email: "linh.teacher@trungtam.test",
    phone: "0900000002",
    staffType: StaffType.TEACHER_MAIN,
    roleCodes: ["teacher_main"],
    bankName: "VCB",
    bankAccountNumber: "0123456789",
  });

  const assistant = await seedUser({
    name: "Thay Minh",
    email: "minh.assistant@trungtam.test",
    phone: "0900000003",
    staffType: StaffType.TEACHER_ASSISTANT,
    roleCodes: ["teacher_assistant"],
  });

  const accountant = await seedUser({
    name: "Chi Hoa",
    email: "hoa.accountant@trungtam.test",
    phone: "0900000004",
    staffType: StaffType.ACCOUNTANT,
    roleCodes: ["accountant"],
    bankName: "ACB",
    bankAccountNumber: "0987654321",
  });

  const receptionist = await seedUser({
    name: "Le tan An",
    email: "an.reception@trungtam.test",
    phone: "0900000005",
    staffType: StaffType.RECEPTIONIST,
    roleCodes: ["receptionist"],
  });

  const academic = await seedUser({
    name: "Hoc vu Mai",
    email: "mai.academic@trungtam.test",
    phone: "0900000006",
    staffType: StaffType.ACADEMIC,
    roleCodes: ["academic"],
    bankName: "TCB",
    bankAccountNumber: "190012345678",
  });

  const collaborator = await seedUser({
    name: "Cong tac vien Nam",
    email: "nam.collab@trungtam.test",
    phone: "0900000007",
    staffType: StaffType.COLLABORATOR,
    roleCodes: ["collaborator"],
  });

  const partTime = await seedUser({
    name: "Thoi vu Binh",
    email: "binh.parttime@trungtam.test",
    phone: "0900000008",
    staffType: StaffType.PART_TIME,
    roleCodes: ["part_time"],
  });

  const branch = await findOrCreateBranch();
  const room = await prisma.room.upsert({
    where: { branchId_name: { branchId: branch.id, name: "P. Toan 1" } },
    update: { capacity: 18, status: "ACTIVE" },
    create: {
      branchId: branch.id,
      name: "P. Toan 1",
      capacity: 18,
      status: "ACTIVE",
    },
  });

  const roomLab = await prisma.room.upsert({
    where: { branchId_name: { branchId: branch.id, name: "Lab Lap Trinh" } },
    update: { capacity: 16, status: "ACTIVE" },
    create: {
      branchId: branch.id,
      name: "Lab Lap Trinh",
      capacity: 16,
      status: "ACTIVE",
    },
  });

  const parent =
    (await prisma.parent.findFirst({ where: { phone: "0911000001" } })) ??
    (await prisma.parent.create({
      data: {
        fullName: "Nguyen Thi Lan",
        phone: "0911000001",
        email: "lan.parent@example.com",
        address: "Quan 3, TP.HCM",
        note: "Uu tien nhan thong bao qua Zalo",
      },
    }));

  const student =
    (await prisma.student.findFirst({ where: { fullName: "Nguyen Minh Anh" } })) ??
    (await prisma.student.create({
      data: {
        fullName: "Nguyen Minh Anh",
        dateOfBirth: date("2013-08-12"),
        gender: Gender.FEMALE,
        school: "THCS Nguyen Du",
        schoolGrade: "Lop 6",
        entryLevel: "Can cung co dai so co ban",
        status: StudentStatus.STUDYING,
      },
    }));

  await prisma.studentParent.upsert({
    where: {
      studentId_parentId: {
        studentId: student.id,
        parentId: parent.id,
      },
    },
    update: { relationship: "Me" },
    create: {
      studentId: student.id,
      parentId: parent.id,
      relationship: "Me",
    },
  });

  const courseClass =
    (await prisma.courseClass.findFirst({ where: { name: "Toan 6A - Co ban" } })) ??
    (await prisma.courseClass.create({
      data: {
        classCode: "TOAN6A-CB-K01",
        name: "Toan 6A - Co ban",
        subject: "Toan",
        level: "Lop 6",
        branchId: branch.id,
        roomId: room.id,
        startDate: date("2026-06-10"),
        expectedEndDate: date("2026-09-10"),
        status: ClassStatus.ACTIVE,
        tuitionFee: "2500000",
        totalSessions: 24,
        note: "Lop mau cho MVP",
      },
    }));

  await prisma.courseClass.update({
    where: { id: courseClass.id },
    data: {
      branchId: branch.id,
      roomId: room.id,
      classCode: "TOAN6A-CB-K01",
      status: ClassStatus.ACTIVE,
      tuitionFee: "2500000",
      totalSessions: 24,
    },
  });

  await prisma.classStudent.upsert({
    where: {
      classId_studentId: {
        classId: courseClass.id,
        studentId: student.id,
      },
    },
    update: { status: EnrollmentStatus.ACTIVE },
    create: {
      classId: courseClass.id,
      studentId: student.id,
      status: EnrollmentStatus.ACTIVE,
      joinedAt: date("2026-06-10"),
    },
  });

  for (const assignment of [
    { userId: teacher.id, role: TeacherAssignmentRole.MAIN },
    { userId: assistant.id, role: TeacherAssignmentRole.ASSISTANT },
  ]) {
    await prisma.classTeacher.upsert({
      where: {
        classId_teacherUserId_teacherRole: {
          classId: courseClass.id,
          teacherUserId: assignment.userId,
          teacherRole: assignment.role,
        },
      },
      update: { status: AssignmentStatus.ACTIVE },
      create: {
        classId: courseClass.id,
        teacherUserId: assignment.userId,
        teacherRole: assignment.role,
        status: AssignmentStatus.ACTIVE,
      },
    });
  }

  const schedule =
    (await prisma.classSchedule.findFirst({
      where: {
        classId: courseClass.id,
        dayOfWeek: 2,
        startTime: "18:00",
      },
    })) ??
    (await prisma.classSchedule.create({
      data: {
        classId: courseClass.id,
        dayOfWeek: 2,
        startTime: "18:00",
        endTime: "19:30",
        roomId: room.id,
        startDate: date("2026-06-10"),
        status: ScheduleStatus.ACTIVE,
      },
    }));

  const session = await prisma.classSession.upsert({
    where: {
      classId_sessionDate_startTime: {
        classId: courseClass.id,
        sessionDate: date("2026-06-10"),
        startTime: "18:00",
      },
    },
    update: {
      scheduleId: schedule.id,
      roomId: room.id,
      status: SessionStatus.COMPLETED,
      lessonContent: "On tap so tu nhien va phan so co ban",
      homework: "Bai 1-8 trang 12",
      completedAt: date("2026-06-10"),
    },
    create: {
      classId: courseClass.id,
      scheduleId: schedule.id,
      sessionDate: date("2026-06-10"),
      startTime: "18:00",
      endTime: "19:30",
      roomId: room.id,
      status: SessionStatus.COMPLETED,
      lessonContent: "On tap so tu nhien va phan so co ban",
      homework: "Bai 1-8 trang 12",
      completedAt: date("2026-06-10"),
    },
  });

  await prisma.sessionTeacher.upsert({
    where: {
      sessionId_teacherUserId_role: {
        sessionId: session.id,
        teacherUserId: teacher.id,
        role: SessionTeacherRole.MAIN,
      },
    },
    update: { actualStartTime: "18:00", actualEndTime: "19:30" },
    create: {
      sessionId: session.id,
      teacherUserId: teacher.id,
      role: SessionTeacherRole.MAIN,
      actualStartTime: "18:00",
      actualEndTime: "19:30",
    },
  });

  await prisma.attendance.upsert({
    where: {
      sessionId_studentId: {
        sessionId: session.id,
        studentId: student.id,
      },
    },
    update: { status: AttendanceStatus.PRESENT, markedByUserId: teacher.id },
    create: {
      sessionId: session.id,
      studentId: student.id,
      status: AttendanceStatus.PRESENT,
      markedByUserId: teacher.id,
      note: "Hoc tap trung",
    },
  });

  const existingComment = await prisma.studentComment.findFirst({
    where: {
      studentId: student.id,
      sessionId: session.id,
      commentType: CommentType.SESSION,
    },
  });

  if (existingComment) {
    await prisma.studentComment.update({
      where: { id: existingComment.id },
      data: { content: "Nam chac bai cu, can trinh bay loi giai ro hon." },
    });
  } else {
    await prisma.studentComment.create({
      data: {
        studentId: student.id,
        classId: courseClass.id,
        sessionId: session.id,
        commentType: CommentType.SESSION,
        content: "Nam chac bai cu, can trinh bay loi giai ro hon.",
        createdByUserId: teacher.id,
      },
    });
  }

  const exam =
    (await prisma.exam.findFirst({
      where: { classId: courseClass.id, name: "Kiem tra dau vao" },
    })) ??
    (await prisma.exam.create({
      data: {
        classId: courseClass.id,
        name: "Kiem tra dau vao",
        examDate: date("2026-06-09"),
        examType: ExamType.ENTRY,
        maxScore: "10",
        description: "Danh gia ban dau cho lop Toan 6A",
        createdByUserId: teacher.id,
      },
    }));

  await prisma.score.upsert({
    where: {
      examId_studentId: {
        examId: exam.id,
        studentId: student.id,
      },
    },
    update: {
      score: "8.25",
      comment: "Nen luyen them bai toan co loi van.",
      updatedByUserId: teacher.id,
    },
    create: {
      examId: exam.id,
      studentId: student.id,
      score: "8.25",
      comment: "Nen luyen them bai toan co loi van.",
      createdByUserId: teacher.id,
    },
  });

  const tuitionCharge =
    (await prisma.tuitionCharge.findFirst({
      where: { studentId: student.id, classId: courseClass.id },
    })) ??
    (await prisma.tuitionCharge.create({
      data: {
        studentId: student.id,
        classId: courseClass.id,
        amountDue: "2500000",
        amountPaid: "1000000",
        dueDate: date("2026-06-15"),
        status: TuitionStatus.PARTIAL,
        note: "Hoc phi thang dau",
        createdByUserId: accountant.id,
      },
    }));

  await prisma.tuitionCharge.update({
    where: { id: tuitionCharge.id },
    data: {
      amountDue: "2500000",
      amountPaid: "1000000",
      status: TuitionStatus.PARTIAL,
    },
  });

  const existingPayment = await prisma.payment.findFirst({
    where: {
      tuitionChargeId: tuitionCharge.id,
      amount: "1000000",
    },
  });

  if (!existingPayment) {
    await prisma.payment.create({
      data: {
        tuitionChargeId: tuitionCharge.id,
        amount: "1000000",
        method: PaymentMethod.BANK_TRANSFER,
        receivedByUserId: accountant.id,
        note: "Thanh toan lan 1",
      },
    });
  }

  const salaryRule =
    (await prisma.salaryRule.findFirst({
      where: {
        staffUserId: teacher.id,
        classId: courseClass.id,
        salaryType: SalaryType.PER_SESSION,
      },
    })) ??
    (await prisma.salaryRule.create({
      data: {
        staffUserId: teacher.id,
        classId: courseClass.id,
        staffRole: "Giao vien chinh",
        salaryType: SalaryType.PER_SESSION,
        amount: "300000",
        effectiveFrom: date("2026-06-01"),
        status: SalaryRuleStatus.ACTIVE,
      },
    }));

  const accountantSalaryRule =
    (await prisma.salaryRule.findFirst({
      where: {
        staffUserId: accountant.id,
        classId: null,
        salaryType: SalaryType.PER_HOUR,
      },
    })) ??
    (await prisma.salaryRule.create({
      data: {
        staffUserId: accountant.id,
        workName: "Hanh chinh ke toan",
        salaryType: SalaryType.PER_HOUR,
        amount: "50000",
        effectiveFrom: date("2026-06-01"),
        status: SalaryRuleStatus.ACTIVE,
      },
    }));

  await prisma.staffAttendance.upsert({
    where: {
      staffUserId_workDate_shiftName: {
        staffUserId: accountant.id,
        workDate: date("2026-06-10"),
        shiftName: "Ca hanh chinh",
      },
    },
    update: {
      checkIn: "08:00",
      checkOut: "12:00",
      hoursCount: "4",
      workName: "Thu hoc phi va doi soat cong no",
      status: StaffAttendanceStatus.PRESENT,
      confirmedByUserId: admin.id,
    },
    create: {
      staffUserId: accountant.id,
      workDate: date("2026-06-10"),
      checkIn: "08:00",
      checkOut: "12:00",
      hoursCount: "4",
      shiftName: "Ca hanh chinh",
      workName: "Thu hoc phi va doi soat cong no",
      status: StaffAttendanceStatus.PRESENT,
      confirmedByUserId: admin.id,
    },
  });

  await prisma.staffAttendance.upsert({
    where: {
      staffUserId_workDate_shiftName: {
        staffUserId: receptionist.id,
        workDate: date("2026-06-10"),
        shiftName: "Ca toi",
      },
    },
    update: {
      checkIn: "17:30",
      checkOut: "20:30",
      hoursCount: "3",
      workName: "Don lop va ho tro phu huynh",
      status: StaffAttendanceStatus.PRESENT,
      confirmedByUserId: admin.id,
    },
    create: {
      staffUserId: receptionist.id,
      workDate: date("2026-06-10"),
      checkIn: "17:30",
      checkOut: "20:30",
      hoursCount: "3",
      shiftName: "Ca toi",
      workName: "Don lop va ho tro phu huynh",
      status: StaffAttendanceStatus.PRESENT,
      confirmedByUserId: admin.id,
    },
  });

  const payroll = await prisma.payroll.upsert({
    where: { month_year: { month: 6, year: 2026 } },
    update: { status: PayrollStatus.DRAFT },
    create: {
      month: 6,
      year: 2026,
      status: PayrollStatus.DRAFT,
      createdByUserId: accountant.id,
    },
  });

  const existingPayrollItem = await prisma.payrollItem.findFirst({
    where: {
      payrollId: payroll.id,
      staffUserId: teacher.id,
      salaryRuleId: salaryRule.id,
    },
  });

  if (existingPayrollItem) {
    await prisma.payrollItem.update({
      where: { id: existingPayrollItem.id },
      data: {
        sessionsCount: 1,
        baseAmount: "300000",
        totalAmount: "300000",
      },
    });
  } else {
    await prisma.payrollItem.create({
      data: {
        payrollId: payroll.id,
        staffUserId: teacher.id,
        salaryRuleId: salaryRule.id,
        classId: courseClass.id,
        sessionsCount: 1,
        baseAmount: "300000",
        totalAmount: "300000",
      },
    });
  }

  const existingAccountantPayrollItem = await prisma.payrollItem.findFirst({
    where: {
      payrollId: payroll.id,
      staffUserId: accountant.id,
      salaryRuleId: accountantSalaryRule.id,
    },
  });

  if (existingAccountantPayrollItem) {
    await prisma.payrollItem.update({
      where: { id: existingAccountantPayrollItem.id },
      data: {
        hoursCount: "4",
        baseAmount: "200000",
        totalAmount: "200000",
      },
    });
  } else {
    await prisma.payrollItem.create({
      data: {
        payrollId: payroll.id,
        staffUserId: accountant.id,
        salaryRuleId: accountantSalaryRule.id,
        hoursCount: "4",
        baseAmount: "200000",
        totalAmount: "200000",
      },
    });
  }

  const testParents = await Promise.all([
    seedParent({
      fullName: "Tran Thi Huong",
      phone: "0912000001",
      email: "huong.parent@hncode.test",
      address: "Quan 7, TP.HCM",
    }),
    seedParent({
      fullName: "Pham Van Duc",
      phone: "0912000002",
      email: "duc.parent@hncode.test",
      address: "Thu Duc, TP.HCM",
    }),
    seedParent({
      fullName: "Le Minh Tam",
      phone: "0912000003",
      email: "tam.parent@hncode.test",
      address: "Quan Binh Thanh, TP.HCM",
    }),
    seedParent({
      fullName: "Do Thu Ha",
      phone: "0912000004",
      email: "ha.parent@hncode.test",
      address: "Quan 10, TP.HCM",
    }),
  ]);

  const testStudents = await Promise.all([
    seedStudent({
      fullName: "Tran Gia Bao",
      email: "bao.student@hncode.test",
      phone: "0989000001",
      dateOfBirth: "2014-03-12",
      gender: Gender.MALE,
      school: "THCS Le Quy Don",
      schoolGrade: "Lop 6",
      hncodeAccount: "bao.tran",
      parent: testParents[0],
      relationship: "Me",
    }),
    seedStudent({
      fullName: "Pham Tue Anh",
      email: "tueanh.student@hncode.test",
      phone: "0989000002",
      dateOfBirth: "2015-07-22",
      gender: Gender.FEMALE,
      school: "THCS Nguyen Hue",
      schoolGrade: "Lop 5",
      hncodeAccount: "tueanh.pham",
      parent: testParents[1],
      relationship: "Bo",
    }),
    seedStudent({
      fullName: "Le Hoang Khang",
      email: "khang.student@hncode.test",
      phone: "0989000003",
      dateOfBirth: "2013-11-05",
      gender: Gender.MALE,
      school: "THCS Tran Dai Nghia",
      schoolGrade: "Lop 7",
      hncodeAccount: "khang.le",
      parent: testParents[2],
      relationship: "Bo",
    }),
    seedStudent({
      fullName: "Do Ngoc Linh",
      email: "linh.student@hncode.test",
      phone: "0989000004",
      dateOfBirth: "2016-01-18",
      gender: Gender.FEMALE,
      school: "Tieu hoc Nguyen Du",
      schoolGrade: "Lop 4",
      hncodeAccount: "linh.do",
      parent: testParents[3],
      relationship: "Me",
    }),
  ]);

  const pythonClass = await seedClass({
    classCode: "PYTHON-KIDS-K01",
    name: "Python Kids K01",
    subject: "Lap trinh Python",
    level: "Co ban",
    branchId: branch.id,
    roomId: roomLab.id,
    startDate: "2026-06-03",
    expectedEndDate: "2026-08-26",
    tuitionFee: "3200000",
    tuitionMode: TuitionCalculationMode.PER_SESSION_TOTAL,
    tuitionPerSession: "200000",
    totalSessions: 16,
  });
  const scratchClass = await seedClass({
    classCode: "SCRATCH-CB-K01",
    name: "Scratch Co Ban K01",
    subject: "Scratch",
    level: "Nhap mon",
    branchId: branch.id,
    roomId: roomLab.id,
    startDate: "2026-06-05",
    expectedEndDate: "2026-08-28",
    tuitionFee: "2800000",
    totalSessions: 14,
  });
  const webClass = await seedClass({
    classCode: "WEB-JS-K01",
    name: "Web JavaScript K01",
    subject: "Web",
    level: "Co ban",
    branchId: branch.id,
    roomId: roomLab.id,
    startDate: "2026-06-08",
    expectedEndDate: "2026-09-08",
    tuitionFee: "3600000",
    tuitionMode: TuitionCalculationMode.PER_SESSION_ACTUAL,
    tuitionPerSession: "240000",
    totalSessions: 15,
  });

  await Promise.all([
    seedClassTeacher({
      classId: pythonClass.id,
      teacherUserId: teacher.id,
      teacherRole: TeacherAssignmentRole.MAIN,
    }),
    seedClassTeacher({
      classId: pythonClass.id,
      teacherUserId: assistant.id,
      teacherRole: TeacherAssignmentRole.ASSISTANT,
    }),
    seedClassTeacher({
      classId: scratchClass.id,
      teacherUserId: assistant.id,
      teacherRole: TeacherAssignmentRole.MAIN,
    }),
    seedClassTeacher({
      classId: webClass.id,
      teacherUserId: teacher.id,
      teacherRole: TeacherAssignmentRole.MAIN,
    }),
  ]);

  await Promise.all([
    seedClassStudent(pythonClass.id, testStudents[0].id, "2026-06-03"),
    seedClassStudent(pythonClass.id, testStudents[1].id, "2026-06-03"),
    seedClassStudent(pythonClass.id, testStudents[2].id, "2026-06-03"),
    seedClassStudent(scratchClass.id, testStudents[1].id, "2026-06-05"),
    seedClassStudent(scratchClass.id, testStudents[3].id, "2026-06-05"),
    seedClassStudent(webClass.id, testStudents[0].id, "2026-06-08"),
    seedClassStudent(webClass.id, testStudents[2].id, "2026-06-08"),
  ]);

  const seededSessions = await Promise.all([
    seedSession({
      classId: pythonClass.id,
      sessionDate: "2026-06-03",
      startTime: "18:00",
      endTime: "19:30",
      roomId: roomLab.id,
      lessonContent: "Lam quen bien, kieu du lieu va lenh print",
      teacherUserId: teacher.id,
      assistantUserId: assistant.id,
    }),
    seedSession({
      classId: pythonClass.id,
      sessionDate: "2026-06-10",
      startTime: "18:00",
      endTime: "19:30",
      roomId: roomLab.id,
      lessonContent: "Cau lenh dieu kien if/else",
      teacherUserId: teacher.id,
      assistantUserId: assistant.id,
    }),
    seedSession({
      classId: scratchClass.id,
      sessionDate: "2026-06-05",
      startTime: "17:30",
      endTime: "19:00",
      roomId: roomLab.id,
      lessonContent: "Chuyen dong nhan vat va su kien",
      teacherUserId: assistant.id,
    }),
    seedSession({
      classId: webClass.id,
      sessionDate: "2026-06-08",
      startTime: "19:30",
      endTime: "21:00",
      roomId: roomLab.id,
      lessonContent: "HTML semantic va CSS layout",
      teacherUserId: teacher.id,
    }),
  ]);

  const attendanceInputs = [
    { session: seededSessions[0], student: testStudents[0], status: AttendanceStatus.PRESENT, note: "Tich cuc tra loi" },
    { session: seededSessions[0], student: testStudents[1], status: AttendanceStatus.LATE, note: "Muon 10 phut" },
    { session: seededSessions[0], student: testStudents[2], status: AttendanceStatus.PRESENT, note: "Lam bai nhanh" },
    { session: seededSessions[1], student: testStudents[0], status: AttendanceStatus.PRESENT, note: "Hoan thanh bai tap" },
    { session: seededSessions[1], student: testStudents[1], status: AttendanceStatus.ABSENT_EXCUSED, note: "Xin nghi om" },
    { session: seededSessions[1], student: testStudents[2], status: AttendanceStatus.PRESENT, note: "Can on lai if/else" },
    { session: seededSessions[2], student: testStudents[1], status: AttendanceStatus.PRESENT, note: "Sang tao voi nhan vat" },
    { session: seededSessions[2], student: testStudents[3], status: AttendanceStatus.PRESENT, note: "Can goi y them" },
    { session: seededSessions[3], student: testStudents[0], status: AttendanceStatus.PRESENT, note: "Nam HTML tot" },
    { session: seededSessions[3], student: testStudents[2], status: AttendanceStatus.LEFT_EARLY, note: "Ve som 15 phut" },
  ];

  for (const item of attendanceInputs) {
    await prisma.attendance.upsert({
      where: {
        sessionId_studentId: {
          sessionId: item.session.id,
          studentId: item.student.id,
        },
      },
      update: { status: item.status, note: item.note, markedByUserId: teacher.id },
      create: {
        sessionId: item.session.id,
        studentId: item.student.id,
        status: item.status,
        note: item.note,
        markedByUserId: teacher.id,
      },
    });
  }

  for (const item of [
    {
      student: testStudents[0],
      classId: pythonClass.id,
      sessionId: seededSessions[0].id,
      content: "Bao nam cu phap nhanh, nen tap dat ten bien ro nghia hon.",
    },
    {
      student: testStudents[1],
      classId: scratchClass.id,
      sessionId: seededSessions[2].id,
      content: "Tue Anh tu tin trinh bay san pham, can can than khi luu file.",
    },
    {
      student: testStudents[2],
      classId: webClass.id,
      sessionId: seededSessions[3].id,
      content: "Khang hieu bo cuc web, can luyen them responsive.",
    },
  ]) {
    const existing = await prisma.studentComment.findFirst({
      where: {
        studentId: item.student.id,
        classId: item.classId,
        sessionId: item.sessionId,
      },
    });

    if (existing) {
      await prisma.studentComment.update({
        where: { id: existing.id },
        data: { content: item.content },
      });
    } else {
      await prisma.studentComment.create({
        data: {
          studentId: item.student.id,
          classId: item.classId,
          sessionId: item.sessionId,
          commentType: CommentType.SESSION,
          content: item.content,
          createdByUserId: teacher.id,
        },
      });
    }
  }

  const pythonExam =
    (await prisma.exam.findFirst({
      where: { classId: pythonClass.id, name: "Kiem tra Python buoi 2" },
    })) ??
    (await prisma.exam.create({
      data: {
        classId: pythonClass.id,
        name: "Kiem tra Python buoi 2",
        examDate: date("2026-06-12"),
        examType: ExamType.PERIODIC,
        maxScore: "10",
        description: "Kiem tra bien va cau lenh dieu kien",
        createdByUserId: teacher.id,
      },
    }));
  const webExam =
    (await prisma.exam.findFirst({
      where: { classId: webClass.id, name: "Kiem tra HTML CSS" },
    })) ??
    (await prisma.exam.create({
      data: {
        classId: webClass.id,
        name: "Kiem tra HTML CSS",
        examDate: date("2026-06-13"),
        examType: ExamType.PERIODIC,
        maxScore: "10",
        description: "Kiem tra HTML semantic va CSS layout",
        createdByUserId: teacher.id,
      },
    }));

  for (const item of [
    { examId: pythonExam.id, studentId: testStudents[0].id, score: "8.75", comment: "Tu duy tot" },
    { examId: pythonExam.id, studentId: testStudents[1].id, score: "7.50", comment: "Can luyen them if/else" },
    { examId: pythonExam.id, studentId: testStudents[2].id, score: "9.00", comment: "Lam bai gon" },
    { examId: webExam.id, studentId: testStudents[0].id, score: "8.25", comment: "Bo cuc tot" },
    { examId: webExam.id, studentId: testStudents[2].id, score: "7.75", comment: "Can cai thien CSS" },
  ]) {
    await prisma.score.upsert({
      where: {
        examId_studentId: {
          examId: item.examId,
          studentId: item.studentId,
        },
      },
      update: {
        score: item.score,
        comment: item.comment,
        updatedByUserId: teacher.id,
      },
      create: {
        examId: item.examId,
        studentId: item.studentId,
        score: item.score,
        comment: item.comment,
        createdByUserId: teacher.id,
      },
    });
  }

  for (const item of [
    { student: testStudents[0], klass: pythonClass, amount: "3200000", paid: "1600000", status: TuitionStatus.PARTIAL },
    { student: testStudents[1], klass: pythonClass, amount: "3200000", paid: "3200000", status: TuitionStatus.PAID },
    { student: testStudents[2], klass: pythonClass, amount: "3200000", paid: "0", status: TuitionStatus.UNPAID },
    { student: testStudents[3], klass: scratchClass, amount: "2800000", paid: "1000000", status: TuitionStatus.PARTIAL },
    { student: testStudents[0], klass: webClass, amount: "3600000", paid: "0", status: TuitionStatus.UNPAID },
  ]) {
    const charge =
      (await prisma.tuitionCharge.findFirst({
        where: { studentId: item.student.id, classId: item.klass.id },
      })) ??
      (await prisma.tuitionCharge.create({
        data: {
          studentId: item.student.id,
          classId: item.klass.id,
          amountDue: item.amount,
          amountPaid: item.paid,
          dueDate: date("2026-06-20"),
          status: item.status,
          createdByUserId: accountant.id,
        },
      }));

    await prisma.tuitionCharge.update({
      where: { id: charge.id },
      data: {
        amountDue: item.amount,
        amountPaid: item.paid,
        status: item.status,
      },
    });

    if (Number(item.paid) > 0) {
      const existingPaid = await prisma.payment.findFirst({
        where: { tuitionChargeId: charge.id, amount: item.paid },
      });

      if (!existingPaid) {
        await prisma.payment.create({
          data: {
            tuitionChargeId: charge.id,
            amount: item.paid,
            method: PaymentMethod.BANK_TRANSFER,
            receivedByUserId: accountant.id,
            note: "Thanh toan seed test",
          },
        });
      }
    }
  }

  for (const item of [
    {
      staffUserId: receptionist.id,
      workDate: "2026-06-11",
      shiftName: "Ca toi",
      checkIn: "17:00",
      checkOut: "21:00",
      hoursCount: "4",
      workName: "Don tiep phu huynh va diem danh dau gio",
    },
    {
      staffUserId: academic.id,
      workDate: "2026-06-11",
      shiftName: "Ca hanh chinh",
      checkIn: "08:30",
      checkOut: "17:30",
      hoursCount: "8",
      workName: "Xep lich va kiem tra bao cao hoc tap",
    },
    {
      staffUserId: collaborator.id,
      workDate: "2026-06-12",
      shiftName: "Ho tro su kien",
      checkIn: "18:00",
      checkOut: "21:00",
      hoursCount: "3",
      workName: "Ho tro workshop lap trinh",
    },
    {
      staffUserId: partTime.id,
      workDate: "2026-06-12",
      shiftName: "Ca toi",
      checkIn: "17:30",
      checkOut: "20:30",
      hoursCount: "3",
      workName: "Ve sinh phong hoc va sap xep thiet bi",
    },
  ]) {
    await prisma.staffAttendance.upsert({
      where: {
        staffUserId_workDate_shiftName: {
          staffUserId: item.staffUserId,
          workDate: date(item.workDate),
          shiftName: item.shiftName,
        },
      },
      update: {
        checkIn: item.checkIn,
        checkOut: item.checkOut,
        hoursCount: item.hoursCount,
        workName: item.workName,
        status: StaffAttendanceStatus.PRESENT,
        confirmedByUserId: admin.id,
      },
      create: {
        staffUserId: item.staffUserId,
        workDate: date(item.workDate),
        shiftName: item.shiftName,
        checkIn: item.checkIn,
        checkOut: item.checkOut,
        hoursCount: item.hoursCount,
        workName: item.workName,
        status: StaffAttendanceStatus.PRESENT,
        confirmedByUserId: admin.id,
      },
    });
  }

  for (const item of [
    { staffUserId: receptionist.id, workName: "Le tan ca toi", salaryType: SalaryType.PER_SHIFT, amount: "180000" },
    { staffUserId: academic.id, workName: "Hoc vu van hanh", salaryType: SalaryType.PER_HOUR, amount: "60000" },
    { staffUserId: collaborator.id, workName: "Ho tro workshop", salaryType: SalaryType.PER_TASK, amount: "250000" },
    { staffUserId: partTime.id, workName: "Nhan vien thoi vu", salaryType: SalaryType.PER_SHIFT, amount: "150000" },
  ]) {
    const rule =
      (await prisma.salaryRule.findFirst({
        where: {
          staffUserId: item.staffUserId,
          workName: item.workName,
          salaryType: item.salaryType,
        },
      })) ??
      (await prisma.salaryRule.create({
        data: {
          staffUserId: item.staffUserId,
          workName: item.workName,
          salaryType: item.salaryType,
          amount: item.amount,
          effectiveFrom: date("2026-06-01"),
          status: SalaryRuleStatus.ACTIVE,
        },
      }));

    await prisma.salaryRule.update({
      where: { id: rule.id },
      data: {
        amount: item.amount,
        status: SalaryRuleStatus.ACTIVE,
      },
    });
  }

  const payrollRules = await prisma.salaryRule.findMany({
    where: { status: SalaryRuleStatus.ACTIVE },
  });
  const periodFrom = date("2026-06-01");
  const periodTo = date("2026-06-30");

  for (const rule of payrollRules) {
    const completedSessions =
      rule.classId && rule.salaryType === SalaryType.PER_SESSION
        ? await prisma.sessionTeacher.count({
            where: {
              teacherUserId: rule.staffUserId,
              session: {
                classId: rule.classId,
                sessionDate: { gte: periodFrom, lte: periodTo },
                status: SessionStatus.COMPLETED,
              },
            },
          })
        : 0;
    const staffTimeEntries =
      !rule.classId &&
      (rule.salaryType === SalaryType.PER_HOUR ||
        rule.salaryType === SalaryType.PER_SHIFT ||
        rule.salaryType === SalaryType.PER_TASK)
        ? await prisma.staffAttendance.findMany({
            where: {
              staffUserId: rule.staffUserId,
              workDate: { gte: periodFrom, lte: periodTo },
              status: { in: [StaffAttendanceStatus.PRESENT, StaffAttendanceStatus.LATE, StaffAttendanceStatus.LEFT_EARLY] },
            },
          })
        : [];
    const hoursCount = staffTimeEntries.reduce(
      (sum, item) => sum + Number(item.hoursCount.toString()),
      0,
    );
    const taskCount =
      rule.salaryType === SalaryType.PER_SHIFT ||
      rule.salaryType === SalaryType.PER_TASK
        ? staffTimeEntries.length
        : 0;
    const multiplier =
      rule.salaryType === SalaryType.PER_SESSION
        ? completedSessions
        : rule.salaryType === SalaryType.PER_HOUR
          ? hoursCount
          : rule.salaryType === SalaryType.PER_SHIFT ||
              rule.salaryType === SalaryType.PER_TASK
            ? taskCount
            : 1;
    const baseAmount = Number(rule.amount?.toString() ?? 0) * multiplier;
    const existingItem = await prisma.payrollItem.findFirst({
      where: {
        payrollId: payroll.id,
        staffUserId: rule.staffUserId,
        salaryRuleId: rule.id,
        classId: rule.classId,
      },
    });
    const data = {
      classId: rule.classId,
      sessionsCount: completedSessions,
      hoursCount: String(hoursCount),
      taskCount,
      baseAmount: String(baseAmount),
      totalAmount: String(baseAmount),
    };

    if (existingItem) {
      await prisma.payrollItem.update({
        where: { id: existingItem.id },
        data,
      });
    } else {
      await prisma.payrollItem.create({
        data: {
          payrollId: payroll.id,
          staffUserId: rule.staffUserId,
          salaryRuleId: rule.id,
          ...data,
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "seed.mvp",
      entityType: "system",
      afterData: {
        message: "Seeded MVP data for education center management.",
      },
    },
  });

  console.log("Seed completed.");
  console.log("Default password for seeded users: Password123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
