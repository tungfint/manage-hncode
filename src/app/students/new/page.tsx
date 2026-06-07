import { createStudentAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { genderLabels, studentStatusLabels } from "@/lib/labels";

export default async function NewStudentPage() {
  const session = await requirePermission("student.create");

  return (
    <AppShell session={session}>
      <PageHeader
        title="Thêm học viên"
        description="Nhập thông tin cơ bản và phụ huynh liên hệ trong một lần."
        action={
          <a
            href="/students"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          >
            Quay lại
          </a>
        }
      />

      <form
        action={createStudentAction}
        className="grid gap-5 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-2"
      >
        <section className="space-y-4">
          <h2 className="font-semibold">Thông tin học viên</h2>
          <label className="block">
            <span className="text-sm font-medium">Họ tên *</span>
            <input
              name="fullName"
              required
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Ngày sinh</span>
              <input
                name="dateOfBirth"
                type="date"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Giới tính</span>
              <select
                name="gender"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                <option value="">Chưa chọn</option>
                {Object.entries(genderLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Số điện thoại</span>
              <input
                name="phone"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email học viên</span>
              <input
                name="email"
                type="email"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Trạng thái</span>
              <select
                name="status"
                defaultValue="STUDYING"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                {Object.entries(studentStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Tài khoản HNCode</span>
              <input
                name="hncodeAccount"
                placeholder="Nếu trống sẽ dùng email học viên"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Trường học</span>
              <input
                name="school"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Lớp ở trường</span>
              <input
                name="schoolGrade"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Lớp ở CLB</span>
            <input
              name="clubClass"
              placeholder="Ví dụ: Python Kids K01"
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Trình độ đầu vào</span>
            <input
              name="entryLevel"
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
            />
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="font-semibold">Phụ huynh liên hệ</h2>
          <label className="block">
            <span className="text-sm font-medium">Họ tên phụ huynh</span>
            <input
              name="parentName"
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">SĐT phụ huynh</span>
              <input
                name="parentPhone"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email phụ huynh</span>
              <input
                name="parentEmail"
                type="email"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Quan hệ</span>
              <input
                name="relationship"
                placeholder="Mẹ, bố, người giám hộ..."
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Ghi chú</span>
            <textarea
              name="note"
              rows={8}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <a
              href="/students"
              className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
            >
              Hủy
            </a>
            <button
              type="submit"
              className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Lưu học viên
            </button>
          </div>
        </section>
      </form>
    </AppShell>
  );
}
