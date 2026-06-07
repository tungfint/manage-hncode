import Link from "next/link";
import { notFound } from "next/navigation";
import { updateParentAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type EditParentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditParentPage({ params }: EditParentPageProps) {
  const session = await requirePermission("parent.update");
  const { id } = await params;
  const parent = await prisma.parent.findUnique({ where: { id } });

  if (!parent) {
    notFound();
  }

  const action = updateParentAction.bind(null, id);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Sửa phụ huynh"
        description="Cập nhật thông tin liên hệ và ghi chú chăm sóc."
        action={
          <Link
            href="/parents"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Quay lại
          </Link>
        }
      />
      <form
        action={action}
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2"
      >
        <label className="block">
          <span className="text-sm font-medium">Họ tên *</span>
          <input
            name="fullName"
            required
            defaultValue={parent.fullName}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Số điện thoại</span>
          <input
            name="phone"
            defaultValue={parent.phone ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            defaultValue={parent.email ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Địa chỉ</span>
          <input
            name="address"
            defaultValue={parent.address ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="text-sm font-medium">Ghi chú chăm sóc</span>
          <textarea
            name="note"
            rows={5}
            defaultValue={parent.note ?? ""}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <div className="flex justify-end gap-2 lg:col-span-2">
          <Link
            href="/parents"
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
