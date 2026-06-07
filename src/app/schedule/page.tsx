import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { getAccessibleClassIds } from "@/lib/data-scope";
import { formatDate, toSearch } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ensureUpcomingSessions } from "@/lib/sessions";

const dayLabels = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

type SchedulePageProps = {
  searchParams?: Promise<{
    class?: string;
    day?: string;
    teacher?: string;
    room?: string;
    status?: string;
  }>;
};

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const session = await requirePermission("schedule.view");
  await ensureUpcomingSessions(7);
  const params = await searchParams;
  const classFilter = toSearch(params?.class);
  const teacherFilter = toSearch(params?.teacher);
  const roomFilter = toSearch(params?.room);
  const statusFilter = toSearch(params?.status);
  const dayFilter = toSearch(params?.day);
  const accessibleClassIds = await getAccessibleClassIds(session, "schedule.view");
  const schedules = await prisma.classSchedule.findMany({
    where: {
      ...(accessibleClassIds ? { classId: { in: accessibleClassIds } } : {}),
      ...(classFilter
        ? { courseClass: { name: { contains: classFilter, mode: "insensitive" as const } } }
        : {}),
      ...(teacherFilter
        ? {
            courseClass: {
              teachers: {
                some: {
                  teacher: { name: { contains: teacherFilter, mode: "insensitive" as const } },
                  status: "ACTIVE",
                },
              },
            },
          }
        : {}),
      ...(roomFilter
        ? {
            room: {
              OR: [
                { name: { contains: roomFilter, mode: "insensitive" as const } },
                { branch: { name: { contains: roomFilter, mode: "insensitive" as const } } },
              ],
            },
          }
        : {}),
      ...(statusFilter ? { status: statusFilter as never } : {}),
      ...(dayFilter ? { dayOfWeek: Number(dayFilter) || undefined } : {}),
    },
    include: {
      courseClass: {
        include: {
          teachers: {
            where: { status: "ACTIVE" },
            include: { teacher: true },
          },
        },
      },
      room: {
        include: { branch: true },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return (
    <AppShell session={session}>
      <PageHeader
        title="Lịch học"
        description="Lịch cố định theo lớp, phòng học và cơ sở."
      />
      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-5">
        <input name="class" defaultValue={classFilter} placeholder="Lớp" className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]" />
        <select name="day" defaultValue={dayFilter} className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]">
          <option value="">Tất cả thứ</option>
          {dayLabels.slice(1).map((label, index) => (
            <option key={label} value={index + 1}>{label}</option>
          ))}
        </select>
        <input name="teacher" defaultValue={teacherFilter} placeholder="Giáo viên" className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]" />
        <input name="room" defaultValue={roomFilter} placeholder="Phòng / cơ sở" className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]" />
        <select name="status" defaultValue={statusFilter} className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]">
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang áp dụng</option>
          <option value="INACTIVE">Ngừng</option>
        </select>
        <button type="submit" className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white md:col-span-5">
          Lọc lịch học
        </button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Thứ</th>
              <th className="px-4 py-3 font-medium">Giờ</th>
              <th className="px-4 py-3 font-medium">Lớp</th>
              <th className="px-4 py-3 font-medium">Phòng / cơ sở</th>
              <th className="px-4 py-3 font-medium">Giáo viên</th>
              <th className="px-4 py-3 font-medium">Hiệu lực</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {schedules.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-4 font-medium">{dayLabels[item.dayOfWeek]}</td>
                <td className="px-4 py-4 text-zinc-600">
                  {item.startTime} - {item.endTime}
                </td>
                <td className="px-4 py-4">{item.courseClass.name}</td>
                <td className="px-4 py-4 text-zinc-600">
                  {item.room
                    ? `${item.room.name} · ${item.room.branch.name}`
                    : "Chưa chọn"}
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {item.courseClass.teachers
                    .map((teacher) => teacher.teacher.name)
                    .join(", ") || "-"}
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {formatDate(item.startDate)} - {formatDate(item.endDate)}
                </td>
                <td className="px-4 py-4">
                  <Badge tone={item.status === "ACTIVE" ? "success" : "warning"}>
                    {item.status === "ACTIVE" ? "Đang áp dụng" : "Ngừng"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
