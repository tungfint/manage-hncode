import { PayrollStatus } from "@/generated/prisma/client";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { payrollStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type FinanceReportPageProps = {
  searchParams?: Promise<{
    mode?: string;
    month?: string;
    year?: string;
  }>;
};

type ReportMode = "overview" | "month" | "person";
const FINANCE_DETAIL_LIMIT = 200;
const MONTHLY_LOOKBACK_MONTHS = 12;

function toMoney(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number(value?.toString?.() ?? 0);

  return Number.isFinite(number) ? number : 0;
}

function sumMoney<T>(items: T[], read: (item: T) => unknown) {
  return items.reduce((total, item) => total + toMoney(read(item)), 0);
}

function validMonth(value: string | undefined, fallback: number) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : fallback;
}

function validYear(value: string | undefined, fallback: number) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : fallback;
}

function monthRange(year: number, month: number) {
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  };
}

function monthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function monthLabel(year: number, month: number) {
  return `Tháng ${String(month).padStart(2, "0")}/${year}`;
}

function modeHref(mode: ReportMode, month: number, year: number) {
  const params = new URLSearchParams({
    mode,
    month: String(month),
    year: String(year),
  });

  return `/reports/finance?${params.toString()}`;
}

export default async function FinanceReportPage({
  searchParams,
}: FinanceReportPageProps) {
  const session = await requirePermission("report.finance.view");
  const params = await searchParams;
  const today = new Date();
  const mode = ["month", "person"].includes(params?.mode ?? "")
    ? (params?.mode as ReportMode)
    : "overview";
  const selectedMonth = validMonth(params?.month, today.getMonth() + 1);
  const selectedYear = validYear(params?.year, today.getFullYear());
  const { start, end } = monthRange(selectedYear, selectedMonth);
  const monthlyStart =
    mode === "month"
      ? start
      : new Date(today.getFullYear(), today.getMonth() - MONTHLY_LOOKBACK_MONTHS + 1, 1);
  const monthlyEnd =
    mode === "month" ? end : new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const selectedPeriod = monthLabel(selectedYear, selectedMonth);

  const paymentWhere =
    mode === "month"
      ? {
          paymentDate: {
            gte: start,
            lt: end,
          },
        }
      : {};
  const chargeWhere =
    mode === "month"
      ? {
          OR: [
            { dueDate: { gte: start, lt: end } },
            {
              dueDate: null,
              createdAt: {
                gte: start,
                lt: end,
              },
            },
          ],
        }
      : {};
  const payrollWhere =
    mode === "month"
      ? {
          month: selectedMonth,
          year: selectedYear,
        }
      : {};

  const [
    payments,
    charges,
    payrolls,
    monthlyPayments,
    monthlyPayrolls,
    tuitionAggregate,
    paymentAggregate,
    payrollItemAggregate,
    paidPayrollItemAggregate,
  ] =
    await Promise.all([
      prisma.payment.findMany({
        where: paymentWhere,
        include: {
          receivedBy: true,
          tuitionCharge: {
            include: {
              student: true,
              courseClass: true,
            },
          },
        },
        orderBy: { paymentDate: "desc" },
        take: mode === "overview" ? 8 : FINANCE_DETAIL_LIMIT,
      }),
      prisma.tuitionCharge.findMany({
        where: chargeWhere,
        include: {
          student: true,
          courseClass: true,
        },
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
        take: FINANCE_DETAIL_LIMIT,
      }),
      prisma.payroll.findMany({
        where: payrollWhere,
        include: {
          items: {
            include: {
              staffUser: {
                include: {
                  staffProfile: true,
                },
              },
              courseClass: true,
            },
            orderBy: { staffUser: { name: "asc" } },
          },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: mode === "month" ? 1 : 12,
      }),
      prisma.payment.findMany({
        where: {
          paymentDate: {
            gte: monthlyStart,
            lt: monthlyEnd,
          },
        },
        select: {
          amount: true,
          paymentDate: true,
        },
      }),
      prisma.payroll.findMany({
        where:
          mode === "month"
            ? { month: selectedMonth, year: selectedYear }
            : { year: { gte: monthlyStart.getFullYear() } },
        include: {
          items: {
            select: {
              totalAmount: true,
            },
          },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: mode === "month" ? 1 : 18,
      }),
      prisma.tuitionCharge.aggregate({
        where: chargeWhere,
        _sum: {
          amountDue: true,
          amountPaid: true,
        },
      }),
      prisma.payment.aggregate({
        where: paymentWhere,
        _sum: {
          amount: true,
        },
      }),
      prisma.payrollItem.aggregate({
        where: { payroll: payrollWhere },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.payrollItem.aggregate({
        where: {
          payroll: {
            ...payrollWhere,
            status: PayrollStatus.PAID,
          },
        },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

  const payrollItems = payrolls.flatMap((payroll) =>
    payroll.items.map((item) => ({ ...item, payroll })),
  );
  const totalDue = toMoney(tuitionAggregate._sum.amountDue);
  const totalPaidOnCharges = toMoney(tuitionAggregate._sum.amountPaid);
  const totalCollected = toMoney(paymentAggregate._sum.amount);
  const totalExpense = toMoney(payrollItemAggregate._sum.totalAmount);
  const paidExpense = toMoney(paidPayrollItemAggregate._sum.totalAmount);
  const remainingDebt = Math.max(totalDue - totalPaidOnCharges, 0);
  const netCash = totalCollected - paidExpense;

  const monthlyMap = new Map<
    string,
    { label: string; income: number; expense: number; paidExpense: number }
  >();

  for (const payment of monthlyPayments) {
    const key = monthKey(payment.paymentDate);
    const current = monthlyMap.get(key) ?? {
      label: `Tháng ${key.slice(5, 7)}/${key.slice(0, 4)}`,
      income: 0,
      expense: 0,
      paidExpense: 0,
    };
    current.income += toMoney(payment.amount);
    monthlyMap.set(key, current);
  }

  for (const payroll of monthlyPayrolls) {
    const key = `${payroll.year}-${String(payroll.month).padStart(2, "0")}`;
    const current = monthlyMap.get(key) ?? {
      label: monthLabel(payroll.year, payroll.month),
      income: 0,
      expense: 0,
      paidExpense: 0,
    };
    const payrollTotal = sumMoney(payroll.items, (item) => item.totalAmount);
    current.expense += payrollTotal;
    if (payroll.status === PayrollStatus.PAID) {
      current.paidExpense += payrollTotal;
    }
    monthlyMap.set(key, current);
  }

  const monthlyRows = [...monthlyMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, value]) => ({
      key,
      ...value,
      net: value.income - value.paidExpense,
    }));

  const studentMap = new Map<
    string,
    { name: string; due: number; paid: number; collected: number; debt: number }
  >();

  for (const charge of charges) {
    const current = studentMap.get(charge.studentId) ?? {
      name: charge.student.fullName,
      due: 0,
      paid: 0,
      collected: 0,
      debt: 0,
    };
    current.due += toMoney(charge.amountDue);
    current.paid += toMoney(charge.amountPaid);
    current.debt = Math.max(current.due - current.paid, 0);
    studentMap.set(charge.studentId, current);
  }

  for (const payment of payments) {
    const student = payment.tuitionCharge.student;
    const current = studentMap.get(student.id) ?? {
      name: student.fullName,
      due: 0,
      paid: 0,
      collected: 0,
      debt: 0,
    };
    current.collected += toMoney(payment.amount);
    studentMap.set(student.id, current);
  }

  const studentRows = [...studentMap.values()].sort(
    (a, b) => b.collected + b.debt - (a.collected + a.debt),
  );

  const staffMap = new Map<
    string,
    { name: string; payroll: number; paidPayroll: number; items: number }
  >();

  for (const item of payrollItems) {
    const current = staffMap.get(item.staffUserId) ?? {
      name: item.staffUser.staffProfile?.fullName ?? item.staffUser.name,
      payroll: 0,
      paidPayroll: 0,
      items: 0,
    };
    current.payroll += toMoney(item.totalAmount);
    current.paidPayroll +=
      item.payroll.status === PayrollStatus.PAID ? toMoney(item.totalAmount) : 0;
    current.items += 1;
    staffMap.set(item.staffUserId, current);
  }

  const staffRows = [...staffMap.values()].sort((a, b) => b.payroll - a.payroll);
  const recentPayments = payments.slice(0, mode === "month" ? 20 : 8);
  const recentPayrollItems = payrollItems.slice(0, mode === "month" ? 20 : 8);

  const cards = [
    ["Tổng phải thu", formatCurrency(totalDue), "Học phí đã lập"],
    ["Tổng đã thu", formatCurrency(totalCollected), "Tiền vào thực tế"],
    ["Chi lương", formatCurrency(totalExpense), "Bảng lương đã lập"],
    ["Chênh lệch thu - chi", formatCurrency(netCash), "Thu trừ lương đã thanh toán"],
    ["Công nợ còn lại", formatCurrency(remainingDebt), "Phải thu chưa đủ"],
    ["Lương đã thanh toán", formatCurrency(paidExpense), "Chi thực tế"],
  ];

  return (
    <AppShell session={session}>
      <PageHeader
        title="Báo cáo tài chính"
        description="Theo dõi thu học phí, công nợ và chi lương nhân sự."
      />

      <div className="flex flex-wrap items-center gap-2">
        {[
          ["overview", "Thu - chi tổng"],
          ["month", "Theo tháng"],
          ["person", "Theo cá nhân"],
        ].map(([itemMode, label]) => (
          <a
            key={itemMode}
            href={modeHref(itemMode as ReportMode, selectedMonth, selectedYear)}
            className={[
              "inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium",
              mode === itemMode
                ? "border-yellow-300 bg-[#ffe66d] text-[#17215c]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-[#fff7cc]",
            ].join(" ")}
          >
            {label}
          </a>
        ))}
      </div>

      {mode === "month" ? (
        <form className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <input type="hidden" name="mode" value="month" />
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Tháng</span>
            <select
              name="month"
              defaultValue={selectedMonth}
              className="h-10 rounded-md border border-slate-200 bg-white px-3"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
                <option key={item} value={item}>
                  Tháng {item}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Năm</span>
            <input
              name="year"
              type="number"
              min={2020}
              max={2100}
              defaultValue={selectedYear}
              className="h-10 w-28 rounded-md border border-slate-200 px-3"
            />
          </label>
          <button
            type="submit"
            className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
          >
            Xem báo cáo
          </button>
          <p className="text-sm text-slate-500">Đang xem {selectedPeriod}</p>
        </form>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, hint]) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      {mode !== "person" ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">
                {mode === "month" ? `Dòng tiền ${selectedPeriod}` : "Thu - chi theo tháng"}
              </h2>
              {mode === "overview" ? (
                <a
                  href={modeHref("month", selectedMonth, selectedYear)}
                  className="text-sm font-medium text-[#17215c] hover:underline"
                >
                  Xem theo tháng
                </a>
              ) : null}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Kỳ</th>
                    <th className="px-3 py-2 font-medium">Thu học phí</th>
                    <th className="px-3 py-2 font-medium">Chi lương</th>
                    <th className="px-3 py-2 font-medium">Lương đã thanh toán</th>
                    <th className="px-3 py-2 font-medium">Thu - chi thực tế</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(mode === "month"
                    ? monthlyRows.filter(
                        (row) =>
                          row.key ===
                          `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`,
                      )
                    : monthlyRows
                  ).map((row) => (
                    <tr key={row.key}>
                      <td className="px-3 py-2 font-medium">{row.label}</td>
                      <td className="px-3 py-2 text-emerald-700">
                        {formatCurrency(row.income)}
                      </td>
                      <td className="px-3 py-2 text-rose-700">
                        {formatCurrency(row.expense)}
                      </td>
                      <td className="px-3 py-2">{formatCurrency(row.paidExpense)}</td>
                      <td className="px-3 py-2 font-semibold">
                        {formatCurrency(row.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!monthlyRows.length ? (
                <p className="p-3 text-sm text-slate-500">Chưa có dữ liệu tài chính.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Khoản thu gần đây</h2>
            <div className="mt-3 space-y-3">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium">
                      {payment.tuitionCharge.student.fullName}
                    </p>
                    <p className="shrink-0 text-sm font-semibold text-emerald-700">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(payment.paymentDate)} · Người thu:{" "}
                    {payment.receivedBy?.name ?? "-"}
                  </p>
                </div>
              ))}
              {!recentPayments.length ? (
                <p className="text-sm text-slate-500">Chưa có khoản thu.</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {mode === "month" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Khoản chi lương {selectedPeriod}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Nhân sự</th>
                  <th className="px-3 py-2 font-medium">Lớp/Công việc</th>
                  <th className="px-3 py-2 font-medium">Số buổi</th>
                  <th className="px-3 py-2 font-medium">Số giờ</th>
                  <th className="px-3 py-2 font-medium">Tổng lương</th>
                  <th className="px-3 py-2 font-medium">Trạng thái bảng lương</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPayrollItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-medium">
                      {item.staffUser.staffProfile?.fullName ?? item.staffUser.name}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {item.courseClass?.name ?? item.note ?? "-"}
                    </td>
                    <td className="px-3 py-2">{item.sessionsCount}</td>
                    <td className="px-3 py-2">{toMoney(item.hoursCount)}</td>
                    <td className="px-3 py-2 font-semibold text-rose-700">
                      {formatCurrency(item.totalAmount)}
                    </td>
                    <td className="px-3 py-2">
                      {payrollStatusLabels[item.payroll.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!recentPayrollItems.length ? (
              <p className="p-3 text-sm text-slate-500">Chưa có khoản chi lương.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {mode === "person" ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Theo học viên</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Học viên</th>
                    <th className="px-3 py-2 font-medium">Phải thu</th>
                    <th className="px-3 py-2 font-medium">Đã ghi nhận</th>
                    <th className="px-3 py-2 font-medium">Thu thực tế</th>
                    <th className="px-3 py-2 font-medium">Công nợ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentRows.map((row) => (
                    <tr key={row.name}>
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2">{formatCurrency(row.due)}</td>
                      <td className="px-3 py-2">{formatCurrency(row.paid)}</td>
                      <td className="px-3 py-2 text-emerald-700">
                        {formatCurrency(row.collected)}
                      </td>
                      <td className="px-3 py-2 font-semibold text-rose-700">
                        {formatCurrency(row.debt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!studentRows.length ? (
                <p className="p-3 text-sm text-slate-500">Chưa có dữ liệu học viên.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Theo nhân sự</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nhân sự</th>
                    <th className="px-3 py-2 font-medium">Số dòng lương</th>
                    <th className="px-3 py-2 font-medium">Tổng lương</th>
                    <th className="px-3 py-2 font-medium">Đã thanh toán</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffRows.map((row) => (
                    <tr key={row.name}>
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2">{row.items}</td>
                      <td className="px-3 py-2 font-semibold text-rose-700">
                        {formatCurrency(row.payroll)}
                      </td>
                      <td className="px-3 py-2">{formatCurrency(row.paidPayroll)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!staffRows.length ? (
                <p className="p-3 text-sm text-slate-500">Chưa có dữ liệu nhân sự.</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
