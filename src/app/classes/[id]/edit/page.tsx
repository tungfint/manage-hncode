import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateClassAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ClassLocationManager } from "@/components/class-location-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { canAccessClass } from "@/lib/data-scope";
import { classStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const OPTION_LIMIT = 200;

function dateValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

type EditClassPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    error?: string;
    locationUpdated?: string;
    locationError?: string;
  }>;
};

export default async function EditClassPage({
  params,
  searchParams,
}: EditClassPageProps) {
  const session = await requirePermission("class.update");
  const { id } = await params;
  const query = await searchParams;

  if (!(await canAccessClass(session, id, "class.update"))) {
    redirect("/forbidden");
  }

  const [courseClass, branches, rooms] = await Promise.all([
    prisma.courseClass.findUnique({ where: { id } }),
    prisma.branch.findMany({
      select: { id: true, name: true, address: true, phone: true, status: true },
      orderBy: { name: "asc" },
      take: OPTION_LIMIT,
    }),
    prisma.room.findMany({
      select: {
        id: true,
        name: true,
        capacity: true,
        status: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
      take: OPTION_LIMIT,
    }),
  ]);

  if (!courseClass) {
    notFound();
  }

  const action = updateClassAction.bind(null, id);
  const activeBranches = branches.filter((branch) => branch.status === "ACTIVE");
  const activeRooms = rooms.filter((room) => room.status === "ACTIVE");

  return (
    <AppShell session={session}>
      <PageHeader
        title="Sửa lớp học"
        description="Cập nhật thông tin lớp, học phí và trạng thái vận hành."
        action={
          <Link
            href={`/classes/${id}`}
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Quay lại
          </Link>
        }
      />
      {query?.error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {query.error === "class_code_duplicate"
            ? "Mã lớp học đã tồn tại. Vui lòng dùng mã khác."
            : "Mã lớp học chưa hợp lệ."}
        </div>
      ) : null}
      <form
        action={action}
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2"
      >
        <label className="block">
          <span className="text-sm font-medium">Mã lớp học *</span>
          <input
            name="classCode"
            required
            defaultValue={courseClass.classCode}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm uppercase outline-none focus:border-[#08a7dc]"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Dùng mã này khi import học viên từ Excel.
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Tên lớp *</span>
          <input
            name="name"
            required
            defaultValue={courseClass.name}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Môn học</span>
          <input
            name="subject"
            defaultValue={courseClass.subject ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cấp độ</span>
          <input
            name="level"
            defaultValue={courseClass.level ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Trạng thái</span>
          <select
            name="status"
            defaultValue={courseClass.status}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
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
            defaultValue={courseClass.branchId ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          >
            <option value="">Chưa chọn</option>
            {activeBranches.map((branch) => (
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
            defaultValue={courseClass.roomId ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          >
            <option value="">Chưa chọn</option>
            {activeRooms.map((room) => (
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
            defaultValue={dateValue(courseClass.startDate)}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Ngày kết thúc dự kiến</span>
          <input
            name="expectedEndDate"
            type="date"
            defaultValue={dateValue(courseClass.expectedEndDate)}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Học phí trọn khóa</span>
          <input
            name="tuitionFee"
            type="number"
            min="0"
            defaultValue={courseClass.tuitionFee?.toString() ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cách tính học phí</span>
          <select
            name="tuitionMode"
            defaultValue={courseClass.tuitionMode}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
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
            defaultValue={courseClass.tuitionPerSession?.toString() ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Số buổi dự kiến</span>
          <input
            name="totalSessions"
            type="number"
            min="0"
            defaultValue={courseClass.totalSessions ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="flex items-center gap-2 rounded-md border border-yellow-200 bg-[#fff8d7] px-3 py-2 text-sm font-medium lg:col-span-2">
          <input
            name="chargeByActualSessions"
            type="checkbox"
            defaultChecked={courseClass.chargeByActualSessions}
            className="h-4 w-4"
          />
          Tự tính theo số buổi học thực tế khi thu học phí
        </label>
        <label className="block lg:col-span-2">
          <span className="text-sm font-medium">Ghi chú lớp</span>
          <textarea
            name="note"
            rows={4}
            defaultValue={courseClass.note ?? ""}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <div className="flex justify-end gap-2 lg:col-span-2">
          <Link
            href={`/classes/${id}`}
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
      <ClassLocationManager
        branches={branches}
        rooms={rooms}
        redirectTo={`/classes/${id}/edit`}
        locationUpdated={query?.locationUpdated}
        locationError={query?.locationError}
      />
    </AppShell>
  );
}
