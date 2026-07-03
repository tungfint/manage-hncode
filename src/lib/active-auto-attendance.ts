import {
  AttendanceAutoRoundStatus,
  EnrollmentStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function getActiveAutoAttendancePathForUser(userId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!student) {
    return null;
  }

  const activeRound = await prisma.attendanceAutoRound.findFirst({
    where: {
      status: AttendanceAutoRoundStatus.ACTIVE,
      session: {
        courseClass: {
          students: {
            some: {
              studentId: student.id,
              status: EnrollmentStatus.ACTIVE,
            },
          },
        },
      },
    },
    select: {
      sessionId: true,
    },
    orderBy: { startedAt: "desc" },
  });

  if (!activeRound) {
    return null;
  }

  return `/sessions/${activeRound.sessionId}/check-in`;
}
