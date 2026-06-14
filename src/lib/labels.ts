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
  StaffAttendanceStatus,
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

export const staffAttendanceStatusLabels: Record<StaffAttendanceStatus, string> = {
  PRESENT: "Có mặt",
  EXCUSED: "Nghỉ có phép",
  UNEXCUSED: "Nghỉ không phép",
  LATE: "Đi muộn",
  LEFT_EARLY: "Về sớm",
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

const auditActionLabels: Record<string, string> = {
  "auth.login": "Đăng nhập hệ thống",
  "auth.change_password": "Đổi mật khẩu",
  "student.create": "Tạo học viên",
  "student.update": "Cập nhật học viên",
  "student.delete": "Xóa học viên",
  "student.create_login": "Tạo tài khoản học viên",
  "student.import_excel": "Import học viên từ Excel",
  "parent.create": "Tạo phụ huynh",
  "parent.update": "Cập nhật phụ huynh",
  "parent.delete": "Xóa phụ huynh",
  "parent.create_login": "Tạo tài khoản phụ huynh",
  "class.create": "Tạo lớp học",
  "class.update": "Cập nhật lớp học",
  "class.delete": "Xóa lớp học",
  "class_student.enroll": "Thêm học viên vào lớp",
  "class_student.enroll_by_email": "Thêm học viên vào lớp bằng email",
  "class_student.remove": "Xóa học viên khỏi lớp",
  "class_teacher.assign": "Phân công giáo viên",
  "class_teacher.remove": "Gỡ phân công giáo viên",
  "schedule.create": "Tạo lịch học",
  "schedule.update": "Cập nhật lịch học",
  "schedule.delete": "Xóa lịch học",
  "session.create": "Tạo buổi học",
  "session.update": "Cập nhật buổi học",
  "session.delete": "Xóa buổi học",
  "session.delete_permanent": "Xóa hẳn buổi học",
  "session_teacher.update": "Cập nhật giáo viên buổi học",
  "session_attachment.upload": "Tải file buổi học",
  "attendance.bulk_upsert": "Cập nhật điểm danh",
  "comment.create": "Tạo nhận xét học viên",
  "exam.create": "Tạo bài kiểm tra",
  "exam_attachment.upload": "Tải file bài kiểm tra",
  "score.bulk_upsert": "Cập nhật điểm",
  "score.import_excel": "Import điểm từ Excel",
  "payment.create": "Ghi nhận thanh toán",
  "tuition_charge.create": "Tạo khoản học phí",
  "salary_rule.create": "Tạo quy định lương",
  "payroll.create": "Tạo bảng lương",
  "payroll_item.adjust": "Điều chỉnh dòng lương",
  "payroll.paid": "Xác nhận đã trả lương",
  "user.create": "Tạo tài khoản",
  "user.status.update": "Cập nhật trạng thái tài khoản",
  "user_permission.update": "Cập nhật quyền riêng",
  "staff.create": "Tạo nhân sự",
  "staff.update": "Cập nhật nhân sự",
  "staff_attendance.create": "Tạo chấm công nhân sự",
  "staff_attendance.update": "Cập nhật chấm công nhân sự",
  "staff_attendance.delete": "Xóa chấm công nhân sự",
};

const auditEntityLabels: Record<string, string> = {
  user: "Tài khoản",
  student: "Học viên",
  parent: "Phụ huynh",
  class: "Lớp học",
  class_schedule: "Lịch học",
  class_session: "Buổi học",
  student_comment: "Nhận xét học viên",
  exam: "Bài kiểm tra",
  payment: "Thanh toán",
  tuition_charge: "Học phí",
  salary_rule: "Quy định lương",
  payroll: "Bảng lương",
  payroll_item: "Dòng lương",
  staff_profile: "Nhân sự",
  staff_attendance: "Chấm công nhân sự",
  system: "Hệ thống",
};

export function auditActionLabel(action: string) {
  return auditActionLabels[action] ?? action.replace(/[._]/g, " ");
}

export function auditEntityLabel(entityType: string) {
  return auditEntityLabels[entityType] ?? entityType.replace(/_/g, " ");
}
