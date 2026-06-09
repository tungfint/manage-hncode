import { Plus } from "lucide-react";
import Link from "next/link";
import { deleteStudentAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SelectAllCheckboxes } from "@/components/select-all-checkboxes";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilter } from "@/components/ui/search-filter";
import { can, requirePermission } from "@/lib/auth";
import { getAccessibleStudentIds } from "@/lib/data-scope";
import { formatDate, toInt, toSearch } from "@/lib/format";
import { genderLabels, studentStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const pageSize = 10;

type StudentsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    clubClass?: string;
    page?: string;
    created?: string;
    updated?: string;
    deleted?: string;
  }>;
};

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const session = await requirePermission("student.view");
  const params = await searchParams;
  const q = toSearch(params?.q);
  const status = toSearch(params?.status);
  const clubClass = toSearch(params?.clubClass);
  const page = toInt(params?.page);
  const accessibleStudentIds = await getAccessibleStudentIds(session);
  const filters = {
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { hncodeAccount: { contains: q, mode: "insensitive" as const } },
            { school: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status: status as never } : {}),
    ...(clubClass ? { clubClass: { contains: clubClass, mode: "insensitive" as const } } : {}),
  };
  const where = {
    AND: [
      ...(accessibleStudentIds ? [{ id: { in: accessibleStudentIds } }] : []),
      filters,
    ],
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        parents: {
          include: {
            parent: true,
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            courseClass: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.student.count({ where }),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Há»c viÃªn"
        description="Quáº£n lÃ½ há»“ sÆ¡ há»c viÃªn, phá»¥ huynh liÃªn há»‡ vÃ  lá»›p Ä‘ang há»c."
        action={
          <div className="flex flex-wrap gap-2">
            <SelectAllCheckboxes
              group="students"
              className="inline-flex h-10 items-center rounded-md border border-yellow-300 bg-[#fff0a6] px-4 text-sm font-semibold text-[#17215c] hover:bg-[#ffe986]"
            />
            {can(session, "student.create") ? (
              <>
                <Link
                  href="/students/import"
                  className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
                >
                  Import Excel
                </Link>
                <Link
                  href="/students/new"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
                >
                  <Plus size={17} aria-hidden="true" />
                  Thêm học viên
                </Link>
              </>
            ) : null}
          </div>
        }
      />

      {params?.created ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          ÄÃ£ thÃªm há»c viÃªn má»›i.
        </div>
      ) : null}
      {params?.updated ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          ÄÃ£ cáº­p nháº­t há»c viÃªn.
        </div>
      ) : null}
      {params?.deleted ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          ÄÃ£ xÃ³a há»c viÃªn.
        </div>
      ) : null}

      <SearchFilter
        q={q}
        status={status}
        placeholder="TÃ¬m theo tÃªn, SÄT, email, tÃ i khoáº£n HNCode"
        statusOptions={Object.entries(studentStatusLabels).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <form className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <input type="hidden" name="q" value={q} />
        <input type="hidden" name="status" value={status} />
        <label className="min-w-64 flex-1">
          <span className="text-xs font-medium text-slate-500">Lá»c theo lá»›p á»Ÿ CLB</span>
          <input
            name="clubClass"
            defaultValue={clubClass}
            placeholder="VÃ­ dá»¥: Python Kids K01"
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <button
          type="submit"
          className="mt-5 h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
        >
          Lá»c
        </button>
      </form>

      {students.length ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="w-12 px-4 py-3 font-medium">Chọn</th>
                <th className="px-4 py-3 font-medium">Há»c viÃªn</th>
                <th className="px-4 py-3 font-medium">Email / HNCode</th>
                <th className="px-4 py-3 font-medium">TrÆ°á»ng / lá»›p</th>
                <th className="px-4 py-3 font-medium">Lá»›p á»Ÿ CLB</th>
                <th className="px-4 py-3 font-medium">Phá»¥ huynh</th>
                <th className="px-4 py-3 font-medium">Lá»›p Ä‘ang há»c</th>
                <th className="px-4 py-3 font-medium">Tráº¡ng thÃ¡i</th>
                <th className="px-4 py-3 font-medium">Cáº­p nháº­t</th>
                <th className="px-4 py-3 font-medium">Thao tÃ¡c</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${student.fullName}`}
                      data-select-group="students"
                      className="size-4 rounded border-slate-300 text-[#17215c] focus:ring-[#08a7dc]"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/students/${student.id}/edit`}
                      className="font-medium text-zinc-950 hover:text-[#08a7dc]"
                    >
                      {student.fullName}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {student.gender ? genderLabels[student.gender] : "-"} Â·{" "}
                      {student.phone ?? "ChÆ°a cÃ³ SÄT"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    <p>{student.email ?? "-"}</p>
                    <p className="text-xs text-zinc-500">
                      {student.hncodeAccount ?? "-"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    <p>{student.school ?? "-"}</p>
                    <p className="text-xs text-zinc-500">
                      {student.schoolGrade ?? student.entryLevel ?? "-"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {student.clubClass ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {student.parents
                      .map(
                        (item) =>
                          `${item.parent.fullName}${item.parent.phone ? ` (${item.parent.phone})` : ""}`,
                      )
                      .join(", ") || "-"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {student.enrollments
                      .map((item) => item.courseClass.name)
                      .join(", ") || "-"}
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={student.status === "STUDYING" ? "success" : "warning"}>
                      {studentStatusLabels[student.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {formatDate(student.updatedAt)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {can(session, "student.update") ? (
                        <Link
                          href={`/students/${student.id}/edit`}
                          className="font-medium text-[#08a7dc] hover:text-[#17215c]"
                        >
                          Sá»­a
                        </Link>
                      ) : null}
                      {can(session, "student.delete") ? (
                        <form action={deleteStudentAction.bind(null, student.id)}>
                          <ConfirmSubmitButton
                            message={`XÃ³a há»c viÃªn ${student.fullName}?`}
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
        <EmptyState
          title="ChÆ°a cÃ³ há»c viÃªn phÃ¹ há»£p"
          description="Thá»­ Ä‘á»•i bá»™ lá»c hoáº·c thÃªm há»c viÃªn má»›i náº¿u báº¡n cÃ³ quyá»n."
        />
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/students"
        query={{ q, status, clubClass }}
      />
    </AppShell>
  );
}
