import { notFound, redirect } from "next/navigation";
import {
  createParentLoginAction,
  createStudentLoginAction,
  updateStudentAction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { canAccessStudent } from "@/lib/data-scope";
import { genderLabels, studentStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

function dateValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

type EditStudentPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    studentAccount?: string;
    parentAccount?: string;
    error?: string;
  }>;
};

export default async function EditStudentPage({
  params,
  searchParams,
}: EditStudentPageProps) {
  const session = await requirePermission("student.update");
  const { id } = await params;
  const query = await searchParams;

  if (!(await canAccessStudent(session, id, "student.update"))) {
    redirect("/forbidden");
  }

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      user: true,
      parents: {
        include: {
          parent: {
            include: { user: true },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!student) {
    notFound();
  }

  const action = updateStudentAction.bind(null, id);
  const primaryParent = student.parents[0];

  return (
    <AppShell session={session}>
      <PageHeader
        title="Sửa học viên"
        description="Cập nhật hồ sơ học viên bằng tiếng Việt rõ ràng."
        action={
          <a
            href="/students"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Quay lại
          </a>
        }
      />
      {query?.studentAccount ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã tạo hoặc kích hoạt tài khoản học viên. Mật khẩu tạm: HNCODElaptrinhvuive.
        </div>
      ) : null}
      {query?.parentAccount ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã tạo hoặc kích hoạt tài khoản phụ huynh. Mật khẩu tạm: HNCODElaptrinhvuive.
        </div>
      ) : null}
      {query?.error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {query.error === "student_email"
            ? "Cần nhập Email học viên trước khi tạo tài khoản."
            : "Cần nhập Email phụ huynh trước khi tạo tài khoản."}
        </div>
      ) : null}
      <form
        action={action}
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2"
      >
        <label className="block">
          <span className="text-sm font-medium">Họ tên *</span>
          <input
            name="fullName"
            required
            defaultValue={student.fullName}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Ngày sinh</span>
          <input
            name="dateOfBirth"
            type="date"
            defaultValue={dateValue(student.dateOfBirth)}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Giới tính</span>
          <select
            name="gender"
            defaultValue={student.gender ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          >
            <option value="">Chưa chọn</option>
            {Object.entries(genderLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Số điện thoại</span>
          <input
            name="phone"
            defaultValue={student.phone ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email học viên</span>
          <input
            name="email"
            type="email"
            defaultValue={student.email ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Trường học</span>
          <input
            name="school"
            defaultValue={student.school ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Lớp ở trường</span>
          <input
            name="schoolGrade"
            defaultValue={student.schoolGrade ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Lớp ở CLB</span>
          <input
            name="clubClass"
            defaultValue={student.clubClass ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Trình độ đầu vào</span>
          <input
            name="entryLevel"
            defaultValue={student.entryLevel ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Tài khoản HNCode</span>
          <input
            name="hncodeAccount"
            defaultValue={student.hncodeAccount ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Trạng thái</span>
          <select
            name="status"
            defaultValue={student.status}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
          >
            {Object.entries(studentStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-900">Tài khoản học viên</p>
          <p className="mt-1 text-slate-600">
            {student.user
              ? `${student.user.email ?? "Chưa có email"} - ${student.user.status}`
              : "Chưa liên kết tài khoản đăng nhập."}
          </p>
        </div>
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 lg:col-span-2">
          <h2 className="font-semibold">Phụ huynh</h2>
          <div className="grid gap-3 lg:grid-cols-4">
            <label className="block">
              <span className="text-sm font-medium">Họ tên phụ huynh</span>
              <input
                name="parentName"
                defaultValue={primaryParent?.parent.fullName ?? ""}
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">SĐT phụ huynh</span>
              <input
                name="parentPhone"
                defaultValue={primaryParent?.parent.phone ?? ""}
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email phụ huynh</span>
              <input
                name="parentEmail"
                type="email"
                defaultValue={primaryParent?.parent.email ?? ""}
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Quan hệ</span>
              <input
                name="relationship"
                defaultValue={primaryParent?.relationship ?? "Phụ huynh"}
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
          </div>
          <p className="text-sm text-slate-600">
            Tài khoản phụ huynh:{" "}
            {primaryParent?.parent.user
              ? `${primaryParent.parent.user.email ?? "Chưa có email"} - ${primaryParent.parent.user.status}`
              : "Chưa liên kết tài khoản đăng nhập."}
          </p>
        </section>
        <label className="block lg:col-span-2">
          <span className="text-sm font-medium">Ghi chú</span>
          <textarea
            name="note"
            rows={5}
            defaultValue={student.note ?? ""}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#08a7dc]"
          />
        </label>
        <div className="flex justify-end gap-2 lg:col-span-2">
          <a
            href="/students"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Hủy
          </a>
          <button
            type="submit"
            className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
          >
            Lưu thay đổi
          </button>
        </div>
      </form>
      <div className="grid gap-3 rounded-lg border border-yellow-200 bg-[#fff8d7] p-4 shadow-sm md:grid-cols-2">
        <form action={createStudentLoginAction.bind(null, id)}>
          <button
            type="submit"
            className="h-10 w-full rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
          >
            Tạo mật khẩu cho tài khoản học viên
          </button>
        </form>
        <form action={createParentLoginAction.bind(null, id)}>
          <button
            type="submit"
            className="h-10 w-full rounded-md border border-[#08a7dc]/30 bg-white px-4 text-sm font-medium text-[#17215c] hover:bg-sky-50"
          >
            Tạo mật khẩu cho tài khoản phụ huynh
          </button>
        </form>
      </div>
    </AppShell>
  );
}
