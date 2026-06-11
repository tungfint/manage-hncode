import { KeyRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { updateMyAccountAction } from "@/app/account/actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AccountPageProps = {
  searchParams?: Promise<{
    updated?: string;
    passwordChanged?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid: "Thông tin tài khoản chưa hợp lệ.",
  email_exists: "Email này đã được dùng cho tài khoản khác.",
  phone_exists: "Số điện thoại này đã được dùng cho tài khoản khác.",
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const session = await getSessionOrRedirect();
  const params = await searchParams;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      mustChangePassword: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell session={session}>
      <PageHeader
        title="Tài khoản của tôi"
        description="Cập nhật thông tin cá nhân và đổi mật khẩu đăng nhập."
        action={
          <Link
            href="/change-password"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
          >
            <KeyRound size={17} aria-hidden="true" />
            Đổi mật khẩu
          </Link>
        }
      />

      {params?.updated || params?.passwordChanged ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã cập nhật tài khoản.
        </div>
      ) : null}
      {params?.error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {errorMessages[params.error] ?? errorMessages.invalid}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,640px)_1fr]">
        <form
          action={updateMyAccountAction}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 className="font-semibold text-slate-950">Thông tin cá nhân</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Họ và tên
              </span>
              <input
                name="name"
                required
                defaultValue={user.name}
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                name="email"
                type="email"
                defaultValue={user.email ?? ""}
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Số điện thoại
              </span>
              <input
                name="phone"
                defaultValue={user.phone ?? ""}
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
            >
              Lưu thông tin
            </button>
          </div>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <h2 className="font-semibold text-slate-950">Bảo mật đăng nhập</h2>
          <p className="mt-3">
            Nếu đang dùng mật khẩu tạm hoặc nghi ngờ bị lộ mật khẩu, hãy đổi mật
            khẩu ngay.
          </p>
          <p className="mt-3">
            Trạng thái đổi mật khẩu:{" "}
            <span className="font-medium text-slate-900">
              {user.mustChangePassword ? "Cần đổi mật khẩu" : "Đã ổn định"}
            </span>
          </p>
          <Link
            href="/change-password"
            className="mt-4 inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Đổi mật khẩu
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
