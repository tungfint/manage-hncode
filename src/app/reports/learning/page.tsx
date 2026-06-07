import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function LearningReportPage() {
  const session = await requirePermission("report.learning.view");
  const [students, classes, sessions, presentCount, scoreCount] =
    await Promise.all([
      prisma.student.count({ where: { status: "STUDYING" } }),
      prisma.courseClass.count({ where: { status: "ACTIVE" } }),
      prisma.classSession.count({ where: { status: "COMPLETED" } }),
      prisma.attendance.count({ where: { status: "PRESENT" } }),
      prisma.score.count(),
    ]);

  const cards = [
    ["Học viên đang học", students],
    ["Lớp đang học", classes],
    ["Buổi đã hoàn tất", sessions],
    ["Lượt có mặt", presentCount],
    ["Điểm đã nhập", scoreCount],
  ];

  return (
    <AppShell session={session}>
      <PageHeader
        title="Báo cáo học tập"
        description="Số liệu cơ bản về chuyên cần, lớp học và điểm số."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
