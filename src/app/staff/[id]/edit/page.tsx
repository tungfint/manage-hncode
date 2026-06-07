import Link from "next/link";
import { notFound } from "next/navigation";
import { updateStaffAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { staffTypeLabels, userStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type EditStaffPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ updated?: string }>;
};

export default async function EditStaffPage({
  params,
  searchParams,
}: EditStaffPageProps) {
  const session = await requirePermission("user.manage");
  const { id } = await params;
  const query = await searchParams;
  const [staff, roles] = await Promise.all([
    prisma.staffProfile.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            roles: {
              include: { role: true },
            },
          },
        },
      },
    }),
    prisma.role.findMany({
      where: {
        code: {
          notIn: ["student", "parent"],
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!staff) {
    notFound();
  }

  const action = updateStaffAction.bind(null, id);
  const currentRoleId = staff.user.roles[0]?.roleId ?? "";

  return (
    <AppShell session={session}>
      <PageHeader
        title="Sửa nhân sự"
        description={`Cập nhật hồ sơ, tài khoản và vai trò của ${staff.fullName}.`}
        action={
          <Link
            href="/staff"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Quay lại
          </Link>
        }
      />
      {query?.updated ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã cập nhật nhân sự.
        </div>
      ) : null}
      <form
        action={action}
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2"
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm lg:col-span-2">
          <p className="font-medium text-slate-900">Thông tin tài khoản</p>
          <p className="mt-1 text-slate-600">
            Tạo ngày {formatDate(staff.user.createdAt)} · bắt đổi mật khẩu:{" "}
            {staff.user.mustChangePassword ? "Có" : "Không"}
          </p>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Họ và tên *</span>
          <input
            name="name"
            required
            defaultValue={staff.fullName}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email *</span>
          <input
            name="email"
            type="email"
            required
            defaultValue={staff.email ?? staff.user.email ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Số điện thoại</span>
          <input
            name="phone"
            defaultValue={staff.phone ?? staff.user.phone ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Trạng thái tài khoản</span>
          <select
            name="status"
            defaultValue={staff.user.status}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          >
            {Object.entries(userStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Công việc</span>
          <select
            name="staffType"
            defaultValue={staff.staffType}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          >
            {Object.entries(staffTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Vai trò tài khoản</span>
          <select
            name="roleId"
            defaultValue={currentRoleId}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block lg:col-span-2">
          <span className="text-sm font-medium">Công việc phụ trách</span>
          <input
            name="responsibility"
            defaultValue={staff.responsibility ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Ngân hàng</span>
          <input
            name="bankName"
            defaultValue={staff.bankName ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Số tài khoản</span>
          <input
            name="bankAccountNumber"
            defaultValue={staff.bankAccountNumber ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="text-sm font-medium">Ghi chú</span>
          <textarea
            name="note"
            rows={4}
            defaultValue={staff.note ?? ""}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <div className="flex justify-end gap-2 lg:col-span-2">
          <Link
            href="/staff"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Hủy
          </Link>
          <button
            type="submit"
            className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
          >
            Lưu thay đổi
          </button>
        </div>
      </form>
    </AppShell>
  );
}
