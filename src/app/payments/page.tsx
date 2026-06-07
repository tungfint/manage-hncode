import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { getAccessibleStudentIds } from "@/lib/data-scope";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export default async function PaymentsPage() {
  const session = await requirePermission("payment.view");
  const accessibleStudentIds = await getAccessibleStudentIds(session, "payment.view");
  const payments = await prisma.payment.findMany({
    where: accessibleStudentIds
      ? {
          tuitionCharge: {
            studentId: { in: accessibleStudentIds },
          },
        }
      : {},
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
    take: 100,
  });

  return (
    <AppShell session={session}>
      <PageHeader
        title="Thanh toán"
        description="Lịch sử các khoản học phí đã ghi nhận."
      />
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Thời gian</th>
              <th className="px-4 py-3 font-medium">Học viên</th>
              <th className="px-4 py-3 font-medium">Lớp</th>
              <th className="px-4 py-3 font-medium">Số tiền</th>
              <th className="px-4 py-3 font-medium">Phương thức</th>
              <th className="px-4 py-3 font-medium">Người thu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td className="px-4 py-4 text-zinc-600">
                  {formatDateTime(payment.paymentDate)}
                </td>
                <td className="px-4 py-4 font-medium">
                  {payment.tuitionCharge.student.fullName}
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {payment.tuitionCharge.courseClass?.name ?? "-"}
                </td>
                <td className="px-4 py-4 font-semibold text-teal-700">
                  {formatCurrency(payment.amount)}
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {paymentMethodLabels[payment.method]}
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {payment.receivedBy?.name ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
