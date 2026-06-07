import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function FinanceReportPage() {
  const session = await requirePermission("report.finance.view");
  const [tuition, payments, overdue] = await Promise.all([
    prisma.tuitionCharge.aggregate({
      _sum: { amountDue: true, amountPaid: true, discountAmount: true },
    }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.tuitionCharge.count({
      where: { status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
    }),
  ]);
  const amountDue = Number(tuition._sum.amountDue?.toString() ?? 0);
  const amountPaid = Number(tuition._sum.amountPaid?.toString() ?? 0);

  const cards = [
    ["Tổng phải thu", formatCurrency(amountDue)],
    ["Tổng đã thu", formatCurrency(payments._sum.amount)],
    ["Công nợ còn lại", formatCurrency(amountDue - amountPaid)],
    ["Khoản cần theo dõi", overdue],
  ];

  return (
    <AppShell session={session}>
      <PageHeader
        title="Báo cáo tài chính"
        description="Doanh thu, công nợ và thanh toán cơ bản."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
