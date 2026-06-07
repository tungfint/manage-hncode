import { Upload } from "lucide-react";
import { importStudentsAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";

type ImportStudentsPageProps = {
  searchParams?: Promise<{
    imported?: string;
    skipped?: string;
    error?: string;
    errors?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  file: "Vui lòng chọn file Excel hợp lệ.",
  sheet: "File Excel chưa có sheet dữ liệu.",
  headers:
    "File Excel thiếu cột bắt buộc. Cần có cột “Họ tên học viên”. Hãy tải file mẫu mới nhất.",
};

export default async function ImportStudentsPage({
  searchParams,
}: ImportStudentsPageProps) {
  const session = await requirePermission("student.create");
  const params = await searchParams;
  const rowErrors = params?.errors
    ? decodeURIComponent(params.errors).split("||").filter(Boolean)
    : [];

  return (
    <AppShell session={session}>
      <PageHeader
        title="Import học viên từ Excel"
        description="Dùng file mẫu tiếng Việt để nhập nhanh nhiều học viên và phụ huynh."
        action={
          <a
            href="/students"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Quay lại
          </a>
        }
      />

      {params?.imported ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã import {params.imported} học viên
          {params.skipped ? `, bỏ qua ${params.skipped} dòng trùng.` : "."}
        </div>
      ) : null}

      {params?.error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {errorMessages[params.error] ?? "Không thể import file Excel."}
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

      <section className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <form
          action={importStudentsAction}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-5 grid size-12 place-items-center rounded-md bg-[#e8f7fc] text-[#08a7dc]">
            <Upload size={24} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold">Chọn file Excel</h2>
          <p className="mt-1 text-sm text-slate-500">
            Hỗ trợ `.xlsx`. Dòng đầu tiên phải là tiêu đề cột tiếng Việt theo mẫu.
          </p>
          <input
            name="file"
            type="file"
            accept=".xlsx"
            required
            className="mt-5 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#17215c] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          />
          <button
            type="submit"
            className="mt-5 h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
          >
            Import học viên
          </button>
        </form>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">File mẫu tiếng Việt</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Các cột đang hỗ trợ: Họ tên học viên, Ngày sinh, Giới tính, Số điện
            thoại học viên, Email học viên, Trường học, Lớp ở trường, Lớp ở CLB,
            Tài khoản HNCode, Trạng thái, Họ tên phụ huynh, Số điện thoại phụ
            huynh, Email phụ huynh, Quan hệ, Ghi chú.
          </p>
          <a
            href="/students/import/template"
            className="mt-4 inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Tải file mẫu Excel
          </a>
        </aside>
      </section>
    </AppShell>
  );
}
