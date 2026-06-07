import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  FileBarChart2,
  GraduationCap,
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
  UserCog,
  WalletCards,
} from "lucide-react";
import type { PermissionCode } from "@/lib/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: PermissionCode;
};

export const navItems: NavItem[] = [
  {
    label: "Tổng quan",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "report.learning.view",
  },
  {
    label: "Học viên",
    href: "/students",
    icon: GraduationCap,
    permission: "student.view",
  },
  {
    label: "Nhân sự",
    href: "/staff",
    icon: UserCog,
    permission: "user.manage",
  },
  {
    label: "Lớp học",
    href: "/classes",
    icon: BookOpenCheck,
    permission: "class.view",
  },
  {
    label: "Lịch học",
    href: "/schedule",
    icon: CalendarDays,
    permission: "schedule.view",
  },
  {
    label: "Buổi học",
    href: "/sessions",
    icon: ClipboardCheck,
    permission: "session.view",
  },
  {
    label: "Kiểm tra",
    href: "/exams",
    icon: FileBarChart2,
    permission: "exam.view",
  },
  {
    label: "Học phí",
    href: "/tuition",
    icon: ReceiptText,
    permission: "tuition.view",
  },
  {
    label: "Thanh toán",
    href: "/payments",
    icon: Banknote,
    permission: "payment.view",
  },
  {
    label: "Lương",
    href: "/payrolls",
    icon: WalletCards,
    permission: "salary.view",
  },
  {
    label: "Phân quyền",
    href: "/admin/roles",
    icon: ShieldCheck,
    permission: "role.manage",
  },
  {
    label: "Báo cáo học tập",
    href: "/reports/learning",
    icon: FileBarChart2,
    permission: "report.learning.view",
  },
  {
    label: "Báo cáo tài chính",
    href: "/reports/finance",
    icon: Banknote,
    permission: "report.finance.view",
  },
  {
    label: "Báo cáo nhân sự",
    href: "/reports/staff",
    icon: UserCog,
    permission: "report.staff.view",
  },
];
