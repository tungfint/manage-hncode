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
  StaffStatus,
  StaffType,
  StudentStatus,
  TeacherAssignmentRole,
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
      update: { name: permission.name },
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
      status: StaffStatus.ACTIVE,
    },
    create: {
      userId: user.id,
      fullName: input.name,
      phone: input.phone,
      email: input.email,
      staffType: input.staffType,
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
  });

  await seedUser({
    name: "Le tan An",
    email: "an.reception@trungtam.test",
    phone: "0900000005",
    staffType: StaffType.RECEPTIONIST,
    roleCodes: ["receptionist"],
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
