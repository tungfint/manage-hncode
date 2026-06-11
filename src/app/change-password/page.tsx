import { KeyRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { changePasswordAction } from "@/app/login/actions";
import { BrandLogo } from "@/components/brand-logo";
import { getCurrentSession } from "@/lib/auth";

type ChangePasswordPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  short: "Mật khẩu mới cần có ít nhất 8 ký tự.",
  confirm: "Mật khẩu xác nhận chưa khớp.",
  same: "Mật khẩu mới cần khác mật khẩu hiện tại.",
  current: "Mật khẩu hiện tại không đúng.",
};

export default async function ChangePasswordPage({
  searchParams,
}: ChangePasswordPageProps) {
  const session = await getCurrentSession();
  const params = await searchParams;

  if (!session) {
    redirect("/login");
  }

  const title = session.mustChangePassword
    ? "Đổi mật khẩu lần đầu"
    : "Đổi mật khẩu";
  const description = session.mustChangePassword
    ? "Tài khoản đang dùng mật khẩu tạm. Vui lòng đổi mật khẩu trước khi vào hệ thống."
    : "Cập nhật mật khẩu mới để bảo vệ tài khoản đăng nhập.";

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#fff6b8_0%,#f8fbff_45%,#e8f7fc_100%)] p-4">
      <section className="w-full max-w-md rounded-lg border border-white/80 bg-white p-6 shadow-[0_24px_70px_rgba(23,33,92,0.13)]">
        <BrandLogo showText={false} className="mb-6 justify-center [&_img]:size-24" />
        <div className="mb-5">
          <div className="mb-3 grid size-11 place-items-center rounded-md bg-[#fff1a6] text-[#17215c] ring-1 ring-yellow-200">
            <KeyRound size={22} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-950">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
        </div>

        {params?.error ? (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {errorMessages[params.error] ?? "Không thể đổi mật khẩu."}
          </div>
        ) : null}

        <form action={changePasswordAction} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Mật khẩu hiện tại
            </span>
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Mật khẩu mới
            </span>
            <input
              name="newPassword"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Nhập lại mật khẩu mới
            </span>
            <input
              name="confirmPassword"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
            />
          </label>
          <button
            type="submit"
            className="h-11 w-full rounded-md bg-[#17215c] text-sm font-medium text-white hover:bg-[#25308d]"
          >
            Cập nhật mật khẩu
          </button>
        </form>
        {!session.mustChangePassword ? (
          <Link
            href="/account"
            className="mt-4 inline-flex w-full justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Quay lại tài khoản của tôi
          </Link>
        ) : null}
      </section>
    </main>
  );
}
