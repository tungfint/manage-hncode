import { Plus } from "lucide-react";
import Link from "next/link";
import { deleteStaffAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilter } from "@/components/ui/search-filter";
import { requirePermission } from "@/lib/auth";
import { formatDate, toInt, toSearch } from "@/lib/format";
import { staffTypeLabels, userStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const pageSize = 10;

type StaffPageProps = {
  searchParams?: Promise<{
    q?: string;
    staffType?: string;
    status?: string;
    page?: string;
    created?: string;
    deleted?: string;
    error?: string;
  }>;
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const session = await requirePermission("user.manage");
  const params = await searchParams;
  const q = toSearch(params?.q);
  const staffType = toSearch(params?.staffType);
  const status = toSearch(params?.status);
  const page = toInt(params?.page);
  const where = {
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { responsibility: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(staffType ? { staffType: staffType as never } : {}),
    ...(status ? { user: { status: status as never } } : {}),
  };
  const [staff, total] = await Promise.all([
    prisma.staffProfile.findMany({
      where,
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
      orderBy: { fullName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.staffProfile.count({ where }),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="NhÃ¢n sá»±"
        description="Quáº£n lÃ½ giÃ¡o viÃªn, káº¿ toÃ¡n, lá»… tÃ¢n, há»c vá»¥ vÃ  cá»™ng tÃ¡c viÃªn."
        action={
          <Link
            href="/staff/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
          >
            <Plus size={17} aria-hidden="true" />
            ThÃªm nhÃ¢n sá»±
          </Link>
        }
      />
      {params?.created ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          ÄÃ£ thÃªm nhÃ¢n sá»± má»›i.
        </div>
      ) : null}
      <SearchFilter q={q} placeholder="TÃ¬m theo tÃªn, SÄT, email" />
      {params?.deleted ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          ÄÃ£ xoÃ¡ nhÃ¢n sá»±.
        </div>
      ) : null}
      {params?.error === "self_delete" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          KhÃ´ng thá»ƒ xoÃ¡ chÃ­nh tÃ i khoáº£n Ä‘ang Ä‘Äƒng nháº­p.
        </div>
      ) : null}
      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="q" value={q} />
        <select
          name="staffType"
          defaultValue={staffType}
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        >
          <option value="">Táº¥t cáº£ vai trÃ² cÃ´ng viá»‡c</option>
          {Object.entries(staffTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        >
          <option value="">Táº¥t cáº£ tráº¡ng thÃ¡i tÃ i khoáº£n</option>
          {Object.entries(userStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
        >
          Lá»c
        </button>
      </form>
      {staff.length ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">NhÃ¢n sá»±</th>
                <th className="px-4 py-3 font-medium">CÃ´ng viá»‡c</th>
                <th className="px-4 py-3 font-medium">Vai trÃ² tÃ i khoáº£n</th>
                <th className="px-4 py-3 font-medium">Phá»¥ trÃ¡ch</th>
                <th className="px-4 py-3 font-medium">NgÃ¢n hÃ ng</th>
                <th className="px-4 py-3 font-medium">Báº¯t Ä‘áº§u</th>
                <th className="px-4 py-3 font-medium">TÃ i khoáº£n</th>
                <th className="px-4 py-3 font-medium">Thao tÃ¡c</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {staff.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4">
                    <Link
                      href={`/staff/${item.id}/edit`}
                      className="font-medium text-zinc-950 hover:text-[#08a7dc]"
                    >
                      {item.fullName}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {item.phone ?? "-"} Â· {item.email ?? "-"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {staffTypeLabels[item.staffType]}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.user.roles.map((role) => role.role.name).join(", ") || "-"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.responsibility ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    <p>{item.bankName ?? "-"}</p>
                    <p className="text-xs text-zinc-500">
                      {item.bankAccountNumber ?? "-"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {formatDate(item.startDate)}
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={item.user.status === "ACTIVE" ? "success" : "warning"}>
                      {userStatusLabels[item.user.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/staff/${item.id}/edit`}
                        className="font-medium text-[#08a7dc] hover:text-[#17215c]"
                      >
                        Sửa
                      </Link>
                      <form action={deleteStaffAction.bind(null, item.id)}>
                        <ConfirmSubmitButton
                          message={`Xoá nhân sự ${item.fullName}? Tài khoản sẽ bị ngừng dùng.`}
                          className="font-medium text-rose-700 hover:text-rose-800"
                        >
                          Xoá
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="ChÆ°a cÃ³ nhÃ¢n sá»± phÃ¹ há»£p" />
      )}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/staff"
        query={{ q, staffType, status }}
      />
    </AppShell>
  );
}
