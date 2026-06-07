import { ArrowRight, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/login/actions";
import { BrandLogo } from "@/components/brand-logo";
import { getCurrentSession } from "@/lib/auth";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getCurrentSession();

  if (session) {
    redirect(session.mustChangePassword ? "/change-password" : "/dashboard");
  }

  const params = await searchParams;
  const error = params?.error;

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#fff6b8_0%,#fffdf1_32%,#e8f7fc_72%,#f5f8fb_100%)] p-4 text-slate-950">
      <main className="mx-auto grid min-h-[calc(100vh-32px)] max-w-5xl overflow-hidden rounded-lg border border-white/80 bg-white shadow-[0_24px_70px_rgba(23,33,92,0.13)] lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#ffe678_0%,#fff7bd_40%,#17bde1_100%)] p-8 lg:grid lg:place-items-center">
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,.4)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(23,33,92,0)_0%,rgba(23,33,92,.16)_100%)]" />
          <div className="relative w-full max-w-sm rounded-lg border border-white/70 bg-white/80 p-8 text-center shadow-sm backdrop-blur">
            <BrandLogo showText={false} className="justify-center [&_img]:size-36" />
            <p className="mx-auto mt-6 max-w-72 text-2xl font-bold leading-snug tracking-normal text-[#17215c]">
              <span className="block">Hệ thống quản lý</span>
              <span className="block">Câu lạc bộ lập trình</span>
              <span className="mt-3 inline-flex items-center justify-center rounded-md border border-[#08a7dc]/25 bg-[linear-gradient(135deg,#ffffff_0%,#e8f7fc_55%,#fff4aa_100%)] px-4 py-1.5 text-3xl font-extrabold text-[#17215c] shadow-sm">
                HNCode
              </span>
            </p>
          </div>
        </section>

        <section className="grid place-items-center bg-white p-6 sm:p-8">
          <div className="w-full max-w-md">
            <div className="mb-7">
              <div className="mb-6 lg:hidden">
                <BrandLogo />
              </div>
              <div className="mb-4 grid size-12 place-items-center rounded-md bg-[#fff1a6] text-[#17215c] ring-1 ring-yellow-200">
                <LockKeyhole size={24} aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-950">Đăng nhập</h2>
              <p className="mt-1 text-sm text-slate-500">
                Dành cho tài khoản nội bộ HNCode.
              </p>
            </div>

            {error ? (
              <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </div>
            ) : null}

            <form action={loginAction} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Email hoặc số điện thoại
                </span>
                <input
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#08a7dc] focus:ring-2 focus:ring-[#08a7dc]/12"
                  placeholder="admin@trungtam.test"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Mật khẩu</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#08a7dc] focus:ring-2 focus:ring-[#08a7dc]/12"
                  placeholder="Password123!"
                />
              </label>

              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#17215c] text-sm font-medium text-white shadow-sm transition hover:bg-[#25308d] focus:outline-none focus:ring-2 focus:ring-[#f4d35e]/50"
              >
                Đăng nhập
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              hoặc
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <a
              href="/login/google"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <span className="grid size-5 place-items-center rounded-full bg-[#08a7dc] text-xs font-bold text-white">
                G
              </span>
              Đăng nhập bằng Google
            </a>

            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Tài khoản mẫu: <strong>admin@trungtam.test</strong> /{" "}
              <strong>Password123!</strong>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
