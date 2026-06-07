import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AuditLogsPage() {
  const session = await requirePermission("audit_log.view");
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell session={session}>
      <PageHeader
        title="Nhật ký thao tác"
        description="Theo dõi các thao tác quan trọng trong hệ thống."
      />
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Thời gian</th>
              <th className="px-4 py-3 font-medium">Người thao tác</th>
              <th className="px-4 py-3 font-medium">Hành động</th>
              <th className="px-4 py-3 font-medium">Đối tượng</th>
              <th className="px-4 py-3 font-medium">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-4 text-zinc-600">
                  {formatDateTime(log.createdAt)}
                </td>
                <td className="px-4 py-4">{log.user?.name ?? "Hệ thống"}</td>
                <td className="px-4 py-4 font-medium">{log.action}</td>
                <td className="px-4 py-4 text-zinc-600">{log.entityType}</td>
                <td className="px-4 py-4 text-xs text-zinc-500">
                  {log.entityId ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
