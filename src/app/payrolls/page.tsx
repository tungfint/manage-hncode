import Link from "next/link";
import { createPayrollAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth";
import { formatCurrency, formatDate, toSearch } from "@/lib/format";
import { payrollStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PayrollsPageProps = {
  searchParams?: Promise<{
    staffUserId?: string;
    classId?: string;
    month?: string;
    year?: string;
    created?: string;
    paid?: string;
    adjusted?: string;
  }>;
};

export default async function PayrollsPage({ searchParams }: PayrollsPageProps) {
  const session = await requirePermission("salary.view");
  const params = await searchParams;
  const staffUserId = toSearch(params?.staffUserId);
  const classId = toSearch(params?.classId);
  const month = toSearch(params?.month);
  const year = toSearch(params?.year);
  const [payrolls, staff, classes] = await Promise.all([
    prisma.payroll.findMany({
      where: {
        ...(month ? { month: Number(month) } : {}),
        ...(year ? { year: Number(year) } : {}),
        ...(staffUserId || classId
          ? {
              items: {
                some: {
                  ...(staffUserId ? { staffUserId } : {}),
                  ...(classId ? { classId } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        createdBy: true,
        approvedBy: true,
        paidBy: true,
        items: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
    prisma.user.findMany({
      where: { staffProfile: { isNot: null } },
      orderBy: { name: "asc" },
    }),
    prisma.courseClass.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Bảng lương"
        description="Quản lý bảng lương nháp, phụ cấp, khấu trừ và xác nhận thanh toán."
        action={
          <Link
            href="/salary/rules"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Cấu hình lương
          </Link>
        }
      />
      {params?.created || params?.paid || params?.adjusted ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {params.paid
            ? "Đã xác nhận thanh toán bảng lương."
            : params.adjusted
              ? "Đã cập nhật điều chỉnh lương."
              : "Đã tạo hoặc cập nhật bảng lương nháp."}
        </div>
      ) : null}
      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_1fr_120px_120px_auto]">
        <select
          name="staffUserId"
          defaultValue={staffUserId}
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        >
          <option value="">Tất cả nhân sự</option>
          {staff.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          name="classId"
          defaultValue={classId}
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        >
          <option value="">Tất cả lớp</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <input
          name="month"
          type="number"
          min="1"
          max="12"
          defaultValue={month}
          placeholder="Tháng"
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        />
        <input
          name="year"
          type="number"
          min="2020"
          defaultValue={year}
          placeholder="Năm"
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        />
        <button
          type="submit"
          className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
        >
          Lọc
        </button>
      </form>
      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Kỳ lương</th>
                <th className="px-4 py-3 font-medium">Thời gian tính</th>
                <th className="px-4 py-3 font-medium">Số dòng</th>
                <th className="px-4 py-3 font-medium">Tổng tiền</th>
                <th className="px-4 py-3 font-medium">Người tạo</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {payrolls.map((payroll) => {
                const total = payroll.items.reduce(
                  (sum, item) => sum + Number(item.totalAmount.toString()),
                  0,
                );

                return (
                  <tr key={payroll.id}>
                    <td className="px-4 py-4 font-medium">
                      {payroll.month.toString().padStart(2, "0")}/{payroll.year}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {formatDate(payroll.periodFrom)} - {formatDate(payroll.periodTo)}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {payroll.items.length}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {formatCurrency(total)}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {payroll.createdBy.name}
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        tone={
                          payroll.status === "PAID"
                            ? "success"
                            : payroll.status === "LOCKED"
                              ? "info"
                              : "warning"
                        }
                      >
                        {payrollStatusLabels[payroll.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/payrolls/${payroll.id}`}
                        className="font-medium text-[#17215c] underline-offset-4 hover:underline"
                      >
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {can(session, "salary.manage") ? (
          <form
            action={createPayrollAction}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <h2 className="mb-4 font-semibold">Tạo bảng lương nháp</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <input
                name="month"
                type="number"
                min="1"
                max="12"
                placeholder="Tháng"
                required
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <input
                name="year"
                type="number"
                min="2026"
                defaultValue="2026"
                placeholder="Năm"
                required
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <label className="block">
                <span className="text-sm font-medium">Từ ngày</span>
                <input
                  name="periodFrom"
                  type="date"
                  className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Đến ngày</span>
                <input
                  name="periodTo"
                  type="date"
                  className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <button
                type="submit"
                className="h-10 rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Tạo nháp
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </AppShell>
  );
}
