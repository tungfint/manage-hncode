import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { getAccessibleClassIds } from "@/lib/data-scope";
import { formatDate, toSearch } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type ScoreSummaryPageProps = {
  searchParams?: Promise<{
    classId?: string;
    sort?: string;
  }>;
};

function scoreNumber(value: unknown) {
  const parsed = Number(value?.toString?.() ?? value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function ScoreSummaryPage({
  searchParams,
}: ScoreSummaryPageProps) {
  const session = await requirePermission("score.view");
  const params = await searchParams;
  const requestedClassId = toSearch(params?.classId);
  const sort = toSearch(params?.sort) || "rank";
  const accessibleClassIds = await getAccessibleClassIds(session, "score.view");
  const classes = await prisma.courseClass.findMany({
    where: accessibleClassIds ? { id: { in: accessibleClassIds } } : {},
    orderBy: { name: "asc" },
  });
  const selectedClassId =
    classes.find((item) => item.id === requestedClassId)?.id ?? classes[0]?.id ?? "";

  const [exams, enrollments] = selectedClassId
    ? await Promise.all([
        prisma.exam.findMany({
          where: { classId: selectedClassId },
          orderBy: { examDate: "asc" },
        }),
        prisma.classStudent.findMany({
          where: { classId: selectedClassId, status: "ACTIVE" },
          include: {
            student: {
              include: {
                scores: {
                  where: {
                    exam: { classId: selectedClassId },
                  },
                  include: { exam: true },
                },
              },
            },
          },
          orderBy: { student: { fullName: "asc" } },
        }),
      ])
    : [[], []];

  const rows = enrollments.map((enrollment) => {
    const scoreByExam = new Map(
      enrollment.student.scores.map((score) => [score.examId, score]),
    );
    const values = exams
      .map((exam) => scoreByExam.get(exam.id))
      .filter(Boolean)
      .map((score) => scoreNumber(score?.score));
    const total = values.reduce((sum, value) => sum + value, 0);
    const average = values.length ? total / values.length : 0;
    const latestScore = enrollment.student.scores
      .slice()
      .sort((a, b) => b.exam.examDate.getTime() - a.exam.examDate.getTime())[0];

    return {
      enrollment,
      scoreByExam,
      total,
      average,
      latest: latestScore ? scoreNumber(latestScore.score) : 0,
    };
  });

  rows.sort((a, b) => {
    if (sort === "name") {
      return a.enrollment.student.fullName.localeCompare(b.enrollment.student.fullName);
    }

    if (sort === "latest") {
      return b.latest - a.latest;
    }

    if (sort.startsWith("exam:")) {
      const examId = sort.slice(5);
      return (
        scoreNumber(b.scoreByExam.get(examId)?.score) -
        scoreNumber(a.scoreByExam.get(examId)?.score)
      );
    }

    if (sort === "total") {
      return b.total - a.total;
    }

    return b.average - a.average;
  });

  return (
    <AppShell session={session}>
      <PageHeader
        title="Tổng hợp điểm"
        description="Xem tiến bộ học viên qua nhiều bài kiểm tra trong cùng một lớp."
        action={
          <Link
            href="/exams"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Quay lại
          </Link>
        }
      />
      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_1fr_auto]">
        <select
          name="classId"
          defaultValue={selectedClassId}
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        >
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
        >
          <option value="rank">Xếp hạng theo điểm trung bình</option>
          <option value="total">Xếp hạng theo tổng điểm</option>
          <option value="latest">Xếp hạng theo điểm gần nhất</option>
          <option value="name">Sắp xếp theo tên</option>
          {exams.map((exam) => (
            <option key={exam.id} value={`exam:${exam.id}`}>
              Sắp xếp theo {exam.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
        >
          Xem
        </button>
      </form>
      {selectedClassId && exams.length ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Hạng</th>
                <th className="px-4 py-3 font-medium">Học viên</th>
                {exams.map((exam) => (
                  <th key={exam.id} className="px-4 py-3 font-medium">
                    <Link
                      href={`/exams/summary?classId=${selectedClassId}&sort=exam:${exam.id}`}
                      className="hover:text-[#08a7dc]"
                    >
                      {exam.name}
                    </Link>
                    <span className="block text-xs font-normal text-zinc-400">
                      {formatDate(exam.examDate)}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 font-medium">Tổng</th>
                <th className="px-4 py-3 font-medium">Trung bình</th>
                <th className="px-4 py-3 font-medium">Gần nhất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row, index) => (
                <tr key={row.enrollment.id}>
                  <td className="px-4 py-4">
                    <Badge tone={index < 3 ? "success" : "default"}>#{index + 1}</Badge>
                  </td>
                  <td className="px-4 py-4 font-medium">
                    {row.enrollment.student.fullName}
                  </td>
                  {exams.map((exam) => (
                    <td key={exam.id} className="px-4 py-4 text-zinc-600">
                      {row.scoreByExam.get(exam.id)?.score.toString() ?? "-"}
                    </td>
                  ))}
                  <td className="px-4 py-4 font-medium">{row.total.toFixed(2)}</td>
                  <td className="px-4 py-4 font-medium">{row.average.toFixed(2)}</td>
                  <td className="px-4 py-4 font-medium">{row.latest || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Chưa có dữ liệu điểm phù hợp" />
      )}
    </AppShell>
  );
}
