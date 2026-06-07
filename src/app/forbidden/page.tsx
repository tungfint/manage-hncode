import { LockKeyhole } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f8f4] p-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-md bg-rose-50 text-rose-700">
          <LockKeyhole size={24} aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold">Không có quyền truy cập</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Tài khoản hiện tại không được cấp quyền cho chức năng này.
        </p>
        <a
          href="/dashboard"
          className="mt-5 inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Về tổng quan
        </a>
      </div>
    </div>
  );
}
