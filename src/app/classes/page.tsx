import { Plus } from "lucide-react";
import Link from "next/link";
import { deleteClassAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilter } from "@/components/ui/search-filter";
import { can, requirePermission } from "@/lib/auth";
import { getAccessibleClassIds } from "@/lib/data-scope";
import { formatDate, toInt, toSearch } from "@/lib/format";
import { classStatusLabels, teacherRoleLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const pageSize = 10;

type ClassesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    page?: string;
    created?: string;
    deleted?: string;
  }>;
};

export default async function ClassesPage({ searchParams }: ClassesPageProps) {
  const session = await requirePermission("class.view");
  const params = await searchParams;
  const q = toSearch(params?.q);
  const status = toSearch(params?.status);
  const page = toInt(params?.page);
  const accessibleClassIds = await getAccessibleClassIds(session);
  const filters = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { subject: { contains: q, mode: "insensitive" as const } },
            { level: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status: status as never } : {}),
  };
  const where = {
    AND: [
      ...(accessibleClassIds ? [{ id: { in: accessibleClassIds } }] : []),
      filters,
    ],
  };

  const [classes, total] = await Promise.all([
    prisma.courseClass.findMany({
      where,
      include: {
        branch: true,
        room: true,
        students: { where: { status: "ACTIVE" } },
        sessions: { where: { status: "COMPLETED" }, select: { id: true } },
        teachers: {
          where: { status: "ACTIVE" },
          include: { teacher: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.courseClass.count({ where }),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Lớp học"
        description="Theo dõi sĩ số, giáo viên, lịch học và trạng thái từng lớp."
        action={
          can(session, "class.create") ? (
            <Link
              href="/classes/new"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              <Plus size={17} aria-hidden="true" />
              Tạo lớp
            </Link>
          ) : null
        }
      />

      {params?.created ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã tạo lớp mới.
        </div>
      ) : null}
      {params?.deleted ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã xóa lớp học.
        </div>
      ) : null}

      <SearchFilter
        q={q}
        status={status}
        placeholder="Tìm theo tên lớp, môn học, cấp độ"
        statusOptions={Object.entries(classStatusLabels).map(([value, label]) => ({
          value,
          label,
        }))}
      />

      {classes.length ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Lớp</th>
                <th className="px-4 py-3 font-medium">Cơ sở / phòng</th>
                <th className="px-4 py-3 font-medium">Giáo viên</th>
                <th className="px-4 py-3 font-medium">Sĩ số</th>
                <th className="px-4 py-3 font-medium">Số buổi đã học</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {classes.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-zinc-500">
                      {item.subject ?? "-"} · {item.level ?? "-"} ·{" "}
                      {formatDate(item.startDate)}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    <p>{item.branch?.name ?? "-"}</p>
                    <p className="text-xs text-zinc-500">{item.room?.name ?? "-"}</p>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.teachers
                      .map(
                        (teacher) =>
                          `${teacher.teacher.name} (${teacherRoleLabels[teacher.teacherRole]})`,
                      )
                      .join(", ") || "-"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.students.length}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.sessions.length}/{item.totalSessions ?? "-"}
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={item.status === "ACTIVE" ? "success" : "warning"}>
                      {classStatusLabels[item.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/classes/${item.id}`}
                        className="font-medium text-[#08a7dc] hover:text-[#17215c]"
                      >
                        Chi tiết
                      </Link>
                      {can(session, "class.update") ? (
                        <Link
                          href={`/classes/${item.id}/edit`}
                          className="font-medium text-[#08a7dc] hover:text-[#17215c]"
                        >
                          Sửa
                        </Link>
                      ) : null}
                      {can(session, "class.delete") ? (
                        <form action={deleteClassAction.bind(null, item.id)}>
                          <ConfirmSubmitButton
                            message={`Xóa lớp ${item.name}? Các buổi học/lịch học liên quan cũng sẽ bị xóa.`}
                            className="font-medium text-rose-700 hover:text-rose-800"
                          >
                            Xóa
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Chưa có lớp phù hợp" />
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/classes"
        query={{ q, status }}
      />
    </AppShell>
  );
}
