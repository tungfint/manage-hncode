"use client";

import { usePathname } from "next/navigation";
import { navGroups, navItems } from "@/lib/nav";

type SidebarNavProps = {
  permissions: string[];
};

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/" || pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function currentNavItem(pathname: string) {
  return [...navItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isActivePath(pathname, item.href));
}

export function SidebarNav({ permissions }: SidebarNavProps) {
  const pathname = usePathname();
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => permissions.includes(item.permission)),
    }))
    .filter((group) => group.items.length);

  return (
    <nav className="space-y-5">
      {visibleGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);

              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "group flex min-h-10 items-center gap-3 rounded-md border px-3 text-sm font-medium transition",
                    active
                      ? "border-yellow-300 bg-[#fff0a6] text-[#17215c] shadow-sm"
                      : "border-transparent text-slate-600 hover:border-yellow-200 hover:bg-[#fff9d8] hover:text-[#17215c]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "grid size-8 shrink-0 place-items-center rounded-md",
                      active
                        ? "bg-white/80 text-[#17215c]"
                        : "bg-slate-50 text-slate-500 group-hover:bg-white group-hover:text-[#08a7dc]",
                    ].join(" ")}
                  >
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function CurrentPageTitle() {
  const pathname = usePathname();
  const item = currentNavItem(pathname);

  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
        HNCode
      </p>
      <h1 className="truncate text-base font-semibold text-slate-950 sm:text-lg">
        {item?.label ?? "Quản trị hệ thống"}
      </h1>
      {item?.description ? (
        <p className="hidden truncate text-xs text-slate-500 md:block">
          {item.description}
        </p>
      ) : null}
    </div>
  );
}
