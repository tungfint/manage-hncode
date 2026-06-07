import {
  Banknote,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { can, getSessionOrRedirect } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  sessionStatusLabels,
} from "@/lib/labels";
import { prisma } from "@/lib/prisma";

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export default async function DashboardPage() {
  const session = await getSessionOrRedirect();
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const isTeacher =
    session.roles.includes("teacher_main") ||
    session.roles.includes("teacher_assistant");
  const isAccountant = session.roles.includes("accountant");

  const classScope = isTeacher
    ? {
        teachers: {
          some: {
            teacherUserId: session.userId,
          },
        },
      }
    : {};

  const [
    studentsCount,
    activeClassesCount,
    todaySessions,
    pendingAttendances,
    tuitionSummary,
    overdueTuitionCount,
    payrollDraftCount,
    recentPayments,
  ] = await Promise.all([
    can(session, "student.view") ? prisma.student.count() : Promise.resolve(0),
    can(session, "class.view")
      ? prisma.courseClass.count({
          where: {
            status: "ACTIVE",
            ...classScope,
          },
        })
      : Promise.resolve(0),
    can(session, "session.view")
      ? prisma.classSession.findMany({
          where: {
            sessionDate: {
              gte: todayStart,
              lte: todayEnd,
            },
            courseClass: classScope,
          },
          include: {
            courseClass: true,
            room: true,
            teachers: {
              include: {
                teacher: true,
              },
            },
          },
          orderBy: [{ startTime: "asc" }],
          take: 8,
        })
      : Promise.resolve([]),
    can(session, "attendance.manage")
      ? prisma.classSession.count({
          where: {
            status: "PLANNED",
            sessionDate: {
              gte: todayStart,
              lte: todayEnd,
            },
            courseClass: classScope,
          },
        })
      : Promise.resolve(0),
    can(session, "tuition.view")
      ? prisma.tuitionCharge.aggregate({
          _sum: {
            amountDue: true,
            amountPaid: true,
          },
          where: {
            status: {
              in: ["UNPAID", "PARTIAL", "OVERDUE"],
            },
          },
        })
      : Promise.resolve({ _sum: { amountDue: null, amountPaid: null } }),
    can(session, "tuition.view")
      ? prisma.tuitionCharge.count({
          where: { status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
        })
      : Promise.resolve(0),
    can(session, "salary.view")
      ? prisma.payroll.count({ where: { status: { in: ["DRAFT", "PENDING"] } } })
      : Promise.resolve(0),
    can(session, "payment.view")
      ? prisma.payment.findMany({
          include: {
            tuitionCharge: {
              include: {
                student: true,
                courseClass: true,
              },
            },
          },
          orderBy: { paymentDate: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const totalDebt =
    Number(tuitionSummary._sum.amountDue?.toString() ?? 0) -
    Number(tuitionSummary._sum.amountPaid?.toString() ?? 0);

  const stats = [
    {
      label: "Học viên",
      value: studentsCount,
      hint: "Đang quản lý",
      icon: GraduationCap,
      show: can(session, "student.view"),
    },
    {
      label: "Lớp đang học",
      value: activeClassesCount,
      hint: isTeacher ? "Lớp được phân công" : "Toàn trung tâm",
      icon: BookOpenCheck,
      show: can(session, "class.view"),
    },
    {
      label: "Buổi hôm nay",
      value: todaySessions.length,
      hint: `${pendingAttendances} buổi cần điểm danh`,
      icon: CalendarDays,
      show: can(session, "session.view"),
    },
    {
      label: "Công nợ",
      value: formatCurrency(totalDebt),
      hint: `${overdueTuitionCount} khoản cần theo dõi`,
      icon: Banknote,
      show: can(session, "tuition.view"),
    },
    {
      label: "Bảng lương",
      value: payrollDraftCount,
      hint: "Nháp / chờ duyệt",
      icon: WalletCards,
      show: can(session, "salary.view"),
    },
  ].filter((item) => item.show);

  return (
    <AppShell session={session}>
      <PageHeader
        title={
          isAccountant
            ? "Dashboard kế toán"
            : isTeacher
              ? "Dashboard giáo viên"
              : "Dashboard quản lý"
        }
        description="Tổng quan nhanh theo vai trò và quyền của tài khoản."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.label}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-500">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-950">
                    {item.value}
                  </p>
                </div>
                <div className="grid size-10 place-items-center rounded-md border border-teal-200 bg-teal-50 text-teal-700">
                  <Icon size={20} aria-hidden="true" />
                </div>
              </div>
              <p className="text-sm text-zinc-600">{item.hint}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="font-semibold">Lịch học hôm nay</h2>
            <p className="text-sm text-zinc-500">
              Ưu tiên thao tác điểm danh và ghi nội dung buổi học.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Giờ</th>
                  <th className="px-4 py-3 font-medium">Lớp</th>
                  <th className="px-4 py-3 font-medium">Phòng</th>
                  <th className="px-4 py-3 font-medium">Giáo viên</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {todaySessions.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4 font-medium">
                      {item.startTime} - {item.endTime}
                    </td>
                    <td className="px-4 py-4">{item.courseClass.name}</td>
                    <td className="px-4 py-4 text-zinc-600">
                      {item.room?.name ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {item.teachers.map((teacher) => teacher.teacher.name).join(", ") ||
                        "-"}
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={item.status === "COMPLETED" ? "success" : "warning"}>
                        {sessionStatusLabels[item.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <a
                        className="font-medium text-teal-700 hover:text-teal-800"
                        href={`/sessions/${item.id}/attendance`}
                      >
                        Mở buổi học
                      </a>
                    </td>
                  </tr>
                ))}
                {!todaySessions.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-zinc-500" colSpan={6}>
                      Chưa có buổi học trong hôm nay.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="font-semibold">
              {can(session, "payment.view") ? "Thanh toán gần đây" : "Việc cần xử lý"}
            </h2>
            <p className="text-sm text-zinc-500">
              {can(session, "payment.view")
                ? "Các khoản thu mới ghi nhận."
                : "Các tác vụ thường dùng theo vai trò."}
            </p>
          </div>

          {can(session, "payment.view") ? (
            <div className="divide-y divide-zinc-100">
              {recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {payment.tuitionCharge.student.fullName}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {payment.tuitionCharge.courseClass?.name ?? "Khoản thu"} ·{" "}
                      {formatDate(payment.paymentDate)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-teal-700">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
              {!recentPayments.length ? (
                <p className="p-4 text-sm text-zinc-500">Chưa có thanh toán.</p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 p-4">
              {can(session, "attendance.manage") ? (
                <a className="rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50" href="/sessions">
                  Điểm danh buổi học
                </a>
              ) : null}
              {can(session, "score.manage") ? (
                <a className="rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50" href="/exams">
                  Nhập điểm kiểm tra
                </a>
              ) : null}
              {can(session, "comment.manage") ? (
                <a className="rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50" href="/sessions">
                  Nhận xét học viên
                </a>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <a
          href="/students"
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50"
        >
          <GraduationCap className="mb-3 text-teal-700" size={22} />
          <h2 className="font-semibold">Tra cứu học viên</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Tìm hồ sơ, phụ huynh, lớp đang học và lịch sử học phí.
          </p>
        </a>
        <a
          href="/sessions"
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50"
        >
          <ClipboardCheck className="mb-3 text-teal-700" size={22} />
          <h2 className="font-semibold">Mở buổi học</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Điểm danh, ghi nội dung, bài tập và nhận xét ngay một màn hình.
          </p>
        </a>
        <a
          href={can(session, "tuition.manage") ? "/tuition" : "/schedule"}
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50"
        >
          <ReceiptText className="mb-3 text-teal-700" size={22} />
          <h2 className="font-semibold">
            {can(session, "tuition.manage") ? "Thu học phí" : "Xem lịch học"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {can(session, "tuition.manage")
              ? "Ghi nhận thanh toán và cập nhật công nợ."
              : "Theo dõi lịch lớp và phòng học được phân công."}
          </p>
        </a>
      </section>
    </AppShell>
  );
}
