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
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  toSearch,
} from "@/lib/format";
import {
  payrollStatusLabels,
  salaryTypeLabels,
  staffAttendanceStatusLabels,
} from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PayrollDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    itemId?: string;
    qrItemId?: string;
    qrContent?: string;
  }>;
};

function vietQrUrl(input: {
  bankName?: string | null;
  accountNumber?: string | null;
  accountName: string;
  amount: number;
  content: string;
}) {
  if (!input.bankName || !input.accountNumber || input.amount <= 0) {
    return null;
  }

  const base = `https://img.vietqr.io/image/${encodeURIComponent(
    input.bankName,
  )}-${encodeURIComponent(input.accountNumber)}-compact2.png`;
  const params = new URLSearchParams({
    amount: String(Math.round(input.amount)),
    addInfo: input.content,
    accountName: input.accountName,
  });

  return `${base}?${params.toString()}`;
}

export default async function PayrollDetailPage({
  params,
  searchParams,
}: PayrollDetailPageProps) {
  const session = await requirePermission("salary.view");
  const { id } = await params;
  const query = await searchParams;
  const selectedItemId = toSearch(query?.itemId) || toSearch(query?.qrItemId);
  const qrItemId = toSearch(query?.qrItemId);
  const payroll = await prisma.payroll.findUnique({
    where: { id },
    include: {
      createdBy: true,
      paidBy: true,
      items: {
        include: {
          staffUser: { include: { staffProfile: true } },
          salaryRule: true,
          courseClass: true,
          adjustments: {
            orderBy: { createdAt: "desc" },
            include: { createdBy: true },
          },
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
  const [teachingSessions, staffAttendances] = await Promise.all([
    prisma.sessionTeacher.findMany({
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
    }),
    prisma.staffAttendance.findMany({
      where: {
        staffUserId: { in: staffUserIds },
        ...(payroll.periodFrom || payroll.periodTo
          ? {
              workDate: {
                ...(payroll.periodFrom ? { gte: payroll.periodFrom } : {}),
                ...(payroll.periodTo ? { lte: payroll.periodTo } : {}),
              },
            }
          : {}),
      },
      include: {
        staffUser: true,
        confirmedBy: true,
      },
      orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const total = payroll.items.reduce(
    (sum, item) => sum + Number(item.totalAmount.toString()),
    0,
  );
  const canManage = can(session, "salary.manage") && payroll.status !== "PAID";
  const confirmPaid = confirmPayrollPaidAction.bind(null, payroll.id);
  const selectedItem =
    payroll.items.find((item) => item.id === selectedItemId) ?? payroll.items[0];
  const qrItem = payroll.items.find((item) => item.id === qrItemId) ?? selectedItem;
  const defaultQrContent = `Luong HNCode Thang ${payroll.month} Nam ${payroll.year}`;
  const qrContent = toSearch(query?.qrContent) || defaultQrContent;
  const qrUrl = qrItem
    ? vietQrUrl({
        bankName: qrItem.staffUser.staffProfile?.bankName,
        accountNumber: qrItem.staffUser.staffProfile?.bankAccountNumber,
        accountName: qrItem.staffUser.name,
        amount: Number(qrItem.totalAmount.toString()),
        content: qrContent,
      })
    : null;
  const selectedTeachingSessions = selectedItem
    ? teachingSessions.filter((item) => item.teacherUserId === selectedItem.staffUserId)
    : [];
  const selectedStaffAttendances = selectedItem
    ? staffAttendances.filter((item) => item.staffUserId === selectedItem.staffUserId)
    : [];

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

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="max-w-full overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nhân sự</th>
                <th className="px-4 py-3 font-medium">Công việc/Lớp</th>
                <th className="px-4 py-3 font-medium">Số buổi</th>
                <th className="px-4 py-3 font-medium">Số giờ</th>
                <th className="px-4 py-3 font-medium">Việc/Ca</th>
                <th className="px-4 py-3 font-medium">Lương gốc</th>
                <th className="px-4 py-3 font-medium">Phụ cấp</th>
                <th className="px-4 py-3 font-medium">Khấu trừ</th>
                <th className="px-4 py-3 font-medium">Thực nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {payroll.items.map((item) => (
                <tr key={item.id} className={item.id === selectedItem?.id ? "bg-cyan-50/40" : ""}>
                  <td className="px-4 py-4 font-medium">
                    <Link
                      href={`/payrolls/${payroll.id}?itemId=${item.id}#item-detail`}
                      className="text-[#17215c] hover:underline"
                    >
                      {item.staffUser.name}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.staffUser.staffProfile?.bankName && item.staffUser.staffProfile.bankAccountNumber
                        ? `${item.staffUser.staffProfile.bankName} · ${item.staffUser.staffProfile.bankAccountNumber}`
                        : "Chưa có thông tin ngân hàng"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    <p>
                      {item.salaryRule?.workName ??
                        item.courseClass?.name ??
                        "Theo quy tắc lương"}
                    </p>
                    {item.courseClass ? (
                      <p className="text-xs text-zinc-500">{item.courseClass.classCode}</p>
                    ) : null}
                    {item.salaryRule ? (
                      <p className="text-xs text-zinc-500">
                        {salaryTypeLabels[item.salaryRule.salaryType]}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.sessionsCount || "-"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {Number(item.hoursCount.toString()) || "-"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.taskCount || "-"}
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

      {selectedItem ? (
        <section
          id="item-detail"
          className="grid min-w-0 gap-5 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm xl:grid-cols-[minmax(0,1fr)_360px]"
        >
          <div className="min-w-0">
            <h2 className="font-semibold">Chi tiết lương: {selectedItem.staffUser.name}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div className="rounded-md bg-zinc-50 p-3">
                <p className="text-xs text-zinc-500">Lương gốc</p>
                <p className="font-semibold">{formatCurrency(selectedItem.baseAmount)}</p>
              </div>
              <div className="rounded-md bg-zinc-50 p-3">
                <p className="text-xs text-zinc-500">Phụ cấp</p>
                <p className="font-semibold">{formatCurrency(selectedItem.allowanceAmount)}</p>
              </div>
              <div className="rounded-md bg-zinc-50 p-3">
                <p className="text-xs text-zinc-500">Khấu trừ</p>
                <p className="font-semibold">{formatCurrency(selectedItem.deductionAmount)}</p>
              </div>
              <div className="rounded-md bg-cyan-50 p-3">
                <p className="text-xs text-zinc-500">Thực nhận</p>
                <p className="font-semibold text-[#17215c]">
                  {formatCurrency(selectedItem.totalAmount)}
                </p>
              </div>
            </div>

            {canManage ? (
              <form
                action={adjustPayrollItemAction.bind(null, payroll.id, selectedItem.id)}
                className="mt-4 grid gap-3 rounded-md border border-zinc-200 p-3 sm:grid-cols-4"
              >
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
                <button
                  type="submit"
                  className="h-10 rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Lưu điều chỉnh
                </button>
              </form>
            ) : null}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="min-w-0 rounded-md border border-zinc-200">
                <div className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold">
                  Buổi dạy trong kỳ
                </div>
                <div className="max-h-72 overflow-auto">
                  {selectedTeachingSessions.map((item) => (
                    <div key={item.id} className="border-b border-zinc-100 px-3 py-2 text-sm">
                      <p className="font-medium">{formatDate(item.session.sessionDate)}</p>
                      <p className="text-zinc-600">
                        {item.session.courseClass.classCode} · {item.session.courseClass.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {item.actualStartTime ?? item.session.startTime} -{" "}
                        {item.actualEndTime ?? item.session.endTime}
                      </p>
                    </div>
                  ))}
                  {!selectedTeachingSessions.length ? (
                    <p className="p-3 text-sm text-zinc-500">Không có buổi dạy.</p>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0 rounded-md border border-zinc-200">
                <div className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold">
                  Ngày công nhân sự
                </div>
                <div className="max-h-72 overflow-auto">
                  {selectedStaffAttendances.map((item) => (
                    <div key={item.id} className="border-b border-zinc-100 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{formatDate(item.workDate)}</p>
                        <Badge
                          tone={
                            item.status === "PRESENT"
                              ? "success"
                              : item.status === "UNEXCUSED"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {staffAttendanceStatusLabels[item.status]}
                        </Badge>
                      </div>
                      <p className="text-zinc-600">
                        {item.shiftName ?? "Ca làm"} · {item.hoursCount.toString()} giờ
                      </p>
                      <p className="text-xs text-zinc-500">{item.workName ?? "-"}</p>
                    </div>
                  ))}
                  {!selectedStaffAttendances.length ? (
                    <p className="p-3 text-sm text-zinc-500">Không có ngày công.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <aside id="qr-payroll" className="rounded-lg border border-yellow-200 bg-[#fff8d7] p-4">
            <h2 className="font-semibold">QR chuyển khoản</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {qrItem?.staffUser.name} · {formatCurrency(qrItem?.totalAmount ?? 0)}
            </p>
            <form method="get" action={`/payrolls/${payroll.id}#qr-payroll`} className="mt-3 space-y-2">
              <input type="hidden" name="itemId" value={selectedItem.id} />
              <select
                name="qrItemId"
                defaultValue={qrItem?.id}
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
              >
                {payroll.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.staffUser.name}
                  </option>
                ))}
              </select>
              <input
                name="qrContent"
                defaultValue={qrContent}
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                className="h-10 w-full rounded-md bg-[#17215c] text-sm font-medium text-white hover:bg-[#25308d]"
              >
                Tạo QR
              </button>
            </form>
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrUrl}
                alt={`QR chuyển lương cho ${qrItem?.staffUser.name}`}
                className="mt-4 w-full rounded-md border border-zinc-200 bg-white"
              />
            ) : (
              <p className="mt-4 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900">
                Nhân sự chưa có đủ mã ngân hàng và số tài khoản, hoặc số tiền bằng
                0 nên chưa tạo được QR.
              </p>
            )}
          </aside>
        </section>
      ) : null}

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
