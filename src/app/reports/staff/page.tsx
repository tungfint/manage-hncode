import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { staffTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export default async function StaffReportPage() {
  const session = await requirePermission("report.staff.view");
  const [staff, sessionTeachers, payrollItems] = await Promise.all([
    prisma.staffProfile.groupBy({
      by: ["staffType"],
      _count: { staffType: true },
    }),
    prisma.sessionTeacher.count(),
    prisma.payrollItem.aggregate({ _sum: { totalAmount: true } }),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Báo cáo nhân sự"
        description="Số lượng nhân sự, buổi dạy và tổng lương đã lập."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {staff.map((item) => (
          <div
            key={item.staffType}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-zinc-500">{staffTypeLabels[item.staffType]}</p>
            <p className="mt-2 text-3xl font-semibold">{item._count.staffType}</p>
          </div>
        ))}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Lượt giáo viên tham gia buổi học</p>
          <p className="mt-2 text-3xl font-semibold">{sessionTeachers}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Tổng lương đã lập</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatCurrency(payrollItems._sum.totalAmount)}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
