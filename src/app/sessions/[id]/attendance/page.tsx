import {
  createSessionCommentAction,
  markAttendanceAction,
  saveSessionNotesAction,
  updateSessionTeachersAction,
  uploadSessionAttachmentAction,
} from "@/app/actions";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth";
import { canAccessClass } from "@/lib/data-scope";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  attendanceStatusLabels,
  sessionStatusLabels,
} from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type AttendancePageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    saved?: string;
    commented?: string;
    teachersUpdated?: string;
  }>;
};

export default async function AttendancePage({
  params,
  searchParams,
}: AttendancePageProps) {
  const session = await requirePermission("attendance.view");
  const { id } = await params;
  const qs = await searchParams;
  const classSession = await prisma.classSession.findUnique({
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
      room: true,
      teachers: { include: { teacher: true } },
      attendances: true,
      comments: {
        include: { student: true, createdBy: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      attachments: {
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (!classSession) {
    return null;
  }

  if (!(await canAccessClass(session, classSession.classId, "attendance.view"))) {
    redirect("/forbidden");
  }

  const teacherOptions = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      staffProfile: {
        staffType: {
          in: ["TEACHER_MAIN", "TEACHER_ASSISTANT"],
        },
      },
    },
    orderBy: { name: "asc" },
  });
  const actualMainTeacher = classSession.teachers.find((item) => item.role === "MAIN");
  const actualAssistantTeacher = classSession.teachers.find(
    (item) => item.role === "ASSISTANT",
  );

  const attendanceByStudent = new Map(
    classSession.attendances.map((item) => [item.studentId, item]),
  );
  const saveNotes = saveSessionNotesAction.bind(null, id);
  const updateTeachers = updateSessionTeachersAction.bind(null, id);
  const markAttendance = markAttendanceAction.bind(null, id);
  const createComment = createSessionCommentAction.bind(null, id);
  const uploadAttachment = uploadSessionAttachmentAction.bind(null, id);

  return (
    <AppShell session={session}>
      <PageHeader
        title={`${classSession.courseClass.name} · ${formatDate(classSession.sessionDate)}`}
        description={`${classSession.startTime} - ${classSession.endTime} · ${classSession.room?.name ?? "Chưa chọn phòng"}`}
        action={
          <a
            href="/sessions"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Quay lại
          </a>
        }
      />

      {qs?.saved ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã lưu điểm danh.
        </div>
      ) : null}
      {qs?.commented ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã thêm nhận xét.
        </div>
      ) : null}

      {qs?.teachersUpdated ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã cập nhật giáo viên thực tế tham gia.
        </div>
      ) : null}

      <section className="space-y-5">
        <form
          action={markAttendance}
          className="rounded-lg border border-zinc-200 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-4">
            <div>
              <h2 className="font-semibold">Điểm danh học viên</h2>
              <p className="text-sm text-zinc-500">
                Có thể lưu nhanh toàn bộ lớp trong một lần.
              </p>
            </div>
            <Badge tone={classSession.status === "COMPLETED" ? "success" : "warning"}>
              {sessionStatusLabels[classSession.status]}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Học viên</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Ghi chú</th>
                  <th className="px-4 py-3 font-medium">Cập nhật</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {classSession.courseClass.students.map((enrollment) => {
                  const attendance = attendanceByStudent.get(enrollment.studentId);

                  return (
                    <tr key={enrollment.id}>
                      <td className="px-4 py-4 font-medium">
                        {enrollment.student.fullName}
                      </td>
                      <td className="px-4 py-4">
                        <select
                          name={`attendance:${enrollment.studentId}`}
                          defaultValue={attendance?.status ?? "PRESENT"}
                          disabled={!can(session, "attendance.manage")}
                          className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500 disabled:bg-zinc-100"
                        >
                          {Object.entries(attendanceStatusLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <textarea
                          name={`note:${enrollment.studentId}`}
                          defaultValue={attendance?.note ?? ""}
                          disabled={!can(session, "attendance.manage")}
                          rows={3}
                          className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-teal-500 disabled:bg-zinc-100"
                        />
                      </td>
                      <td className="px-4 py-4 text-xs text-zinc-500">
                        {formatDateTime(attendance?.markedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {can(session, "attendance.manage") ? (
            <div className="flex justify-end border-t border-zinc-200 p-4">
              <button
                type="submit"
                className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Lưu điểm danh
              </button>
            </div>
          ) : null}
        </form>

        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm xl:col-span-2">
            <h2 className="mb-3 font-semibold">Giáo viên thực tế tham gia</h2>
            <div className="flex flex-wrap gap-2">
              {classSession.teachers.map((teacher) => (
                <Badge key={teacher.id}>
                  {teacher.teacher.name} - {teacher.role === "MAIN" ? "Giáo viên chính" : "Giáo viên phụ"}
                </Badge>
              ))}
              {!classSession.teachers.length ? (
                <span className="text-sm text-zinc-500">Chưa ghi nhận giáo viên tham gia.</span>
              ) : null}
            </div>
          </div>
          {can(session, "session.manage") ? (
            <form
              action={updateTeachers}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm xl:col-span-2"
            >
              <h2 className="mb-3 font-semibold">Chọn giáo viên thực tế</h2>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
                <select
                  name="mainTeacherUserId"
                  defaultValue={actualMainTeacher?.teacherUserId ?? ""}
                  className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                >
                  <option value="">Chọn giáo viên chính</option>
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                <select
                  name="assistantTeacherUserId"
                  defaultValue={actualAssistantTeacher?.teacherUserId ?? ""}
                  className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                >
                  <option value="">Chọn giáo viên phụ</option>
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
                >
                  Lưu
                </button>
              </div>
            </form>
          ) : null}
          {can(session, "session.manage") ? (
            <form
              action={saveNotes}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <h2 className="mb-4 font-semibold">Nội dung buổi học</h2>
              <label className="block">
                <span className="text-sm font-medium">Trạng thái</span>
                <select
                  name="status"
                  defaultValue={classSession.status}
                  className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                >
                  {Object.entries(sessionStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-sm font-medium">Nội dung đã dạy</span>
                <textarea
                  name="lessonContent"
                  rows={4}
                  defaultValue={classSession.lessonContent ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-sm font-medium">Bài tập về nhà</span>
                <textarea
                  name="homework"
                  rows={3}
                  defaultValue={classSession.homework ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-sm font-medium">Ghi chú chung</span>
                <textarea
                  name="generalNote"
                  rows={3}
                  defaultValue={classSession.generalNote ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <button
                type="submit"
                className="mt-3 h-10 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Lưu nội dung
              </button>
            </form>
          ) : null}

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 font-semibold">Tài liệu buổi học</h2>
            <div className="space-y-2">
              {classSession.attachments.map((file) => (
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
              {!classSession.attachments.length ? (
                <p className="text-sm text-zinc-500">Chưa có file đính kèm.</p>
              ) : null}
            </div>
            {can(session, "session.manage") ? (
              <form action={uploadAttachment} className="mt-4 space-y-3">
                <input
                  name="file"
                  type="file"
                  required
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="h-10 w-full rounded-md bg-[#17215c] text-sm font-medium text-white hover:bg-[#25308d]"
                >
                  Tải file lên
                </button>
              </form>
            ) : null}
          </div>

          {can(session, "comment.manage") ? (
            <form
              action={createComment}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <h2 className="mb-4 font-semibold">Nhận xét nhanh</h2>
              <select
                name="studentId"
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                {classSession.courseClass.students.map((item) => (
                  <option key={item.studentId} value={item.studentId}>
                    {item.student.fullName}
                  </option>
                ))}
              </select>
              <textarea
                name="content"
                rows={4}
                required
                placeholder="Ví dụ: Tập trung tốt, cần luyện thêm bài có lời văn..."
                className="mt-3 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                className="mt-3 h-10 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Lưu nhận xét
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-semibold">Nhận xét gần đây</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {classSession.comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-zinc-200 p-3">
              <p className="font-medium">{comment.student.fullName}</p>
              <p className="mt-1 text-sm text-zinc-600">{comment.content}</p>
              <p className="mt-2 text-xs text-zinc-500">
                {comment.createdBy.name} · {formatDateTime(comment.createdAt)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
