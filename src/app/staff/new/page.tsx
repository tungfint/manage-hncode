import Link from "next/link";
import { createStaffAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { staffTypeLabels, userStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const DEFAULT_TEMP_PASSWORD = "HNCODElaptrinhvuive";

export default async function NewStaffPage() {
  const session = await requirePermission("user.manage");
  const roles = await prisma.role.findMany({
    where: {
      code: {
        notIn: ["student", "parent"],
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell session={session}>
      <PageHeader
        title="Thêm nhân sự"
        description="Tạo tài khoản nhân sự, vai trò và hồ sơ công việc trong một bước."
        action={
          <Link
            href="/staff"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Quay lại
          </Link>
        }
      />
      <form
        action={createStaffAction}
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2"
      >
        <label className="block">
          <span className="text-sm font-medium">Họ và tên *</span>
          <input
            name="name"
            required
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email *</span>
          <input
            name="email"
            type="email"
            required
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Số điện thoại</span>
          <input
            name="phone"
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Mật khẩu tạm *</span>
          <input
            name="password"
            required
            minLength={8}
            defaultValue={DEFAULT_TEMP_PASSWORD}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Công việc</span>
          <select
            name="staffType"
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
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Trạng thái tài khoản</span>
          <select
            name="status"
            defaultValue="ACTIVE"
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
          <span className="text-sm font-medium">Công việc phụ trách</span>
          <input
            name="responsibility"
            placeholder="Ví dụ: Giáo viên Python Kids, hỗ trợ lớp Scratch..."
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Ngân hàng</span>
          <input
            name="bankName"
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Số tài khoản</span>
          <input
            name="bankAccountNumber"
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="text-sm font-medium">Ghi chú</span>
          <textarea
            name="note"
            rows={4}
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
            Tạo nhân sự
          </button>
        </div>
      </form>
    </AppShell>
  );
}
