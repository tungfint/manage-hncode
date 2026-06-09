import { refreshUpcomingSessionsAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth";
import { getAccessibleClassIds } from "@/lib/data-scope";
import { formatDate, toSearch } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ensureUpcomingSessions } from "@/lib/sessions";

const SCHEDULE_LIMIT = 200;

const dayLabels = [
  "",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ nhật",
];

const classColorClasses = [
  "border-cyan-200 bg-cyan-50 text-cyan-900",
  "border-blue-200 bg-blue-50 text-blue-900",
  "border-yellow-200 bg-yellow-50 text-yellow-900",
  "border-emerald-200 bg-emerald-50 text-emerald-900",
  "border-indigo-200 bg-indigo-50 text-indigo-900",
  "border-rose-200 bg-rose-50 text-rose-900",
  "border-violet-200 bg-violet-50 text-violet-900",
];

type SchedulePageProps = {
  searchParams?: Promise<{
    class?: string;
    day?: string;
    teacher?: string;
    room?: string;
    status?: string;
    details?: string;
    view?: string;
    sessionsUpdated?: string;
  }>;
};

function colorForClass(className: string) {
  let hash = 0;

  for (const char of className) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }

  return classColorClasses[hash % classColorClasses.length];
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const session = await requirePermission("schedule.view");
  await ensureUpcomingSessions(14);
  const params = await searchParams;
  const classFilter = toSearch(params?.class);
  const teacherFilter = toSearch(params?.teacher);
  const roomFilter = toSearch(params?.room);
  const statusFilter = toSearch(params?.status) || "ACTIVE";
  const dayFilter = toSearch(params?.day);
  const showDetails = toSearch(params?.details) === "1";
  const viewMode = toSearch(params?.view) === "grid" ? "grid" : "list";
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
        select: {
          id: true,
          name: true,
          teachers: {
            where: { status: "ACTIVE" },
            include: { teacher: { select: { id: true, name: true } } },
          },
        },
      },
      room: {
        select: {
          id: true,
          name: true,
          branch: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    take: SCHEDULE_LIMIT,
  });

  const baseQuery = {
    class: classFilter,
    day: dayFilter,
    teacher: teacherFilter,
    room: roomFilter,
    status: statusFilter,
    details: showDetails ? "1" : "",
    view: viewMode,
  };

  function scheduleHref(overrides: Partial<typeof baseQuery>) {
    const query = new URLSearchParams();

    Object.entries({ ...baseQuery, ...overrides }).forEach(([key, value]) => {
      if (value) {
        query.set(key, value);
      }
    });

    return `/schedule?${query.toString()}`;
  }

  return (
    <AppShell session={session}>
      <PageHeader
        title="Lịch học"
        description="Lịch cố định theo lớp, giáo viên, phòng học và cơ sở."
        action={
          can(session, "schedule.manage") ? (
            <form action={refreshUpcomingSessionsAction}>
              <button
                type="submit"
                className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
              >
                Cập nhật buổi học
              </button>
            </form>
          ) : null
        }
      />

      {params?.sessionsUpdated !== undefined ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã cập nhật buổi học trong 14 ngày tới. Tạo mới {params.sessionsUpdated} buổi.
        </div>
      ) : null}

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-5">
        <input type="hidden" name="view" value={viewMode} />
        {showDetails ? <input type="hidden" name="details" value="1" /> : null}
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

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1">
          <a
            href={scheduleHref({ view: "list" })}
            className={[
              "h-9 rounded px-3 py-2 text-sm font-medium",
              viewMode === "list" ? "bg-[#fff0a6] text-[#17215c]" : "text-slate-600 hover:bg-white",
            ].join(" ")}
          >
            Danh sách
          </a>
          <a
            href={scheduleHref({ view: "grid" })}
            className={[
              "h-9 rounded px-3 py-2 text-sm font-medium",
              viewMode === "grid" ? "bg-[#fff0a6] text-[#17215c]" : "text-slate-600 hover:bg-white",
            ].join(" ")}
          >
            Bảng thời khoá biểu
          </a>
        </div>
        <a
          href={scheduleHref({ details: showDetails ? "" : "1" })}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {showDetails ? "Ẩn cột hiệu lực/trạng thái" : "Hiện cột hiệu lực/trạng thái"}
        </a>
      </div>

      {viewMode === "list" ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-zinc-50 text-[#17215c]">
              <tr>
                <th className="px-4 py-3 font-bold">Thứ</th>
                <th className="px-4 py-3 font-bold">Giờ</th>
                <th className="px-4 py-3 font-bold">Lớp</th>
                <th className="px-4 py-3 font-bold">Giáo viên</th>
                <th className="px-4 py-3 font-bold">Phòng / cơ sở</th>
                {showDetails ? <th className="px-4 py-3 font-bold">Hiệu lực</th> : null}
                {showDetails ? <th className="px-4 py-3 font-bold">Trạng thái</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {schedules.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 font-bold text-[#17215c]">{dayLabels[item.dayOfWeek]}</td>
                  <td className="px-4 py-4 font-bold text-slate-700">
                    {item.startTime} - {item.endTime}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-md border px-2.5 py-1 text-sm font-bold ${colorForClass(item.courseClass.name)}`}>
                      {item.courseClass.name}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.courseClass.teachers
                      .map((teacher) => teacher.teacher.name)
                      .join(", ") || "-"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.room
                      ? `${item.room.name} · ${item.room.branch.name}`
                      : "Chưa chọn"}
                  </td>
                  {showDetails ? (
                    <td className="px-4 py-4 text-zinc-600">
                      {formatDate(item.startDate)} - {formatDate(item.endDate)}
                    </td>
                  ) : null}
                  {showDetails ? (
                    <td className="px-4 py-4">
                      <Badge tone={item.status === "ACTIVE" ? "success" : "warning"}>
                        {item.status === "ACTIVE" ? "Đang áp dụng" : "Ngừng"}
                      </Badge>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!schedules.length ? (
                <tr>
                  <td colSpan={showDetails ? 7 : 5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Chưa có lịch học phù hợp.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="grid min-w-[1180px] grid-cols-7">
            {dayLabels.slice(1).map((label, index) => {
              const dayIndex = index + 1;
              const items = schedules.filter((item) => item.dayOfWeek === dayIndex);

              return (
                <div key={label} className="min-h-64 border-r border-slate-100 last:border-r-0">
                  <div className="border-b border-slate-100 bg-slate-50 px-3 py-3 text-center text-sm font-bold text-[#17215c]">
                    {label}
                  </div>
                  <div className="space-y-2 p-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-md border p-2 text-xs ${colorForClass(item.courseClass.name)}`}
                      >
                        <p className="font-bold">{item.startTime} - {item.endTime}</p>
                        <p className="mt-1 text-sm font-bold">{item.courseClass.name}</p>
                        <p className="mt-1">
                          {item.courseClass.teachers
                            .map((teacher) => teacher.teacher.name)
                            .join(", ") || "-"}
                        </p>
                        <p className="mt-1">
                          {item.room
                            ? `${item.room.name} · ${item.room.branch.name}`
                            : "Chưa chọn phòng"}
                        </p>
                      </div>
                    ))}
                    {!items.length ? (
                      <p className="rounded-md border border-dashed border-slate-200 px-2 py-4 text-center text-xs text-slate-400">
                        Trống
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}
