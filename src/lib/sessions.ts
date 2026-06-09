import {
  ScheduleStatus,
  SessionTeacherRole,
  TeacherAssignmentRole,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function scheduleDayOfWeek(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function sessionRoleFromTeacherRole(role: TeacherAssignmentRole) {
  return role === TeacherAssignmentRole.MAIN
    ? SessionTeacherRole.MAIN
    : SessionTeacherRole.ASSISTANT;
}

export async function ensureUpcomingSessions(daysAhead = 14) {
  const today = startOfToday();
  const end = new Date(today);
  end.setDate(today.getDate() + daysAhead);

  const schedules = await prisma.classSchedule.findMany({
    where: {
      status: ScheduleStatus.ACTIVE,
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    },
    include: {
      courseClass: {
        include: {
          teachers: {
            where: { status: "ACTIVE" },
          },
        },
      },
    },
  });

  let created = 0;

  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const sessionDate = new Date(today);
    sessionDate.setDate(today.getDate() + offset);

    for (const schedule of schedules) {
      if (scheduleDayOfWeek(sessionDate) !== schedule.dayOfWeek) {
        continue;
      }

      if (schedule.startDate > sessionDate) {
        continue;
      }

      if (schedule.endDate && schedule.endDate < sessionDate) {
        continue;
      }

      const existingSession = await prisma.classSession.findUnique({
        where: {
          classId_sessionDate_startTime: {
            classId: schedule.classId,
            sessionDate,
            startTime: schedule.startTime,
          },
        },
        select: { id: true },
      });
      const session = await prisma.classSession.upsert({
        where: {
          classId_sessionDate_startTime: {
            classId: schedule.classId,
            sessionDate,
            startTime: schedule.startTime,
          },
        },
        update: {
          scheduleId: schedule.id,
          roomId: schedule.roomId,
          endTime: schedule.endTime,
        },
        create: {
          classId: schedule.classId,
          scheduleId: schedule.id,
          sessionDate,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          roomId: schedule.roomId,
        },
      });

      if (!existingSession) {
        created += 1;
      }

      for (const teacher of schedule.courseClass.teachers) {
        await prisma.sessionTeacher.upsert({
          where: {
            sessionId_teacherUserId_role: {
              sessionId: session.id,
              teacherUserId: teacher.teacherUserId,
              role: sessionRoleFromTeacherRole(teacher.teacherRole),
            },
          },
          update: {},
          create: {
            sessionId: session.id,
            teacherUserId: teacher.teacherUserId,
            role: sessionRoleFromTeacherRole(teacher.teacherRole),
          },
        });
      }
    }
  }

  return created;
}
