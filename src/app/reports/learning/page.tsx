import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import {
  getAccessibleClassIds,
  getAccessibleStudentIds,
} from "@/lib/data-scope";
import { formatCurrency, formatDate, toSearch } from "@/lib/format";
import { attendanceStatusLabels, studentStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const OPTION_LIMIT = 200;
const CLASS_REPORT_STUDENT_LIMIT = 200;

type LearningReportPageProps = {
  searchParams?: Promise<{
    classId?: string;
    studentId?: string;
  }>;
};

function scoreNumber(value: unknown) {
  const parsed = Number(value?.toString?.() ?? value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function attendanceRate(present: number, total: number) {
  return total ? Math.round((present / total) * 100) : 0;
}

function decimalNumber(value: unknown) {
  return Number(value?.toString?.() ?? 0);
}

export default async function LearningReportPage({
  searchParams,
}: LearningReportPageProps) {
  const session = await requirePermission("report.learning.view");
  const params = await searchParams;
  const requestedClassId = toSearch(params?.classId);
  const requestedStudentId = toSearch(params?.studentId);
  const [accessibleClassIds, accessibleStudentIds] = await Promise.all([
    getAccessibleClassIds(session, "report.learning.view"),
    getAccessibleStudentIds(session, "student.view"),
  ]);
  const classScope = accessibleClassIds ? { id: { in: accessibleClassIds } } : {};
  const studentScope = accessibleStudentIds ? { id: { in: accessibleStudentIds } } : {};
  const classes = await prisma.courseClass.findMany({
    where: classScope,
    select: { id: true, classCode: true, name: true },
    orderBy: { name: "asc" },
    take: OPTION_LIMIT,
  });
  const selectedClassId =
    classes.find((item) => item.id === requestedClassId)?.id ?? "";
  const students = await prisma.student.findMany({
    where: {
      ...studentScope,
      ...(selectedClassId
        ? { enrollments: { some: { classId: selectedClassId, status: "ACTIVE" } } }
        : {}),
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
    take: OPTION_LIMIT,
  });
  const selectedStudentId =
    students.find((item) => item.id === requestedStudentId)?.id ?? "";

  const [selectedStudent, selectedClass, overview] = await Promise.all([
    selectedStudentId
      ? prisma.student.findFirst({
          where: { id: selectedStudentId, ...studentScope },
          select: {
            id: true,
            fullName: true,
            status: true,
            enrollments: {
              include: {
                courseClass: {
                  select: { id: true, classCode: true, name: true },
                },
              },
            },
            attendances: {
              include: {
                session: {
                  select: {
                    id: true,
                    sessionDate: true,
                    courseClass: { select: { id: true, classCode: true } },
                  },
                },
              },
              orderBy: { markedAt: "desc" },
              take: 80,
            },
            comments: {
              select: {
                id: true,
                content: true,
                createdAt: true,
                courseClass: { select: { id: true, classCode: true } },
                createdBy: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "desc" },
              take: 20,
            },
            scores: {
              select: {
                id: true,
                score: true,
                comment: true,
                exam: {
                  select: {
                    id: true,
                    name: true,
                    examDate: true,
                    courseClass: { select: { id: true, classCode: true } },
                  },
                },
              },
              orderBy: { updatedAt: "desc" },
              take: 50,
            },
            tuitionCharges: { select: { amountDue: true, amountPaid: true } },
          },
        })
      : null,
    selectedClassId
      ? prisma.courseClass.findFirst({
          where: { id: selectedClassId, ...classScope },
          include: {
            _count: { select: { sessions: true } },
            students: {
              where: { status: "ACTIVE" },
              include: {
                student: {
                  select: {
                    id: true,
                    fullName: true,
                    attendances: {
                      where: { session: { classId: selectedClassId } },
                      select: { id: true, status: true },
                    },
                    comments: {
                      where: { classId: selectedClassId },
                      select: { id: true, content: true, createdAt: true },
                      orderBy: { createdAt: "desc" },
                      take: 3,
                    },
                    scores: {
                      where: { exam: { classId: selectedClassId } },
                      select: {
                        id: true,
                        score: true,
                        exam: { select: { id: true, examDate: true } },
                      },
                    },
                    tuitionCharges: {
                      where: { classId: selectedClassId },
                      select: { amountDue: true, amountPaid: true },
                    },
                  },
                },
              },
              orderBy: { student: { fullName: "asc" } },
              take: CLASS_REPORT_STUDENT_LIMIT,
            },
          },
        })
      : null,
    Promise.all([
      prisma.student.count({ where: { status: "STUDYING", ...studentScope } }),
      prisma.courseClass.count({ where: { status: "ACTIVE", ...classScope } }),
      prisma.classSession.count({
        where: {
          status: "COMPLETED",
          ...(accessibleClassIds ? { classId: { in: accessibleClassIds } } : {}),
        },
      }),
      prisma.attendance.count({ where: { status: "PRESENT" } }),
      prisma.score.count(),
    ]),
  ]);

  const [studentCount, classCount, sessionCount, presentCount, scoreCount] =
    overview;
  const classRows =
    selectedClass?.students.map((enrollment) => {
      const student = enrollment.student;
      const present = student.attendances.filter((item) =>
        ["PRESENT", "LATE", "LEFT_EARLY", "MAKEUP"].includes(item.status),
      ).length;
      const total = student.attendances.length;
      const scores = student.scores.map((item) => scoreNumber(item.score));
      const average = scores.length
        ? scores.reduce((sum, value) => sum + value, 0) / scores.length
        : 0;
      const latestScore = student.scores
        .slice()
        .sort((a, b) => b.exam.examDate.getTime() - a.exam.examDate.getTime())[0];
      const due = student.tuitionCharges.reduce(
        (sum, item) => sum + decimalNumber(item.amountDue),
        0,
      );
      const paid = student.tuitionCharges.reduce(
        (sum, item) => sum + decimalNumber(item.amountPaid),
        0,
      );

      return {
        enrollment,
        student,
        present,
        total,
        rate: attendanceRate(present, total),
        average,
        latestScore,
        latestComment: student.comments[0],
        due,
        paid,
      };
    }) ?? [];
  const rankedRows = classRows
    .slice()
    .sort((a, b) => b.average - a.average)
    .map((item, index) => [item.student.id, index + 1] as const);
  const rankByStudentId = new Map(rankedRows);
  const studentPresent =
    selectedStudent?.attendances.filter((item) =>
      ["PRESENT", "LATE", "LEFT_EARLY", "MAKEUP"].includes(item.status),
    ).length ?? 0;
  const studentAttendanceTotal = selectedStudent?.attendances.length ?? 0;
  const studentScores = selectedStudent?.scores.map((item) => scoreNumber(item.score)) ?? [];
  const studentAverage = studentScores.length
    ? studentScores.reduce((sum, value) => sum + value, 0) / studentScores.length
    : 0;
  const studentDue =
    selectedStudent?.tuitionCharges.reduce(
      (sum, item) => sum + decimalNumber(item.amountDue),
      0,
    ) ?? 0;
  const studentPaid =
    selectedStudent?.tuitionCharges.reduce(
      (sum, item) => sum + decimalNumber(item.amountPaid),
      0,
    ) ?? 0;

  return (
    <AppShell session={session}>
      <PageHeader
        title="Báo cáo học tập"
        description="Tra cứu chuyên cần, nhận xét, điểm số và xếp hạng theo học viên hoặc lớp."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Học viên đang học", studentCount],
          ["Lớp đang học", classCount],
          ["Buổi đã hoàn tất", sessionCount],
          ["Lượt có mặt", presentCount],
          ["Điểm đã nhập", scoreCount],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <select
          name="classId"
          defaultValue={selectedClassId}
          className="h-10 min-w-0 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
        >
          <option value="">Tất cả lớp</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.classCode} · {item.name}
            </option>
          ))}
        </select>
        <select
          name="studentId"
          defaultValue={selectedStudentId}
          className="h-10 min-w-0 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
        >
          <option value="">Chọn học viên</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.fullName}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
        >
          Xem báo cáo
        </button>
      </form>

      {selectedStudent ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{selectedStudent.fullName}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {studentStatusLabels[selectedStudent.status]} ·{" "}
                {selectedStudent.enrollments
                  .map((item) => `${item.courseClass.classCode} · ${item.courseClass.name}`)
                  .join(", ") || "Chưa xếp lớp"}
              </p>
            </div>
            <Link
              href={`/tuition?studentId=${selectedStudent.id}`}
              className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
            >
              Xem học phí
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-md bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">Chuyên cần</p>
              <p className="font-semibold">
                {studentPresent}/{studentAttendanceTotal} ·{" "}
                {attendanceRate(studentPresent, studentAttendanceTotal)}%
              </p>
            </div>
            <div className="rounded-md bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">Điểm trung bình</p>
              <p className="font-semibold">{studentAverage.toFixed(2)}</p>
            </div>
            <div className="rounded-md bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">Phải thu</p>
              <p className="font-semibold">{formatCurrency(studentDue)}</p>
            </div>
            <div className="rounded-md bg-cyan-50 p-3">
              <p className="text-xs text-zinc-500">Đã thu</p>
              <p className="font-semibold text-[#17215c]">
                {formatCurrency(studentPaid)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="rounded-md border border-zinc-200">
              <div className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold">
                Điểm gần đây
              </div>
              <div className="max-h-72 overflow-auto">
                {selectedStudent.scores.map((score) => (
                  <div key={score.id} className="border-b border-zinc-100 px-3 py-2 text-sm">
                    <p className="font-medium">
                      {score.score.toString()} · {score.exam.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {score.exam.courseClass.classCode} · {formatDate(score.exam.examDate)}
                    </p>
                    {score.comment ? (
                      <p className="mt-1 text-zinc-600">{score.comment}</p>
                    ) : null}
                  </div>
                ))}
                {!selectedStudent.scores.length ? (
                  <p className="p-3 text-sm text-zinc-500">Chưa có điểm.</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-md border border-zinc-200">
              <div className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold">
                Nhận xét mới
              </div>
              <div className="max-h-72 overflow-auto">
                {selectedStudent.comments.map((comment) => (
                  <div key={comment.id} className="border-b border-zinc-100 px-3 py-2 text-sm">
                    <p className="font-medium">{formatDate(comment.createdAt)}</p>
                    <p className="text-zinc-600">{comment.content}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {comment.courseClass?.classCode ?? "-"} · {comment.createdBy.name}
                    </p>
                  </div>
                ))}
                {!selectedStudent.comments.length ? (
                  <p className="p-3 text-sm text-zinc-500">Chưa có nhận xét.</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-md border border-zinc-200">
              <div className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold">
                Điểm danh gần đây
              </div>
              <div className="max-h-72 overflow-auto">
                {selectedStudent.attendances.map((attendance) => (
                  <div key={attendance.id} className="border-b border-zinc-100 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">
                        {formatDate(attendance.session.sessionDate)}
                      </p>
                      <Badge
                        tone={
                          attendance.status === "PRESENT"
                            ? "success"
                            : attendance.status === "ABSENT_UNEXCUSED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {attendanceStatusLabels[attendance.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {attendance.session.courseClass.classCode} · {attendance.note ?? "-"}
                    </p>
                  </div>
                ))}
                {!selectedStudent.attendances.length ? (
                  <p className="p-3 text-sm text-zinc-500">Chưa có điểm danh.</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {selectedClass ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedClass.classCode} · {selectedClass.name}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {selectedClass.students.length} học viên · {selectedClass._count.sessions} buổi
              </p>
            </div>
            <Link
              href={`/tuition?classId=${selectedClass.id}`}
              className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
            >
              Xem học phí lớp
            </Link>
          </div>
          <div className="mt-4 max-w-full overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="sticky left-0 bg-zinc-50 px-4 py-3 font-medium">
                    Học viên
                  </th>
                  <th className="px-4 py-3 font-medium">Chuyên cần</th>
                  <th className="px-4 py-3 font-medium">Điểm TB</th>
                  <th className="px-4 py-3 font-medium">Hạng</th>
                  <th className="px-4 py-3 font-medium">Điểm gần nhất</th>
                  <th className="px-4 py-3 font-medium">Nhận xét mới</th>
                  <th className="px-4 py-3 font-medium">Học phí</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {classRows.map((row) => (
                  <tr key={row.enrollment.id}>
                    <td className="sticky left-0 bg-white px-4 py-4 font-medium">
                      {row.student.fullName}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {row.present}/{row.total} · {row.rate}%
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {row.average.toFixed(2)}
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={(rankByStudentId.get(row.student.id) ?? 99) <= 3 ? "success" : "default"}>
                        #{rankByStudentId.get(row.student.id) ?? "-"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {row.latestScore?.score.toString() ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {row.latestComment?.content ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {formatCurrency(row.paid)} / {formatCurrency(row.due)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!classRows.length ? (
              <p className="p-3 text-sm text-zinc-500">Lớp chưa có học viên.</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
