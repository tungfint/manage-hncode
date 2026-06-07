import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adjustPayrollItemAction,
  confirmPayrollPaidAction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { payrollStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PayrollDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PayrollDetailPage({ params }: PayrollDetailPageProps) {
  const session = await requirePermission("salary.view");
  const { id } = await params;
  const payroll = await prisma.payroll.findUnique({
    where: { id },
    include: {
      createdBy: true,
      paidBy: true,
      items: {
        include: {
          staffUser: true,
          salaryRule: true,
          courseClass: true,
          adjustments: { orderBy: { createdAt: "desc" }, include: { createdBy: true } },
        },
        orderBy: { staffUser: { name: "asc" } },
      },
      adjustments: {
        include: { staffUser: true, createdBy: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!payroll) {
    notFound();
  }

  const staffUserIds = [...new Set(payroll.items.map((item) => item.staffUserId))];
  const teachingSessions = await prisma.sessionTeacher.findMany({
    where: {
      teacherUserId: { in: staffUserIds },
      session: {
        status: "COMPLETED",
        ...(payroll.periodFrom || payroll.periodTo
          ? {
              sessionDate: {
                ...(payroll.periodFrom ? { gte: payroll.periodFrom } : {}),
                ...(payroll.periodTo ? { lte: payroll.periodTo } : {}),
              },
            }
          : {}),
      },
    },
    include: {
      teacher: true,
      session: {
        include: {
          courseClass: true,
        },
      },
    },
    orderBy: [{ session: { sessionDate: "asc" } }],
  });

  const total = payroll.items.reduce(
    (sum, item) => sum + Number(item.totalAmount.toString()),
    0,
  );
  const canManage = can(session, "salary.manage") && payroll.status !== "PAID";
  const confirmPaid = confirmPayrollPaidAction.bind(null, payroll.id);

  return (
    <AppShell session={session}>
      <PageHeader
        title={`Bảng lương ${payroll.month.toString().padStart(2, "0")}/${payroll.year}`}
        description={`${formatDate(payroll.periodFrom)} - ${formatDate(payroll.periodTo)}`}
        action={
          <Link
            href="/payrolls"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Quay lại
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Tổng lương</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(total)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Số nhân sự</p>
          <p className="mt-1 text-2xl font-semibold">{payroll.items.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Trạng thái</p>
          <div className="mt-2">
            <Badge tone={payroll.status === "PAID" ? "success" : "warning"}>
              {payrollStatusLabels[payroll.status]}
            </Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nhân sự</th>
                <th className="px-4 py-3 font-medium">Công việc/Lớp</th>
                <th className="px-4 py-3 font-medium">Số buổi</th>
                <th className="px-4 py-3 font-medium">Lương gốc</th>
                <th className="px-4 py-3 font-medium">Phụ cấp</th>
                <th className="px-4 py-3 font-medium">Khấu trừ</th>
                <th className="px-4 py-3 font-medium">Thực nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {payroll.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 font-medium">{item.staffUser.name}</td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.salaryRule?.workName ??
                      item.courseClass?.name ??
                      "Theo quy tắc lương"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.sessionsCount || "-"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {formatCurrency(item.baseAmount)}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {formatCurrency(item.allowanceAmount)}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {formatCurrency(item.deductionAmount)}
                  </td>
                  <td className="px-4 py-4 font-semibold">
                    {formatCurrency(item.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-5">
          {canManage ? (
            <form
              action={confirmPaid}
              className="rounded-lg border border-yellow-200 bg-[#fff8d7] p-4 shadow-sm"
            >
              <h2 className="mb-3 font-semibold">Xác nhận đã thanh toán</h2>
              <textarea
                name="paidNote"
                rows={3}
                placeholder="Ghi chú thanh toán"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <ConfirmSubmitButton
                message="Xác nhận bảng lương này đã thanh toán? Sau khi xác nhận sẽ không điều chỉnh trực tiếp nữa."
                className="mt-3 h-10 w-full rounded-md bg-[#17215c] text-sm font-medium text-white hover:bg-[#25308d]"
              >
                Đã thanh toán
              </ConfirmSubmitButton>
            </form>
          ) : null}

          {payroll.paidAt ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-semibold">Thông tin thanh toán</h2>
              <p className="text-sm text-zinc-600">
                {formatDateTime(payroll.paidAt)} · {payroll.paidBy?.name ?? "-"}
              </p>
              {payroll.paidNote ? (
                <p className="mt-2 text-sm text-zinc-600">{payroll.paidNote}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {canManage ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-semibold">Thêm phụ cấp / khấu trừ</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {payroll.items.map((item) => (
              <form
                key={item.id}
                action={adjustPayrollItemAction.bind(null, payroll.id, item.id)}
                className="rounded-lg border border-zinc-200 p-3"
              >
                <p className="mb-3 font-medium">{item.staffUser.name}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    name="type"
                    className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="ALLOWANCE">Phụ cấp</option>
                    <option value="BONUS">Thưởng</option>
                    <option value="DEDUCTION">Khấu trừ</option>
                  </select>
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    required
                    placeholder="Số tiền"
                    className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                  />
                  <input
                    name="note"
                    placeholder="Ghi chú"
                    className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-3 h-10 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Lưu điều chỉnh
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-semibold">Buổi dạy trong kỳ</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Ngày</th>
                <th className="px-4 py-3 font-medium">Nhân sự</th>
                <th className="px-4 py-3 font-medium">Lớp</th>
                <th className="px-4 py-3 font-medium">Vai trò</th>
                <th className="px-4 py-3 font-medium">Giờ học</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {teachingSessions.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 text-zinc-600">
                    {formatDate(item.session.sessionDate)}
                  </td>
                  <td className="px-4 py-4 font-medium">{item.teacher.name}</td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.session.courseClass.name}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.role === "MAIN" ? "Giáo viên chính" : "Giáo viên phụ"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.actualStartTime ?? item.session.startTime} -{" "}
                    {item.actualEndTime ?? item.session.endTime}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!teachingSessions.length ? (
            <p className="p-4 text-sm text-zinc-500">
              Chưa có buổi dạy hoàn thành trong kỳ này.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-semibold">Lịch sử điều chỉnh</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {payroll.adjustments.map((item) => (
            <div key={item.id} className="rounded-md border border-zinc-200 p-3 text-sm">
              <p className="font-medium">
                {item.staffUser.name} · {item.type} · {formatCurrency(item.amount)}
              </p>
              <p className="text-zinc-500">
                {formatDateTime(item.createdAt)} · {item.createdBy.name}
              </p>
              {item.note ? <p className="mt-1 text-zinc-600">{item.note}</p> : null}
            </div>
          ))}
          {!payroll.adjustments.length ? (
            <p className="text-sm text-zinc-500">Chưa có điều chỉnh.</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
