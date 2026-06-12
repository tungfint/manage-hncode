import { LogOut, Menu, UserCog } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { BrandLogo } from "@/components/brand-logo";
import { CurrentPageTitle, SidebarNav } from "@/components/sidebar-nav";
import type { AuthSession } from "@/lib/auth";
import { roleLabel } from "@/lib/permissions";

type AppShellProps = {
  session: AuthSession;
  children: React.ReactNode;
};

export function AppShell({ session, children }: AppShellProps) {
  const roleText = session.roles.map(roleLabel).join(", ") || "Tài khoản";

  return (
    <div className="min-h-screen bg-[#f4f8fb] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 text-slate-950 shadow-sm lg:block">
          <a
            className="mb-5 flex items-center rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#fff4b8_0%,#ffffff_54%,#e8f7fc_100%)] px-3 py-3 shadow-sm"
            href="/dashboard"
          >
            <BrandLogo compact />
          </a>

          <SidebarNav permissions={session.permissions} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <details className="relative lg:hidden">
                <summary
                  className="grid size-10 cursor-pointer list-none place-items-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm [&::-webkit-details-marker]:hidden"
                  aria-label="Mở menu"
                >
                  <Menu size={18} aria-hidden="true" />
                </summary>
                <div className="fixed inset-x-3 top-16 z-50 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="mb-3 rounded-lg border border-yellow-200/80 bg-[#fff8d7] px-3 py-3">
                    <BrandLogo compact />
                  </div>
                  <SidebarNav permissions={session.permissions} />
                </div>
              </details>
              <CurrentPageTitle />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href="/account"
                className="hidden min-w-0 items-center gap-3 rounded-md border border-slate-200 bg-white px-2.5 py-2 hover:bg-slate-50 sm:flex"
                title="Tài khoản của tôi"
              >
                <div className="grid size-8 place-items-center rounded-md bg-[#fff1a6] text-[#17215c]">
                  <UserCog size={17} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="max-w-44 truncate text-sm font-medium">{roleText}</p>
                  <p className="text-xs text-slate-500">Đang đăng nhập</p>
                </div>
              </a>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="grid size-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  aria-label="Đăng xuất"
                >
                  <LogOut size={18} aria-hidden="true" />
                </button>
              </form>
            </div>
          </header>

          <div className="page-soft-enter flex flex-1 flex-col gap-5 p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
