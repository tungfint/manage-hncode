import {
  AttendanceStatus,
  ClassStatus,
  CommentType,
  EnrollmentStatus,
  ExamType,
  Gender,
  PaymentMethod,
  PayrollStatus,
  SalaryType,
  SessionStatus,
  StaffType,
  StudentStatus,
  TeacherAssignmentRole,
  TuitionStatus,
  UserStatus,
} from "@/generated/prisma/client";

export const userStatusLabels: Record<UserStatus, string> = {
  ACTIVE: "Hoạt động",
  LOCKED: "Đã khóa",
  DISABLED: "Ngừng dùng",
};

export const staffTypeLabels: Record<StaffType, string> = {
  ADMIN: "Admin",
  TEACHER_MAIN: "Giáo viên chính",
  TEACHER_ASSISTANT: "Giáo viên phụ",
  ACCOUNTANT: "Kế toán",
  RECEPTIONIST: "Lễ tân",
  ACADEMIC: "Học vụ",
  COLLABORATOR: "Cộng tác viên",
  PART_TIME: "Thời vụ",
};

export const genderLabels: Record<Gender, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

export const studentStatusLabels: Record<StudentStatus, string> = {
  STUDYING: "Đang học",
  PAUSED: "Tạm nghỉ",
  RESERVED: "Bảo lưu",
  LEFT: "Nghỉ hẳn",
};

export const classStatusLabels: Record<ClassStatus, string> = {
  PLANNED: "Sắp mở",
  ACTIVE: "Đang học",
  PAUSED: "Tạm dừng",
  COMPLETED: "Đã kết thúc",
};

export const enrollmentStatusLabels: Record<EnrollmentStatus, string> = {
  ACTIVE: "Đang học",
  PAUSED: "Tạm nghỉ",
  RESERVED: "Bảo lưu",
  LEFT: "Đã rời lớp",
};

export const teacherRoleLabels: Record<TeacherAssignmentRole, string> = {
  MAIN: "Giáo viên chính",
  ASSISTANT: "Giáo viên phụ",
};

export const sessionStatusLabels: Record<SessionStatus, string> = {
  PLANNED: "Chưa diễn ra",
  COMPLETED: "Đã học",
  CANCELLED: "Nghỉ",
  MAKEUP: "Học bù",
  SUBSTITUTE: "Dạy thay",
};

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  PRESENT: "Có mặt",
  ABSENT_EXCUSED: "Vắng có phép",
  ABSENT_UNEXCUSED: "Vắng không phép",
  LATE: "Đi muộn",
  LEFT_EARLY: "Về sớm",
  MAKEUP: "Học bù",
  RESERVED: "Bảo lưu",
};

export const commentTypeLabels: Record<CommentType, string> = {
  SESSION: "Theo buổi học",
  EXAM: "Theo bài kiểm tra",
  PERIOD: "Theo giai đoạn",
  FINAL: "Cuối khóa",
};

export const examTypeLabels: Record<ExamType, string> = {
  ENTRY: "Đầu vào",
  PERIODIC: "Định kỳ",
  MIDTERM: "Giữa khóa",
  FINAL: "Cuối khóa",
};

export const tuitionStatusLabels: Record<TuitionStatus, string> = {
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Thanh toán một phần",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  DISCOUNTED: "Miễn giảm",
  RESERVED: "Bảo lưu",
  REFUNDED: "Hoàn tiền",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  CARD: "Thẻ",
  OTHER: "Khác",
};

export const salaryTypeLabels: Record<SalaryType, string> = {
  PER_SESSION: "Theo buổi",
  PER_HOUR: "Theo giờ",
  MONTHLY: "Theo tháng",
  PER_SHIFT: "Theo ca",
  PER_TASK: "Theo việc",
  AGREEMENT: "Thỏa thuận",
};

export const payrollStatusLabels: Record<PayrollStatus, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  PAID: "Đã thanh toán",
  LOCKED: "Đã khóa",
};
