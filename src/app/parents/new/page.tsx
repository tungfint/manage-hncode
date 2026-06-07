import { createParentAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";

export default async function NewParentPage() {
  const session = await requirePermission("parent.create");

  return (
    <AppShell session={session}>
      <PageHeader
        title="Thêm phụ huynh"
        description="Lưu thông tin liên hệ để chăm sóc và nhắc lịch/học phí."
        action={
          <a
            href="/parents"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Quay lại
          </a>
        }
      />

      <form
        action={createParentAction}
        className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-2"
      >
        <label className="block">
          <span className="text-sm font-medium">Họ tên *</span>
          <input
            name="fullName"
            required
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Số điện thoại</span>
          <input
            name="phone"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Địa chỉ</span>
          <input
            name="address"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="text-sm font-medium">Ghi chú chăm sóc</span>
          <textarea
            name="note"
            rows={5}
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <div className="flex justify-end gap-2 lg:col-span-2">
          <a
            href="/parents"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Hủy
          </a>
          <button
            type="submit"
            className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Lưu phụ huynh
          </button>
        </div>
      </form>
    </AppShell>
  );
}
