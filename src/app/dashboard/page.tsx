import {
  AlertCircle,
  ArrowRight,
  Banknote,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  ReceiptText,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { can, getSessionOrRedirect } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { sessionStatusLabels } from "@/lib/labels";
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

function money(value: unknown) {
  return Number(value?.toString?.() ?? 0);
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
    parentsCount,
    activeClassesCount,
    todaySessions,
    pendingAttendances,
    upcomingSessions,
    tuitionSummary,
    overdueTuitionCount,
    payrollDraftCount,
    recentPayments,
  ] = await Promise.all([
    can(session, "student.view") ? prisma.student.count() : Promise.resolve(0),
    can(session, "parent.view") ? prisma.parent.count() : Promise.resolve(0),
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
    can(session, "session.view")
      ? prisma.classSession.findMany({
          where: {
            sessionDate: {
              gt: todayEnd,
            },
            status: "PLANNED",
            courseClass: classScope,
          },
          include: {
            courseClass: true,
            room: true,
          },
          orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
          take: 4,
        })
      : Promise.resolve([]),
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
    money(tuitionSummary._sum.amountDue) - money(tuitionSummary._sum.amountPaid);

  const stats = [
    {
      label: "Học viên",
      value: studentsCount,
      hint: parentsCount ? `${parentsCount} phụ huynh liên kết` : "Hồ sơ đang quản lý",
      icon: GraduationCap,
      tone: "cyan",
      href: "/students",
      show: can(session, "student.view"),
    },
    {
      label: "Lớp đang hoạt động",
      value: activeClassesCount,
      hint: isTeacher ? "Lớp được phân công" : "Toàn trung tâm",
      icon: BookOpenCheck,
      tone: "blue",
      href: "/classes",
      show: can(session, "class.view"),
    },
    {
      label: "Buổi học hôm nay",
      value: todaySessions.length,
      hint: `${pendingAttendances} buổi cần điểm danh`,
      icon: CalendarDays,
      tone: "amber",
      href: "/sessions",
      show: can(session, "session.view"),
    },
    {
      label: "Công nợ cần theo dõi",
      value: formatCurrency(Math.max(totalDebt, 0)),
      hint: `${overdueTuitionCount} khoản chưa hoàn tất`,
      icon: Banknote,
      tone: "rose",
      href: "/tuition",
      show: can(session, "tuition.view"),
    },
  ].filter((item) => item.show);

  const tasks = [
    {
      title: "Điểm danh buổi học hôm nay",
      value: pendingAttendances,
      href: "/sessions",
      show: can(session, "attendance.manage"),
      tone: pendingAttendances ? "warning" : "success",
      description: pendingAttendances
        ? "Có buổi học đang chờ xác nhận điểm danh."
        : "Không có buổi học cần điểm danh lúc này.",
    },
    {
      title: "Khoản học phí cần xử lý",
      value: overdueTuitionCount,
      href: "/tuition",
      show: can(session, "tuition.view"),
      tone: overdueTuitionCount ? "danger" : "success",
      description: overdueTuitionCount
        ? "Có khoản chưa thu đủ hoặc quá hạn."
        : "Không có công nợ nổi bật.",
    },
    {
      title: "Bảng lương chờ xử lý",
      value: payrollDraftCount,
      href: "/payrolls",
      show: can(session, "salary.view"),
      tone: payrollDraftCount ? "warning" : "success",
      description: payrollDraftCount
        ? "Có bảng lương nháp hoặc chờ duyệt."
        : "Không có bảng lương cần xử lý.",
    },
  ].filter((item) => item.show);

  const quickActions = [
    {
      label: "Thêm học viên",
      href: "/students/new",
      icon: GraduationCap,
      show: can(session, "student.create"),
    },
    {
      label: "Import học viên",
      href: "/students/import",
      icon: UsersRound,
      show: can(session, "student.create"),
    },
    {
      label: "Mở buổi học",
      href: "/sessions",
      icon: ClipboardCheck,
      show: can(session, "session.view"),
    },
    {
      label: "Thu học phí",
      href: "/tuition",
      icon: ReceiptText,
      show: can(session, "tuition.manage"),
    },
    {
      label: "Nhập điểm",
      href: "/exams",
      icon: BookOpenCheck,
      show: can(session, "score.manage"),
    },
    {
      label: "Bảng lương",
      href: "/payrolls",
      icon: WalletCards,
      show: can(session, "salary.view"),
    },
  ].filter((item) => item.show);

  return (
    <AppShell session={session}>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#08a7dc]">
              {formatDate(today)}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">
              {isAccountant
                ? "Dashboard kế toán"
                : isTeacher
                  ? "Dashboard giáo viên"
                  : "Dashboard quản lý"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Theo dõi nhanh lịch học, điểm danh, công nợ và các việc cần xử lý
              theo quyền của tài khoản.
            </p>
          </div>
          {quickActions.length ? (
            <div className="flex flex-wrap gap-2">
              {quickActions.slice(0, 3).map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 hover:border-yellow-300 hover:bg-[#fff7cc] hover:text-[#17215c]"
                  >
                    <Icon size={16} aria-hidden="true" />
                    {item.label}
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <a
              key={item.label}
              href={item.href}
              className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">
                    {item.value}
                  </p>
                </div>
                <div
                  className={[
                    "grid size-10 place-items-center rounded-md border",
                    item.tone === "amber"
                      ? "border-yellow-200 bg-[#fff7cc] text-[#17215c]"
                      : item.tone === "rose"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-cyan-200 bg-cyan-50 text-cyan-700",
                  ].join(" ")}
                >
                  <Icon size={20} aria-hidden="true" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-600">{item.hint}</p>
                <ArrowRight
                  size={16}
                  className="text-slate-300 transition group-hover:text-[#08a7dc]"
                  aria-hidden="true"
                />
              </div>
            </a>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="font-semibold text-slate-950">Hoạt động hôm nay</h2>
              <p className="text-sm text-slate-500">
                Ưu tiên mở buổi học để điểm danh và ghi nhận nội dung.
              </p>
            </div>
            <a
              href="/schedule"
              className="text-sm font-medium text-[#17215c] hover:underline"
            >
              Xem lịch học
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Giờ</th>
                  <th className="px-4 py-3 font-medium">Lớp</th>
                  <th className="px-4 py-3 font-medium">Phòng</th>
                  <th className="px-4 py-3 font-medium">Giáo viên</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todaySessions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4 font-medium">
                      {item.startTime} - {item.endTime}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-900">
                        {item.courseClass.name}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {item.room?.name ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
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
                        className="font-medium text-[#08a7dc] hover:text-[#17215c]"
                        href={`/sessions/${item.id}/attendance`}
                      >
                        Mở buổi học
                      </a>
                    </td>
                  </tr>
                ))}
                {!todaySessions.length ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
                      Hôm nay chưa có buổi học nào trong phạm vi quyền của bạn.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">Việc cần xử lý</h2>
                <p className="text-sm text-slate-500">Tác vụ nổi bật theo quyền.</p>
              </div>
              <AlertCircle size={20} className="text-[#08a7dc]" aria-hidden="true" />
            </div>
            <div className="mt-4 space-y-3">
              {tasks.map((task) => (
                <a
                  key={task.title}
                  href={task.href}
                  className="block rounded-md border border-slate-200 bg-slate-50 px-3 py-3 hover:border-yellow-300 hover:bg-[#fff9d8]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {task.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {task.description}
                      </p>
                    </div>
                    <Badge tone={task.tone as "success" | "warning" | "danger"}>
                      {task.value}
                    </Badge>
                  </div>
                </a>
              ))}
              {!tasks.length ? (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  Chưa có tác vụ nổi bật theo quyền hiện tại.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-950">Buổi sắp tới</h2>
            <div className="mt-3 space-y-3">
              {upcomingSessions.map((item) => (
                <a
                  key={item.id}
                  href={`/sessions/${item.id}/attendance`}
                  className="block rounded-md border border-slate-100 px-3 py-2 hover:bg-slate-50"
                >
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.courseClass.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(item.sessionDate)} · {item.startTime} - {item.endTime}
                    {item.room?.name ? ` · ${item.room.name}` : ""}
                  </p>
                </a>
              ))}
              {!upcomingSessions.length ? (
                <p className="text-sm text-slate-500">Chưa có buổi học sắp tới.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-950">Lối tắt nhanh</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {quickActions.map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60 hover:text-[#17215c]"
                >
                  <span className="grid size-9 place-items-center rounded-md bg-[#e8f7fc] text-[#08a7dc]">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  {item.label}
                </a>
              );
            })}
            {!quickActions.length ? (
              <p className="text-sm text-slate-500">Chưa có lối tắt phù hợp.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="font-semibold text-slate-950">
                {can(session, "payment.view") ? "Thanh toán gần đây" : "Ghi chú vận hành"}
              </h2>
              <p className="text-sm text-slate-500">
                {can(session, "payment.view")
                  ? "Các khoản thu mới ghi nhận."
                  : "Thông tin tóm tắt theo quyền hiện tại."}
              </p>
            </div>
            {can(session, "payment.view") ? (
              <a
                href="/payments"
                className="text-sm font-medium text-[#17215c] hover:underline"
              >
                Xem tất cả
              </a>
            ) : null}
          </div>

          {can(session, "payment.view") ? (
            <div className="divide-y divide-slate-100">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {payment.tuitionCharge.student.fullName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {payment.tuitionCharge.courseClass?.name ?? "Khoản thu"} ·{" "}
                      {formatDate(payment.paymentDate)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-emerald-700">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
              {!recentPayments.length ? (
                <p className="p-4 text-sm text-slate-500">Chưa có thanh toán.</p>
              ) : null}
            </div>
          ) : (
            <div className="p-4 text-sm leading-6 text-slate-600">
              Hệ thống chỉ hiển thị chức năng phù hợp với quyền của bạn. Sử dụng
              sidebar hoặc lối tắt nhanh để tiếp tục công việc.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
