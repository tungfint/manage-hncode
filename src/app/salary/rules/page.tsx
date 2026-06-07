import Link from "next/link";
import { createSalaryRuleAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { salaryTypeLabels, staffTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type SalaryRulesPageProps = {
  searchParams?: Promise<{ created?: string }>;
};

export default async function SalaryRulesPage({
  searchParams,
}: SalaryRulesPageProps) {
  const session = await requirePermission("salary.view");
  const params = await searchParams;
  const [rules, staff, classes] = await Promise.all([
    prisma.salaryRule.findMany({
      include: {
        staffUser: {
          include: { staffProfile: true },
        },
        courseClass: true,
      },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.user.findMany({
      where: { staffProfile: { isNot: null } },
      include: { staffProfile: true },
      orderBy: { name: "asc" },
    }),
    prisma.courseClass.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Cấu hình lương"
        description="Mức lương gắn với nhân sự, lớp/công việc, cách tính và thời gian hiệu lực."
        action={
          <Link
            href="/payrolls"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Bảng lương
          </Link>
        }
      />
      {params?.created ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã thêm cấu hình lương.
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nhân sự</th>
                <th className="px-4 py-3 font-medium">Lớp / công việc</th>
                <th className="px-4 py-3 font-medium">Cách tính</th>
                <th className="px-4 py-3 font-medium">Mức</th>
                <th className="px-4 py-3 font-medium">Hiệu lực</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="px-4 py-4">
                    <p className="font-medium">{rule.staffUser.name}</p>
                    <p className="text-xs text-zinc-500">
                      {rule.staffUser.staffProfile
                        ? staffTypeLabels[rule.staffUser.staffProfile.staffType]
                        : "-"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {rule.courseClass?.name ?? rule.workName ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {salaryTypeLabels[rule.salaryType]}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {formatCurrency(rule.amount)}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {formatDate(rule.effectiveFrom)}
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={rule.status === "ACTIVE" ? "success" : "warning"}>
                      {rule.status === "ACTIVE" ? "Hiệu lực" : "Ngừng"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {can(session, "salary.manage") ? (
          <form
            action={createSalaryRuleAction}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <h2 className="mb-4 font-semibold">Thêm cấu hình lương</h2>
            <div className="space-y-3">
              <select
                name="staffUserId"
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                {staff.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <select
                name="classId"
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                <option value="">Không gắn lớp</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                name="workName"
                placeholder="Tên công việc nếu không gắn lớp"
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <input
                name="staffRole"
                placeholder="Vai trò trong lớp/công việc"
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  name="salaryType"
                  className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                >
                  {Object.entries(salaryTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  name="amount"
                  type="number"
                  min="0"
                  placeholder="Mức lương"
                  className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                />
              </div>
              <input
                name="effectiveFrom"
                type="date"
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <textarea
                name="description"
                rows={3}
                placeholder="Mô tả"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                className="h-10 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Lưu cấu hình
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </AppShell>
  );
}
