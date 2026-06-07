import {
  importScoresAction,
  saveScoresAction,
  uploadExamAttachmentAction,
} from "@/app/actions";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth";
import { canAccessClass } from "@/lib/data-scope";
import { formatDate } from "@/lib/format";
import { examTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type ScoresPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    saved?: string;
    imported?: string;
    skipped?: string;
    missing?: string;
    uploaded?: string;
    importError?: string;
    error?: string;
    errors?: string;
  }>;
};

export default async function ScoresPage({ params, searchParams }: ScoresPageProps) {
  const session = await requirePermission("score.view");
  const { id } = await params;
  const qs = await searchParams;
  const rowErrors = qs?.errors
    ? decodeURIComponent(qs.errors).split("||").filter(Boolean)
    : [];
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      courseClass: {
        include: {
          students: {
            where: { status: "ACTIVE" },
            include: { student: true },
            orderBy: { student: { fullName: "asc" } },
          },
        },
      },
      scores: true,
      attachments: {
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (!exam) {
    return null;
  }

  if (!(await canAccessClass(session, exam.classId, "score.view"))) {
    redirect("/forbidden");
  }

  const scoreByStudent = new Map(exam.scores.map((score) => [score.studentId, score]));
  const saveScores = saveScoresAction.bind(null, id);
  const importScores = importScoresAction.bind(null, id);
  const uploadAttachment = uploadExamAttachmentAction.bind(null, id);

  return (
    <AppShell session={session}>
      <PageHeader
        title={exam.name}
        description={`${exam.courseClass.name} · ${examTypeLabels[exam.examType]} · ${formatDate(exam.examDate)}`}
        action={
          <a
            href="/exams"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Quay lại
          </a>
        }
      />
      {qs?.saved ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã lưu điểm.
        </div>
      ) : null}
      {qs?.imported || qs?.uploaded || qs?.error || qs?.importError ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {qs.error || qs.importError
            ? "Có lỗi khi xử lý file. Vui lòng kiểm tra đúng mẫu Excel và thử lại."
            : qs.uploaded
              ? "Đã tải file đính kèm."
              : `Đã import ${qs.imported ?? 0} dòng điểm, bỏ qua ${qs.skipped ?? 0} dòng, không tìm thấy ${qs.missing ?? 0} dòng.`}
        </div>
      ) : null}
      {rowErrors.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">Các dòng cần kiểm tra lại:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {rowErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {can(session, "score.manage") ? (
        <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <form
            action={importScores}
            className="rounded-lg border border-yellow-200 bg-[#fff8d7] p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Import điểm từ Excel</h2>
              <a
                href={`/exams/${id}/scores/template`}
                className="text-sm font-medium text-[#17215c] underline-offset-4 hover:underline"
              >
                Tải mẫu
              </a>
            </div>
            <input
              name="file"
              type="file"
              accept=".xlsx,.xls"
              required
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input name="overwrite" type="checkbox" className="h-4 w-4" />
              Ghi đè điểm đã có
            </label>
            <button
              type="submit"
              className="mt-3 h-10 w-full rounded-md bg-[#17215c] text-sm font-medium text-white hover:bg-[#25308d]"
            >
              Import điểm
            </button>
          </form>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">File đính kèm bài kiểm tra</h2>
            <div className="space-y-2">
              {exam.attachments.map((file) => (
                <a
                  key={file.id}
                  href={file.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-[#17215c] hover:bg-zinc-50"
                >
                  {file.fileName}
                </a>
              ))}
              {!exam.attachments.length ? (
                <p className="text-sm text-zinc-500">Chưa có file đính kèm.</p>
              ) : null}
            </div>
            <form action={uploadAttachment} className="mt-4 space-y-3">
              <input
                name="file"
                type="file"
                required
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="h-10 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Tải file lên
              </button>
            </form>
          </div>
        </section>
      ) : null}
      <form
        action={saveScores}
        className="rounded-lg border border-zinc-200 bg-white shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Học viên</th>
                <th className="px-4 py-3 font-medium">Điểm</th>
                <th className="px-4 py-3 font-medium">Nhận xét bài làm</th>
                <th className="px-4 py-3 font-medium">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {exam.courseClass.students.map((enrollment) => {
                const score = scoreByStudent.get(enrollment.studentId);

                return (
                  <tr key={enrollment.id}>
                    <td className="px-4 py-4 font-medium">
                      {enrollment.student.fullName}
                    </td>
                    <td className="px-4 py-4">
                      <input
                        name={`score:${enrollment.studentId}`}
                        defaultValue={score?.score.toString() ?? ""}
                        disabled={!can(session, "score.manage")}
                        type="number"
                        step="0.25"
                        min="0"
                        max={exam.maxScore.toString()}
                        className="h-10 w-28 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500 disabled:bg-zinc-100"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <input
                        name={`comment:${enrollment.studentId}`}
                        defaultValue={score?.comment ?? ""}
                        disabled={!can(session, "score.manage")}
                        className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500 disabled:bg-zinc-100"
                      />
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {score ? formatDate(score.updatedAt) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {can(session, "score.manage") ? (
          <div className="flex justify-end border-t border-zinc-200 p-4">
            <button
              type="submit"
              className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Lưu bảng điểm
            </button>
          </div>
        ) : null}
      </form>
    </AppShell>
  );
}
