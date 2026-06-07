import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function RolesPage() {
  const session = await requirePermission("role.manage");
  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        include: { permission: true },
        orderBy: { permission: { code: "asc" } },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell session={session}>
      <PageHeader
        title="Vai trò & quyền"
        description="Vai trò là bộ quyền mặc định. Muốn cấp thêm hoặc thu hồi quyền riêng từng tài khoản, mở trang Tài khoản & quyền."
        action={
          <Link
            href="/admin/users"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Tài khoản & quyền
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => (
          <article
            key={role.id}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3">
              <h2 className="font-semibold">{role.name}</h2>
              <p className="text-sm text-zinc-500">{role.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {role.permissions.map((item) => (
                <span
                  key={item.id}
                  className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700"
                  title={item.permission.description ?? item.permission.name}
                >
                  {item.permission.code}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
