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
  const statusWhere = status
    ? { status: status as never }
    : { status: { not: "DISABLED" as const } };
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
    user: statusWhere,
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
        title="Nhân sự"
        description="Quản lý giáo viên, kế toán, lễ tân, học vụ và cộng tác viên."
        action={
          <Link
            href="/staff/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
          >
            <Plus size={17} aria-hidden="true" />
            Thêm nhân sự
          </Link>
        }
      />
      {params?.created ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã thêm nhân sự mới.
        </div>
      ) : null}
      <SearchFilter q={q} placeholder="Tìm theo tên, SĐT, email" />
      {params?.deleted ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã xoá nhân sự.
        </div>
      ) : null}
      {params?.error === "self_delete" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Không thể xoá chính tài khoản đang đăng nhập.
        </div>
      ) : null}
      {params?.error === "staff_in_use" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Không thể xoá nhân sự này vì đã có dữ liệu nghiệp vụ liên quan.
        </div>
      ) : null}
      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="q" value={q} />
        <select
          name="staffType"
          defaultValue={staffType}
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        >
          <option value="">Tất cả vai trò công việc</option>
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
          <option value="">Tất cả trạng thái tài khoản</option>
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
          Lọc
        </button>
      </form>
      {staff.length ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nhân sự</th>
                <th className="px-4 py-3 font-medium">Công việc</th>
                <th className="px-4 py-3 font-medium">Vai trò tài khoản</th>
                <th className="px-4 py-3 font-medium">Phụ trách</th>
                <th className="px-4 py-3 font-medium">Ngân hàng</th>
                <th className="px-4 py-3 font-medium">Bắt đầu</th>
                <th className="px-4 py-3 font-medium">Tài khoản</th>
                <th className="px-4 py-3 font-medium">Thao tác</th>
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
                      {item.phone ?? "-"} · {item.email ?? "-"}
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
                          message={`Xoá hẳn nhân sự ${item.fullName}? Thao tác này sẽ xoá tài khoản và hồ sơ nhân sự.`}
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
        <EmptyState title="Chưa có nhân sự phù hợp" />
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
