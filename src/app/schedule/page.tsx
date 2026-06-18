import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
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

const classTextColorClasses = [
  "text-cyan-700",
  "text-blue-700",
  "text-amber-700",
  "text-emerald-700",
  "text-indigo-700",
  "text-rose-700",
  "text-violet-700",
  "text-sky-700",
  "text-teal-700",
  "text-fuchsia-700",
];

const timetableStartMinute = 6 * 60;
const timetableEndMinute = 22 * 60;
const timetableRangeMinute = timetableEndMinute - timetableStartMinute;
const timetableMinHeight = 330;

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
  return classColorClasses[colorIndexForClass(className) % classColorClasses.length];
}

function textColorForClass(className: string) {
  return classTextColorClasses[colorIndexForClass(className) % classTextColorClasses.length];
}

function colorIndexForClass(className: string) {
  let hash = 0;

  for (const char of className) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }

  return hash;
}

function timeToMinutes(time: string) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function timetableTop(time: string) {
  const minutes = Math.min(
    timetableEndMinute,
    Math.max(timetableStartMinute, timeToMinutes(time)),
  );

  return ((minutes - timetableStartMinute) / timetableRangeMinute) * 100;
}

function timetableHeight(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  const end = Math.max(start + 45, timeToMinutes(endTime));

  return Math.max(9, ((end - start) / timetableRangeMinute) * 100);
}

function layoutTimetableItems<T extends { id: string; startTime: string; endTime: string }>(
  items: T[],
) {
  const lanes: number[] = [];
  const layout = new Map<string, { lane: number; laneCount: number }>();
  const orderedItems = [...items].sort((a, b) => {
    const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    return startDiff || timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
  });

  for (const item of orderedItems) {
    const start = timeToMinutes(item.startTime);
    const end = Math.max(start + 45, timeToMinutes(item.endTime));
    let lane = lanes.findIndex((laneEnd) => laneEnd <= start);

    if (lane === -1) {
      lane = lanes.length;
      lanes.push(end);
    } else {
      lanes[lane] = end;
    }

    layout.set(item.id, { lane, laneCount: 1 });
  }

  const laneCount = Math.max(lanes.length, 1);

  for (const value of layout.values()) {
    value.laneCount = laneCount;
  }

  return layout;
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
      />

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-5">
        <input type="hidden" name="view" value={viewMode} />
        {showDetails ? <input type="hidden" name="details" value="1" /> : null}
        <input
          name="class"
          defaultValue={classFilter}
          placeholder="Lớp"
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        />
        <select
          name="day"
          defaultValue={dayFilter}
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        >
          <option value="">Tất cả thứ</option>
          {dayLabels.slice(1).map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
        <input
          name="teacher"
          defaultValue={teacherFilter}
          placeholder="Giáo viên"
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        />
        <input
          name="room"
          defaultValue={roomFilter}
          placeholder="Phòng / cơ sở"
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        />
        <select
          name="status"
          defaultValue={statusFilter}
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        >
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
          <div className="min-w-[1080px]">
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
              {dayLabels.slice(1).map((label) => (
                <div
                  key={label}
                  className="border-r border-slate-100 px-3 py-3 text-center text-sm font-bold text-[#17215c] last:border-r-0"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {dayLabels.slice(1).map((label, index) => {
                const dayIndex = index + 1;
                const items = schedules.filter((item) => item.dayOfWeek === dayIndex);
                const itemLayouts = layoutTimetableItems(items);

                return (
                  <div
                    key={label}
                    className="relative border-r border-slate-100 last:border-r-0"
                    style={{ height: timetableMinHeight }}
                  >
                    <div className="absolute inset-x-0 top-0 h-[37.5%] border-b border-cyan-100 bg-cyan-50/45 px-1.5 py-1">
                      <span className="rounded bg-white/75 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-cyan-700">
                        Sáng
                      </span>
                    </div>
                    <div className="absolute inset-x-0 top-[37.5%] h-[37.5%] border-b border-yellow-100 bg-yellow-50/55 px-1.5 py-1">
                      <span className="rounded bg-white/75 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-yellow-700">
                        Chiều
                      </span>
                    </div>
                    <div className="absolute inset-x-0 top-[75%] h-[25%] bg-indigo-50/45 px-1.5 py-1">
                      <span className="rounded bg-white/75 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-indigo-700">
                        Tối
                      </span>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-slate-200" />
                    <div className="pointer-events-none absolute inset-x-0 top-[37.5%] h-px bg-slate-200" />
                    <div className="pointer-events-none absolute inset-x-0 top-[75%] h-px bg-slate-200" />
                    <div className="pointer-events-none absolute left-2 top-[0.5%] text-[10px] font-medium text-slate-400">06:00</div>
                    <div className="pointer-events-none absolute left-2 top-[37.9%] text-[10px] font-medium text-slate-400">12:00</div>
                    <div className="pointer-events-none absolute left-2 top-[75.4%] text-[10px] font-medium text-slate-400">18:00</div>
                    <div className="absolute inset-0">
                      {items.map((item) => {
                        const layout = itemLayouts.get(item.id) ?? {
                          lane: 0,
                          laneCount: 1,
                        };
                        const columnWidth = 92 / layout.laneCount;
                        const mainTeacher =
                          item.courseClass.teachers.find((teacher) => teacher.teacherRole === "MAIN")
                            ?.teacher.name ??
                          item.courseClass.teachers[0]?.teacher.name ??
                          "-";

                        return (
                          <div
                            key={item.id}
                            className="absolute overflow-hidden rounded-md border border-white/90 bg-white/95 px-2 py-1.5 text-xs shadow-sm ring-1 ring-slate-200/80 transition hover:z-10 hover:-translate-y-0.5 hover:shadow-md"
                            style={{
                              top: `${timetableTop(item.startTime)}%`,
                              height: `${timetableHeight(item.startTime, item.endTime)}%`,
                              left: `${4 + layout.lane * columnWidth}%`,
                              width: `${columnWidth}%`,
                              minHeight: 42,
                            }}
                          >
                            <p className="text-[11px] font-bold leading-3 text-slate-700">
                              {item.startTime} - {item.endTime}
                            </p>
                            <p className={`mt-0.5 truncate text-xs font-black leading-4 ${textColorForClass(item.courseClass.name)}`}>
                              {item.courseClass.name}
                            </p>
                            <p className="truncate text-[10px] font-medium leading-3 text-slate-600">
                              {mainTeacher}
                            </p>
                          </div>
                        );
                      })}
                      {!items.length ? (
                        <p className="absolute left-3 right-3 top-14 rounded-md border border-dashed border-slate-200 bg-white/75 px-2 py-3 text-center text-xs text-slate-400">
                          Trống
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
