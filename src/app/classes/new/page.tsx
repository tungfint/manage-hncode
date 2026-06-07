import Link from "next/link";
import { createClassAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { classStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export default async function NewClassPage() {
  const session = await requirePermission("class.create");
  const [branches, rooms] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    prisma.room.findMany({ include: { branch: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Tạo lớp học"
        description="Tạo thông tin lớp trước, sau đó phân công giáo viên và tạo lịch ở trang chi tiết."
        action={
          <Link
            href="/classes"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Quay lại
          </Link>
        }
      />
      <form
        action={createClassAction}
        className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-2"
      >
        <label className="block">
          <span className="text-sm font-medium">Tên lớp *</span>
          <input
            name="name"
            required
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Môn học</span>
          <input
            name="subject"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cấp độ</span>
          <input
            name="level"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Trạng thái</span>
          <select
            name="status"
            defaultValue="PLANNED"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          >
            {Object.entries(classStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cơ sở</span>
          <select
            name="branchId"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          >
            <option value="">Chưa chọn</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Phòng học</span>
          <select
            name="roomId"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          >
            <option value="">Chưa chọn</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.branch.name} · {room.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Ngày khai giảng</span>
          <input
            name="startDate"
            type="date"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Ngày kết thúc dự kiến</span>
          <input
            name="expectedEndDate"
            type="date"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Học phí trọn khóa</span>
          <input
            name="tuitionFee"
            type="number"
            min="0"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cách tính học phí</span>
          <select
            name="tuitionMode"
            defaultValue="COURSE"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          >
            <option value="COURSE">Trọn khóa</option>
            <option value="PER_SESSION_TOTAL">Theo số buổi dự kiến</option>
            <option value="PER_SESSION_ACTUAL">Theo số buổi thực học</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Đơn giá mỗi buổi</span>
          <input
            name="tuitionPerSession"
            type="number"
            min="0"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Số buổi dự kiến</span>
          <input
            name="totalSessions"
            type="number"
            min="0"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="flex items-center gap-2 rounded-md border border-yellow-200 bg-[#fff8d7] px-3 py-2 text-sm font-medium lg:col-span-2">
          <input name="chargeByActualSessions" type="checkbox" className="h-4 w-4" />
          Tự tính theo số buổi học thực tế khi thu học phí
        </label>
        <label className="block lg:col-span-2">
          <span className="text-sm font-medium">Ghi chú lớp</span>
          <textarea
            name="note"
            rows={4}
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <div className="flex justify-end gap-2 lg:col-span-2">
          <Link
            href="/classes"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Hủy
          </Link>
          <button
            type="submit"
            className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Tạo lớp
          </button>
        </div>
      </form>
    </AppShell>
  );
}
