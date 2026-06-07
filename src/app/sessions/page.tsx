import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilter } from "@/components/ui/search-filter";
import { requirePermission } from "@/lib/auth";
import { getAccessibleClassIds } from "@/lib/data-scope";
import { formatDate, toInt, toSearch } from "@/lib/format";
import { sessionStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { ensureUpcomingSessions } from "@/lib/sessions";

const pageSize = 20;

type SessionsPageProps = {
  searchParams?: Promise<{ q?: string; status?: string; page?: string }>;
};

export default async function SessionsPage({ searchParams }: SessionsPageProps) {
  const session = await requirePermission("session.view");
  await ensureUpcomingSessions(7);
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
    orderBy: [{ sessionDate: "desc" }, { startTime: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.classSession.count({ where }),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Buổi học"
        description="Mở nhanh buổi học để điểm danh, ghi nội dung và nhận xét."
      />
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
            {sessions.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-4 font-medium">
                  {formatDate(item.sessionDate)}
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
            ))}
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
