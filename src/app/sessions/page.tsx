import { refreshUpcomingSessionsAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilter } from "@/components/ui/search-filter";
import { can, requirePermission } from "@/lib/auth";
import { getAccessibleClassIds } from "@/lib/data-scope";
import { formatDate, toInt, toSearch } from "@/lib/format";
import { sessionStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { ensureUpcomingSessions } from "@/lib/sessions";

const pageSize = 20;

function dateKey(value: Date) {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

type SessionsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    page?: string;
    sessionsUpdated?: string;
  }>;
};

export default async function SessionsPage({ searchParams }: SessionsPageProps) {
  const session = await requirePermission("session.view");
  await ensureUpcomingSessions(14);
  const params = await searchParams;
  const q = toSearch(params?.q);
  const status = toSearch(params?.status);
  const page = toInt(params?.page);
  const accessibleClassIds = await getAccessibleClassIds(session, "session.view");
  const where = {
    AND: [
      ...(accessibleClassIds ? [{ classId: { in: accessibleClassIds } }] : []),
      {
      ...(q
        ? {
            courseClass: {
              name: { contains: q, mode: "insensitive" as const },
            },
          }
        : {}),
      ...(status ? { status: status as never } : {}),
      },
    ],
  };
  const [sessions, total] = await Promise.all([
    prisma.classSession.findMany({
      where,
    include: {
      courseClass: true,
      room: true,
      teachers: { include: { teacher: true } },
    },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.classSession.count({ where }),
  ]);
  const todayKey = dateKey(new Date());

  return (
    <AppShell session={session}>
      <PageHeader
        title="Buổi học"
        description="Mở nhanh buổi học để điểm danh, ghi nội dung và nhận xét."
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
      <SearchFilter
        q={q}
        status={status}
        placeholder="Tìm theo tên lớp"
        statusOptions={Object.entries(sessionStatusLabels).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Ngày</th>
              <th className="px-4 py-3 font-medium">Giờ</th>
              <th className="px-4 py-3 font-medium">Lớp</th>
              <th className="px-4 py-3 font-medium">Giáo viên</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sessions.map((item) => {
              const isToday = dateKey(item.sessionDate) === todayKey;

              return (
              <tr
                key={item.id}
                className={
                  isToday
                    ? "border-l-4 border-l-[#08a7dc] bg-[#fff8d7]"
                    : "hover:bg-slate-50"
                }
              >
                <td className="px-4 py-4 font-medium">
                  <div className="flex items-center gap-2">
                    <span>{formatDate(item.sessionDate)}</span>
                    {isToday ? (
                      <span className="rounded-full bg-[#17215c] px-2 py-0.5 text-[11px] font-semibold text-white">
                        Hôm nay
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {item.startTime} - {item.endTime}
                </td>
                <td className="px-4 py-4">{item.courseClass.name}</td>
                <td className="px-4 py-4 text-zinc-600">
                  {item.teachers.map((teacher) => teacher.teacher.name).join(", ") || "-"}
                </td>
                <td className="px-4 py-4">
                  <Badge tone={item.status === "COMPLETED" ? "success" : "warning"}>
                    {sessionStatusLabels[item.status]}
                  </Badge>
                </td>
                <td className="px-4 py-4">
                  <a
                    href={`/sessions/${item.id}/attendance`}
                    className="font-medium text-teal-700 hover:text-teal-800"
                  >
                    Mở
                  </a>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/sessions"
        query={{ q, status }}
      />
    </AppShell>
  );
}
