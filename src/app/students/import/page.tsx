import { Upload } from "lucide-react";
import {
  confirmImportStudentsAction,
  previewImportStudentsAction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { getStudentImportPreview } from "@/lib/student-import-preview";

type ImportStudentsPageProps = {
  searchParams?: Promise<{
    preview?: string;
    result?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  file: "Vui lòng chọn file Excel hợp lệ.",
  sheet: "File Excel chưa có sheet dữ liệu.",
  headers:
    "File Excel thiếu cột bắt buộc. Cần có cột “Họ tên học viên”. Hãy tải file mẫu mới nhất.",
  preview: "Không tìm thấy dữ liệu xem trước. Vui lòng upload lại file Excel.",
};

export default async function ImportStudentsPage({
  searchParams,
}: ImportStudentsPageProps) {
  const session = await requirePermission("student.create");
  const params = await searchParams;
  const preview = await getStudentImportPreview(params?.preview ?? params?.result);
  const confirmAction = preview
    ? confirmImportStudentsAction.bind(null, preview.token)
    : undefined;
  const importedRows = preview?.importedRows ?? [];
  const importErrors = preview?.importErrors ?? [];
  const isResult = Boolean(params?.result);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Import học viên từ Excel"
        description="Upload file mẫu, kiểm tra lỗi theo từng dòng, sau đó xác nhận import vào hệ thống."
        action={
          <a
            href="/students"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Quay lại
          </a>
        }
      />

      {params?.error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {errorMessages[params.error] ?? "Không thể import file Excel."}
        </div>
      ) : null}

      {isResult && preview ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã import {importedRows.length} học viên.{" "}
          {importErrors.length
            ? `${importErrors.length} dòng phát sinh lỗi khi xác nhận.`
            : "Không có lỗi phát sinh khi xác nhận."}
        </div>
      ) : null}

      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form
          action={previewImportStudentsAction}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-5 grid size-12 place-items-center rounded-md bg-[#e8f7fc] text-[#08a7dc]">
            <Upload size={24} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold">Chọn file Excel</h2>
          <p className="mt-1 text-sm text-slate-500">
            Hỗ trợ `.xlsx`. Dòng đầu tiên phải là tiêu đề cột tiếng Việt theo
            mẫu. Cột “Mã lớp học” dùng để tự động xếp học viên vào lớp.
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
            Kiểm tra dữ liệu
          </button>
        </form>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">File mẫu tiếng Việt</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cột hỗ trợ: Họ tên học viên, Ngày sinh, Giới tính, Số điện thoại
            học viên, Email học viên, Trường học, Lớp ở trường, Mã lớp học,
            Tài khoản HNCode, Trình độ đầu vào, Trạng thái, Họ tên phụ huynh,
            Số điện thoại phụ huynh, Email phụ huynh, Quan hệ, Ghi chú.
          </p>
          <a
            href="/students/import/template"
            className="mt-4 inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Tải file mẫu Excel
          </a>
        </aside>
      </section>

      {preview ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">
                {isResult ? "Kết quả import" : "Xem trước dữ liệu import"}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                File: {preview.fileName} · Hợp lệ {preview.validRows.length} dòng ·
                Lỗi {preview.errors.length + importErrors.length} dòng
              </p>
            </div>
            {!isResult && confirmAction && preview.validRows.length ? (
              <form action={confirmAction}>
                <ConfirmSubmitButton
                  message={`Xác nhận import ${preview.validRows.length} học viên hợp lệ?`}
                  className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
                >
                  Xác nhận import
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="min-w-0 rounded-md border border-teal-100">
              <div className="border-b border-teal-100 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900">
                Dòng hợp lệ
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-white text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Dòng</th>
                      <th className="px-3 py-2 font-medium">Học viên</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Mã lớp</th>
                      <th className="px-3 py-2 font-medium">Phụ huynh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(isResult ? importedRows : preview.validRows).map((row) => (
                      <tr key={`${row.rowNumber}-${row.email ?? row.fullName}`}>
                        <td className="px-3 py-2 text-zinc-500">{row.rowNumber}</td>
                        <td className="px-3 py-2 font-medium">{row.fullName}</td>
                        <td className="px-3 py-2 text-zinc-600">{row.email ?? "-"}</td>
                        <td className="px-3 py-2 text-zinc-600">
                          {row.classCode
                            ? `${row.classCode}${row.className ? ` · ${row.className}` : ""}`
                            : "Chưa xếp lớp"}
                        </td>
                        <td className="px-3 py-2 text-zinc-600">
                          {row.parentName ?? row.parentPhone ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!(isResult ? importedRows : preview.validRows).length ? (
                  <p className="p-3 text-sm text-zinc-500">Không có dòng hợp lệ.</p>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 rounded-md border border-amber-100">
              <div className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                Dòng cần sửa
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-white text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Dòng</th>
                      <th className="px-3 py-2 font-medium">Lỗi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {[...preview.errors, ...importErrors].map((error, index) => (
                      <tr key={`${error.rowNumber}-${index}`}>
                        <td className="px-3 py-2 text-zinc-500">{error.rowNumber}</td>
                        <td className="px-3 py-2 text-zinc-700">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.errors.length + importErrors.length === 0 ? (
                  <p className="p-3 text-sm text-zinc-500">Không có dòng lỗi.</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
