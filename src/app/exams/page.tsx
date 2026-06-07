import { createExamAction } from "@/app/actions";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilter } from "@/components/ui/search-filter";
import { can, requirePermission } from "@/lib/auth";
import { getAccessibleClassIds } from "@/lib/data-scope";
import { formatDate, toInt, toSearch } from "@/lib/format";
import { examTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const pageSize = 20;

type ExamsPageProps = {
  searchParams?: Promise<{ q?: string; classId?: string; page?: string; created?: string }>;
};

export default async function ExamsPage({ searchParams }: ExamsPageProps) {
  const session = await requirePermission("exam.view");
  const params = await searchParams;
  const q = toSearch(params?.q);
  const classId = toSearch(params?.classId);
  const page = toInt(params?.page);
  const accessibleClassIds = await getAccessibleClassIds(session, "exam.view");
  const classWhere = accessibleClassIds ? { id: { in: accessibleClassIds } } : {};
  const examWhere = {
    AND: [
      accessibleClassIds ? { classId: { in: accessibleClassIds } } : {},
      classId ? { classId } : {},
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              {
                courseClass: {
                  name: { contains: q, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {},
    ],
  };
  const [exams, total, classes] = await Promise.all([
    prisma.exam.findMany({
      where: examWhere,
      include: {
        courseClass: true,
        scores: true,
      },
      orderBy: { examDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.exam.count({ where: examWhere }),
    prisma.courseClass.findMany({ where: classWhere, orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Kiểm tra & điểm số"
        description="Tạo bài kiểm tra và nhập điểm hàng loạt theo lớp."
        action={
          <Link
            href="/exams/summary"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Tổng hợp điểm
          </Link>
        }
      />
      {params?.created ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã tạo bài kiểm tra.
        </div>
      ) : null}

      <SearchFilter q={q} placeholder="Tìm theo tên bài kiểm tra hoặc lớp" />
      <form className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <input type="hidden" name="q" value={q} />
        <select
          name="classId"
          defaultValue={classId}
          className="h-10 min-w-64 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        >
          <option value="">Tất cả lớp</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
        >
          Lọc
        </button>
      </form>

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Bài kiểm tra</th>
                <th className="px-4 py-3 font-medium">Lớp</th>
                <th className="px-4 py-3 font-medium">Ngày</th>
                <th className="px-4 py-3 font-medium">Loại</th>
                <th className="px-4 py-3 font-medium">Điểm đã nhập</th>
                <th className="px-4 py-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <td className="px-4 py-4">
                    <p className="font-medium">{exam.name}</p>
                    <p className="text-xs text-zinc-500">
                      Thang điểm {exam.maxScore.toString()}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {exam.courseClass.name}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {formatDate(exam.examDate)}
                  </td>
                  <td className="px-4 py-4">
                    <Badge>{examTypeLabels[exam.examType]}</Badge>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">{exam.scores.length}</td>
                  <td className="px-4 py-4">
                    <a
                      href={`/exams/${exam.id}/scores`}
                      className="font-medium text-teal-700 hover:text-teal-800"
                    >
                      Nhập điểm
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
          basePath="/exams"
          query={{ q, classId }}
        />
        </div>

        {can(session, "exam.manage") ? (
          <form
            action={createExamAction}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <h2 className="mb-4 font-semibold">Tạo bài kiểm tra</h2>
            <div className="space-y-3">
              <select
                name="classId"
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                name="name"
                required
                placeholder="Tên bài kiểm tra"
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="examDate"
                  type="date"
                  required
                  className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                />
                <select
                  name="examType"
                  className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                >
                  {Object.entries(examTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                name="maxScore"
                type="number"
                step="0.25"
                defaultValue="10"
                required
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <textarea
                name="description"
                rows={4}
                placeholder="Mô tả"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                className="h-10 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Tạo bài kiểm tra
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </AppShell>
  );
}
