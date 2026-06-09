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
            { classCode: { contains: q, mode: "insensitive" as const } },
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
        title="Lá»›p há»c"
        description="Theo dÃµi sÄ© sá»‘, mÃ£ lá»›p, giÃ¡o viÃªn, lá»‹ch há»c vÃ  tráº¡ng thÃ¡i tá»«ng lá»›p."
        action={
          can(session, "class.create") ? (
            <Link
              href="/classes/new"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              <Plus size={17} aria-hidden="true" />
              Táº¡o lá»›p
            </Link>
          ) : null
        }
      />

      {params?.created ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          ÄÃ£ táº¡o lá»›p má»›i.
        </div>
      ) : null}
      {params?.deleted ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          ÄÃ£ xÃ³a lá»›p há»c.
        </div>
      ) : null}

      <SearchFilter
        q={q}
        status={status}
        placeholder="TÃ¬m theo mÃ£ lá»›p, tÃªn lá»›p, mÃ´n há»c, cáº¥p Ä‘á»™"
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
                <th className="px-4 py-3 font-bold text-[#17215c]">Lớp</th>
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
                    <Link
                      href={`/classes/${item.id}`}
                      className="group block rounded-md border border-cyan-100 bg-cyan-50/70 px-3 py-2 transition hover:border-cyan-300 hover:bg-cyan-100"
                    >
                      <p className="font-bold text-[#17215c] group-hover:text-[#08a7dc]">
                        {item.name}
                      </p>
                      <p className="mt-1 inline-flex rounded bg-white px-2 py-0.5 text-xs font-semibold text-[#17215c]">
                        {item.classCode}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {item.subject ?? "-"} · {item.level ?? "-"} · {" "}
                        {formatDate(item.startDate)}
                      </p>
                    </Link>
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
                        Chi tiáº¿t
                      </Link>
                      {can(session, "class.update") ? (
                        <Link
                          href={`/classes/${item.id}/edit`}
                          className="font-medium text-[#08a7dc] hover:text-[#17215c]"
                        >
                          Sá»­a
                        </Link>
                      ) : null}
                      {can(session, "class.delete") ? (
                        <form action={deleteClassAction.bind(null, item.id)}>
                          <ConfirmSubmitButton
                            message={`XÃ³a lá»›p ${item.name}? CÃ¡c buá»•i há»c/lá»‹ch há»c liÃªn quan cÅ©ng sáº½ bá»‹ xÃ³a.`}
                            className="font-medium text-rose-700 hover:text-rose-800"
                          >
                            XÃ³a
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
        <EmptyState title="ChÆ°a cÃ³ lá»›p phÃ¹ há»£p" />
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
