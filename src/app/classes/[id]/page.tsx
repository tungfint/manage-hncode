import {
  assignTeacherAction,
  createScheduleAction,
  createSessionAction,
  deleteScheduleAction,
  deleteSessionAction,
  enrollStudentAction,
  enrollStudentsByEmailAction,
  previewEnrollStudentsByEmailAction,
  removeStudentFromClassAction,
  removeTeacherFromClassAction,
  updateScheduleAction,
} from "@/app/actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth";
import { canAccessClass } from "@/lib/data-scope";
import { formatDate } from "@/lib/format";
import {
  classStatusLabels,
  enrollmentStatusLabels,
  sessionStatusLabels,
  teacherRoleLabels,
} from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const dayLabels = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

type ClassDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    emailAdded?: string;
    emailMissing?: string;
    emailDuplicated?: string;
    emailError?: string;
    emailPreview?: string;
    previewEmails?: string;
    emailFound?: string;
    emailFoundNames?: string;
    emailMissingList?: string;
  }>;
};

export default async function ClassDetailPage({
  params,
  searchParams,
}: ClassDetailPageProps) {
  const session = await requirePermission("class.view");
  const { id } = await params;
  const query = await searchParams;

  if (!(await canAccessClass(session, id, "class.view"))) {
    redirect("/forbidden");
  }

  const courseClass = await prisma.courseClass.findUnique({
    where: { id },
    include: {
      branch: true,
      room: true,
      students: {
        include: {
          student: {
            include: {
              attendances: {
                where: {
                  session: { classId: id },
                  status: { in: ["PRESENT", "LATE", "LEFT_EARLY", "MAKEUP"] },
                },
                select: { id: true },
              },
              scores: {
                where: { exam: { classId: id } },
                include: { exam: true },
                orderBy: { updatedAt: "desc" },
              },
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      },
      teachers: {
        include: { teacher: true },
        orderBy: { assignedAt: "desc" },
      },
      schedules: {
        include: { room: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
      sessions: {
        include: { room: true },
        orderBy: { sessionDate: "desc" },
        take: 8,
      },
    },
  });

  if (!courseClass) {
    return null;
  }

  const latestScoreRanks = new Map(
    courseClass.students
      .map((item) => ({
        studentId: item.studentId,
        score: Number(item.student.scores[0]?.score.toString() ?? 0),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item, index) => [item.studentId, index + 1]),
  );

  const [students, teachers, rooms] = await Promise.all([
    prisma.student.findMany({ orderBy: { fullName: "asc" } }),
    prisma.user.findMany({
      where: {
        staffProfile: {
          staffType: {
            in: ["TEACHER_MAIN", "TEACHER_ASSISTANT"],
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.room.findMany({ include: { branch: true }, orderBy: { name: "asc" } }),
  ]);

  const enrollAction = enrollStudentAction.bind(null, id);
  const enrollByEmailAction = enrollStudentsByEmailAction.bind(null, id);
  const previewEnrollByEmailAction = previewEnrollStudentsByEmailAction.bind(null, id);
  const assignAction = assignTeacherAction.bind(null, id);
  const scheduleAction = createScheduleAction.bind(null, id);
  const sessionAction = createSessionAction.bind(null, id);
  const previewEmails = query?.previewEmails
    ? decodeURIComponent(query.previewEmails)
    : "";
  const previewFoundNames = query?.emailFoundNames
    ? decodeURIComponent(query.emailFoundNames).split("||").filter(Boolean)
    : [];
  const previewMissingEmails = query?.emailMissingList
    ? decodeURIComponent(query.emailMissingList).split("||").filter(Boolean)
    : [];

  return (
    <AppShell session={session}>
      <PageHeader
        title={courseClass.name}
        description={`${courseClass.subject ?? "Môn học"} · ${courseClass.level ?? "Cấp độ"} · ${courseClass.branch?.name ?? "Chưa chọn cơ sở"}`}
        action={
          <div className="flex gap-2">
            {can(session, "class.update") ? (
              <Link
                href={`/classes/${id}/edit`}
                className="inline-flex h-10 items-center rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
              >
                Sửa lớp
              </Link>
            ) : null}
            <Link
              href="/classes"
              className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
            >
              Quay lại
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Trạng thái</p>
          <div className="mt-2">
            <Badge tone={courseClass.status === "ACTIVE" ? "success" : "warning"}>
              {classStatusLabels[courseClass.status]}
            </Badge>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Sĩ số</p>
          <p className="mt-1 text-2xl font-semibold">
            {courseClass.students.filter((item) => item.status === "ACTIVE").length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Tiến độ</p>
          <p className="mt-1 text-2xl font-semibold">
            {courseClass.sessions.filter((item) => item.status === "COMPLETED").length}/
            {courseClass.totalSessions ?? "-"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Giáo viên phụ trách</p>
          <p className="mt-1 text-sm font-medium">
            {courseClass.teachers.map((item) => item.teacher.name).join(", ") || "-"}
          </p>
        </div>
      </section>

      {query?.emailAdded || query?.emailError ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {query.emailError
            ? "Vui lòng nhập ít nhất một email học viên."
            : `Đã thêm ${query.emailAdded ?? 0} học viên, ${query.emailDuplicated ?? 0} email đã có trong lớp, ${query.emailMissing ?? 0} email không tìm thấy.`}
        </div>
      ) : null}

      {query?.emailPreview && previewEmails ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold">
            Kiểm tra email: tìm thấy {query.emailFound ?? 0} học viên có thể thêm,{" "}
            {query.emailDuplicated ?? 0} học viên đã có trong lớp,{" "}
            {query.emailMissing ?? 0} email chưa có hồ sơ.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <p className="font-medium">Có thể thêm</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {previewFoundNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
                {!previewFoundNames.length ? <li>Không có học viên mới.</li> : null}
              </ul>
            </div>
            <div>
              <p className="font-medium">Chưa tìm thấy</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {previewMissingEmails.map((email) => (
                  <li key={email}>{email}</li>
                ))}
                {!previewMissingEmails.length ? <li>Không có email lỗi.</li> : null}
              </ul>
            </div>
          </div>
          <form action={enrollByEmailAction} className="mt-3 flex justify-end">
            <input type="hidden" name="emails" value={previewEmails} />
            <ConfirmSubmitButton
              message="Xác nhận thêm các học viên hợp lệ vào lớp?"
              className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
            >
              Xác nhận thêm
            </ConfirmSubmitButton>
          </form>
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="font-semibold">Học viên trong lớp</h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {courseClass.students.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{item.student.fullName}</p>
                  <p className="text-xs text-zinc-500">
                    Vào lớp: {formatDate(item.joinedAt)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Đã học {item.student.attendances.length} buổi · Điểm gần nhất:{" "}
                    {item.student.scores[0]?.score.toString() ?? "-"} · Xếp hạng:{" "}
                    {latestScoreRanks.get(item.studentId)
                      ? `#${latestScoreRanks.get(item.studentId)}`
                      : "-"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={item.status === "ACTIVE" ? "success" : "warning"}>
                    {enrollmentStatusLabels[item.status]}
                  </Badge>
                  {can(session, "class.update") && item.status === "ACTIVE" ? (
                    <form
                      action={removeStudentFromClassAction.bind(
                        null,
                        id,
                        item.studentId,
                      )}
                    >
                      <ConfirmSubmitButton
                        message={`Xóa ${item.student.fullName} khỏi lớp này? Hồ sơ học viên vẫn được giữ.`}
                        className="h-8 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Xóa
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {can(session, "class.update") ? (
          <div className="space-y-4">
            <form
              action={enrollAction}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <h2 className="mb-4 font-semibold">Thêm học viên vào lớp</h2>
              <select
                name="studentId"
                className="mb-3 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-10 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Thêm vào lớp
              </button>
            </form>
            <form
              action={previewEnrollByEmailAction}
              className="rounded-lg border border-yellow-200 bg-[#fff8d7] p-4 shadow-sm"
            >
              <h2 className="mb-2 font-semibold">Thêm bằng danh sách email</h2>
              <p className="mb-3 text-sm text-slate-600">
                Dán email học viên, cách nhau bằng dòng mới, dấu phẩy hoặc khoảng trắng.
              </p>
              <textarea
                name="emails"
                rows={6}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                className="mt-3 h-10 w-full rounded-md bg-[#17215c] text-sm font-medium text-white hover:bg-[#25308d]"
              >
                Kiểm tra và thêm email hợp lệ
              </button>
            </form>
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-semibold">Giáo viên phụ trách</h2>
          <div className="space-y-3">
            {courseClass.teachers.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3"
              >
                <div>
                  <p className="font-medium">{item.teacher.name}</p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(item.assignedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{teacherRoleLabels[item.teacherRole]}</Badge>
                  {can(session, "class.assign_teacher") && item.status === "ACTIVE" ? (
                    <form
                      action={removeTeacherFromClassAction.bind(null, id, item.id)}
                    >
                      <ConfirmSubmitButton
                        message={`Ngừng phân công ${item.teacher.name} khỏi lớp này?`}
                        className="h-8 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Xóa
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {can(session, "class.assign_teacher") ? (
          <form
            action={assignAction}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <h2 className="mb-4 font-semibold">Phân công giáo viên</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                name="teacherUserId"
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
              <select
                name="teacherRole"
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                {Object.entries(teacherRoleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="mt-3 h-10 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Gán giáo viên
            </button>
          </form>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-semibold">Lịch học cố định</h2>
          <div className="space-y-3">
            {courseClass.schedules.map((item) => (
              <div key={item.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                <p className="font-medium">
                  {dayLabels[item.dayOfWeek]} · {item.startTime} - {item.endTime}
                </p>
                <p className="text-sm text-zinc-500">
                  {item.room?.name ?? "-"} · từ {formatDate(item.startDate)}
                </p>
                  </div>
                  {can(session, "schedule.manage") ? (
                    <form action={deleteScheduleAction.bind(null, id, item.id)}>
                      <ConfirmSubmitButton
                        message="Xóa lịch cố định này? Các buổi đã tạo trước đó vẫn được giữ."
                        className="h-8 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Xóa
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
                {can(session, "schedule.manage") ? (
                  <details className="mt-3 rounded-md bg-zinc-50 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-[#17215c]">
                      Sửa lịch
                    </summary>
                    <form
                      action={updateScheduleAction.bind(null, id, item.id)}
                      className="mt-3 grid gap-3 sm:grid-cols-2"
                    >
                      <select
                        name="dayOfWeek"
                        defaultValue={item.dayOfWeek}
                        className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      >
                        {dayLabels.slice(1).map((label, index) => (
                          <option key={label} value={index + 1}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <select
                        name="roomId"
                        defaultValue={item.roomId ?? ""}
                        className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      >
                        <option value="">Chưa chọn phòng</option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.branch.name} · {room.name}
                          </option>
                        ))}
                      </select>
                      <input
                        name="startTime"
                        type="time"
                        required
                        defaultValue={item.startTime}
                        className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      />
                      <input
                        name="endTime"
                        type="time"
                        required
                        defaultValue={item.endTime}
                        className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      />
                      <input
                        name="startDate"
                        type="date"
                        defaultValue={item.startDate.toISOString().slice(0, 10)}
                        className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      />
                      <input
                        name="endDate"
                        type="date"
                        defaultValue={item.endDate?.toISOString().slice(0, 10) ?? ""}
                        className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      />
                      <select
                        name="futureSessionsMode"
                        defaultValue="KEEP"
                        className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-500 sm:col-span-2"
                      >
                        <option value="KEEP">Giữ nguyên các buổi tương lai đã tạo</option>
                        <option value="UPDATE_TIME_ROOM">
                          Cập nhật giờ/phòng cho buổi tương lai
                        </option>
                        <option value="CANCEL">Hủy các buổi tương lai chưa diễn ra</option>
                      </select>
                      <button
                        type="submit"
                        className="h-10 rounded-md bg-[#17215c] text-sm font-medium text-white hover:bg-[#25308d] sm:col-span-2"
                      >
                        Lưu lịch
                      </button>
                    </form>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {can(session, "schedule.manage") ? (
          <form
            action={scheduleAction}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <h2 className="mb-4 font-semibold">Tạo lịch cố định</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                name="dayOfWeek"
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                {dayLabels.slice(1).map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                name="roomId"
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                <option value="">Chưa chọn phòng</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.branch.name} · {room.name}
                  </option>
                ))}
              </select>
              <input
                name="startTime"
                type="time"
                required
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <input
                name="endTime"
                type="time"
                required
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <input
                name="startDate"
                type="date"
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <input
                name="endDate"
                type="date"
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <button
              type="submit"
              className="mt-3 h-10 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Lưu lịch
            </button>
          </form>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-semibold">Buổi học gần đây</h2>
          <div className="space-y-3">
            {courseClass.sessions.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/sessions/${item.id}/attendance`} className="block">
                <p className="font-medium">
                  {formatDate(item.sessionDate)} · {item.startTime} - {item.endTime}
                </p>
                <p className="text-sm text-zinc-500">
                  {sessionStatusLabels[item.status]} · {item.room?.name ?? "-"}
                </p>
                  </Link>
                  {can(session, "session.manage") && item.status !== "CANCELLED" ? (
                    <form action={deleteSessionAction.bind(null, id, item.id)}>
                      <ConfirmSubmitButton
                        message="Hủy buổi học này? Điểm danh và nhận xét liên quan vẫn được lưu để tra cứu."
                        className="h-8 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Hủy
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {can(session, "session.manage") ? (
          <form
            action={sessionAction}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <h2 className="mb-4 font-semibold">Mở buổi học nhanh</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="sessionDate"
                type="date"
                required
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <select
                name="roomId"
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                <option value="">Phòng theo lớp</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.branch.name} · {room.name}
                  </option>
                ))}
              </select>
              <input
                name="startTime"
                type="time"
                required
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <input
                name="endTime"
                type="time"
                required
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <button
              type="submit"
              className="mt-3 h-10 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Tạo buổi và điểm danh
            </button>
          </form>
        ) : null}
      </section>
    </AppShell>
  );
}
