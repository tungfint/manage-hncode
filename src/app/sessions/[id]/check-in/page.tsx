import { submitAutoAttendanceCodeAction } from "@/app/actions";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionOrRedirect } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type CheckInPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    autoError?: string;
    autoStatus?: string;
  }>;
};

export default async function CheckInPage({
  params,
  searchParams,
}: CheckInPageProps) {
  const session = await getSessionOrRedirect();
  const { id } = await params;
  const qs = await searchParams;
  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { id: true, fullName: true },
  });

  if (!student) {
    redirect("/forbidden");
  }

  const classSession = await prisma.classSession.findUnique({
    where: { id },
    include: {
      courseClass: {
        include: {
          students: {
            where: { studentId: student.id, status: "ACTIVE" },
            select: { id: true },
          },
        },
      },
      attendances: {
        where: { studentId: student.id },
        select: { id: true, status: true, markedAt: true },
      },
      autoRounds: {
        orderBy: { startedAt: "desc" },
        take: 8,
        include: {
          attempts: {
            where: { accepted: true },
            include: { student: { select: { id: true, fullName: true } } },
            orderBy: { submittedAt: "asc" },
          },
        },
      },
    },
  });

  if (!classSession || !classSession.courseClass.students.length) {
    redirect("/forbidden");
  }

  const submitCode = submitAutoAttendanceCodeAction.bind(null, id);
  const activeRound = classSession.autoRounds.find(
    (round) => round.status === "ACTIVE",
  );
  const ranking = classSession.autoRounds
    .flatMap((round) => round.attempts)
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  const attendance = classSession.attendances[0];
  const isAlreadyPresent = attendance
    ? ["PRESENT", "LATE", "LEFT_EARLY", "MAKEUP"].includes(attendance.status)
    : false;

  return (
    <AppShell session={session}>
      {activeRound ? <AutoRefresh intervalMs={2000} /> : null}
      <PageHeader
        title="Điểm danh tự động"
        description={`${classSession.courseClass.name} · ${formatDate(classSession.sessionDate)} · ${classSession.startTime} - ${classSession.endTime}`}
        action={
          <a
            href="/sessions"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Quay lại
          </a>
        }
      />

      {qs?.autoError === "code" ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Mã chưa đúng, em thử nhập lại nhé.
        </div>
      ) : null}
      {qs?.autoError === "no_round" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Chưa có vòng điểm danh nào đang chạy.
        </div>
      ) : null}
      {qs?.autoError === "busy" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Nhiều bạn gửi cùng lúc, em bấm gửi lại ngay nhé.
        </div>
      ) : null}
      {qs?.autoStatus === "accepted" ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Điểm danh thành công.
        </div>
      ) : null}
      {qs?.autoStatus === "already" || isAlreadyPresent ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Em đã được ghi nhận điểm danh.
        </div>
      ) : null}
      {qs?.autoStatus === "full" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Vòng này đã đủ số lượng học viên.
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-cyan-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_55%,#fff8d7_100%)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Học viên</p>
              <h2 className="text-xl font-semibold text-[#17215c]">
                {student.fullName}
              </h2>
            </div>
            <Badge tone={activeRound ? "success" : "warning"}>
              {activeRound ? "Đang chạy" : "Đang chờ"}
            </Badge>
          </div>

          {activeRound ? (
            <>
              <p className="mt-5 text-sm text-slate-500">Mã cần nhập</p>
              <p className="mt-2 select-all rounded-md bg-[#17215c] px-4 py-4 text-center text-5xl font-black tracking-[0.28em] text-white">
                {activeRound.code}
              </p>
              {!isAlreadyPresent ? (
                <form action={submitCode} className="mt-4">
                  <input
                    name="code"
                    autoFocus
                    autoComplete="off"
                    placeholder="Nhập mã rồi Enter"
                    className="h-12 w-full rounded-md border border-slate-200 px-4 text-center text-lg font-bold uppercase tracking-[0.18em] outline-none focus:border-[#08a7dc] focus:ring-2 focus:ring-[#08a7dc]/15"
                  />
                  <button
                    type="submit"
                    className="mt-3 h-11 w-full rounded-md bg-[#17215c] text-sm font-medium text-white hover:bg-[#25308d]"
                  >
                    Gửi mã
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <div className="mt-5 rounded-md border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Chờ giáo viên bật vòng điểm danh tự động.
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-[#17215c]">Bảng xếp hạng</h2>
          <div className="mt-4 space-y-2">
            {ranking.map((attempt, index) => (
              <div
                key={attempt.id}
                className={[
                  "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                  attempt.studentId === student.id
                    ? "border-yellow-200 bg-[#fff8d7]"
                    : "border-slate-100",
                ].join(" ")}
              >
                <span className="font-medium">
                  #{index + 1} {attempt.student.fullName}
                </span>
                <span className="text-xs text-slate-500">
                  {formatDateTime(attempt.submittedAt)}
                </span>
              </div>
            ))}
            {!ranking.length ? (
              <p className="rounded-md border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
                Chưa có bạn nào điểm danh thành công.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
