import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileBarChart2,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
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
  description?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Tổng quan",
    items: [
      {
        label: "Tổng quan",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "report.learning.view",
        description: "Bảng điều khiển vận hành",
      },
    ],
  },
  {
    label: "Học viên & phụ huynh",
    items: [
      {
        label: "Học viên",
        href: "/students",
        icon: GraduationCap,
        permission: "student.view",
        description: "Hồ sơ, phụ huynh, lớp học, tài khoản HNCode",
      },
    ],
  },
  {
    label: "Lớp học & giảng dạy",
    items: [
      {
        label: "Lớp học",
        href: "/classes",
        icon: BookOpenCheck,
        permission: "class.view",
        description: "Lớp, học viên và giáo viên",
      },
      {
        label: "Lịch học",
        href: "/schedule",
        icon: CalendarDays,
        permission: "schedule.view",
        description: "Lịch cố định và phòng học",
      },
      {
        label: "Buổi học",
        href: "/sessions",
        icon: ClipboardCheck,
        permission: "session.view",
        description: "Điểm danh, nội dung, nhận xét",
      },
    ],
  },
  {
    label: "Kiểm tra & kết quả",
    items: [
      {
        label: "Kiểm tra",
        href: "/exams",
        icon: FileBarChart2,
        permission: "exam.view",
        description: "Bài kiểm tra và nhập điểm",
      },
    ],
  },
  {
    label: "Tài chính",
    items: [
      {
        label: "Học phí",
        href: "/tuition",
        icon: ReceiptText,
        permission: "tuition.view",
        description: "Công nợ và khoản phải thu",
      },
      {
        label: "Thanh toán",
        href: "/payments",
        icon: Banknote,
        permission: "payment.view",
        description: "Các khoản đã thu",
      },
      {
        label: "Lương",
        href: "/payrolls",
        icon: WalletCards,
        permission: "salary.view",
        description: "Bảng lương và chi trả",
      },
    ],
  },
  {
    label: "Nhân sự & phân quyền",
    items: [
      {
        label: "Nhân sự",
        href: "/staff",
        icon: UserCog,
        permission: "user.manage",
        description: "Hồ sơ nhân sự",
      },
      {
        label: "Chấm công",
        href: "/staff/attendance",
        icon: Clock3,
        permission: "staff_attendance.view",
        description: "Ca làm và giờ công",
      },
      {
        label: "Phân quyền",
        href: "/admin/roles",
        icon: ShieldCheck,
        permission: "role.manage",
        description: "Vai trò và quyền mặc định",
      },
      {
        label: "Tài khoản & quyền",
        href: "/admin/users",
        icon: UserCog,
        permission: "user.manage",
        description: "Tài khoản và quyền riêng",
      },
      {
        label: "Nhật ký hệ thống",
        href: "/admin/audit-logs",
        icon: ScrollText,
        permission: "audit_log.view",
        description: "Lịch sử thao tác quan trọng",
      },
    ],
  },
  {
    label: "Báo cáo",
    items: [
      {
        label: "Báo cáo học tập",
        href: "/reports/learning",
        icon: FileBarChart2,
        permission: "report.learning.view",
        description: "Tiến độ và kết quả học tập",
      },
      {
        label: "Báo cáo tài chính",
        href: "/reports/finance",
        icon: Banknote,
        permission: "report.finance.view",
        description: "Thu, chi, công nợ",
      },
      {
        label: "Báo cáo nhân sự",
        href: "/reports/staff",
        icon: UserCog,
        permission: "report.staff.view",
        description: "Nhân sự, chấm công, lương",
      },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);
