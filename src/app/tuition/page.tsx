import Link from "next/link";
import { createTuitionChargeAction, recordPaymentAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { can, requirePermission } from "@/lib/auth";
import {
  getAccessibleClassIds,
  getAccessibleStudentIds,
} from "@/lib/data-scope";
import { formatCurrency, formatDate, toSearch } from "@/lib/format";
import { paymentMethodLabels, tuitionStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const OPTION_LIMIT = 200;
const CLASS_STUDENT_LIMIT = 200;

type TuitionPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    classId?: string;
    studentId?: string;
    created?: string;
    paid?: string;
  }>;
};

function decimalToNumber(value: unknown) {
  return Number(value?.toString() ?? 0);
}

export default async function TuitionPage({ searchParams }: TuitionPageProps) {
  const session = await requirePermission("tuition.view");
  const params = await searchParams;
  const q = toSearch(params?.q);
  const status = toSearch(params?.status);
  const classId = toSearch(params?.classId);
  const studentId = toSearch(params?.studentId);
  const [accessibleStudentIds, accessibleClassIds] = await Promise.all([
    getAccessibleStudentIds(session, "tuition.view"),
    getAccessibleClassIds(session, "tuition.view"),
  ]);
  const studentScope = accessibleStudentIds
    ? { id: { in: accessibleStudentIds } }
    : {};
  const classScope = accessibleClassIds ? { id: { in: accessibleClassIds } } : {};
  const chargeScope = accessibleStudentIds
    ? { studentId: { in: accessibleStudentIds } }
    : {};

  const [charges, students, classes, selectedStudent, selectedClass] =
    await Promise.all([
      prisma.tuitionCharge.findMany({
        where: {
          ...chargeScope,
          ...(status ? { status: status as never } : {}),
          ...(classId ? { classId } : {}),
          ...(studentId ? { studentId } : {}),
          ...(q
            ? {
                OR: [
                  { student: { fullName: { contains: q, mode: "insensitive" } } },
                  { courseClass: { name: { contains: q, mode: "insensitive" } } },
                  { courseClass: { classCode: { contains: q, mode: "insensitive" } } },
                ],
              }
            : {}),
        },
        include: {
          student: true,
          courseClass: true,
          payments: { orderBy: { paymentDate: "desc" }, include: { receivedBy: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 100,
      }),
      prisma.student.findMany({
        where: {
          ...studentScope,
          ...(classId
            ? { enrollments: { some: { classId, status: "ACTIVE" } } }
            : {}),
        },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
        take: OPTION_LIMIT,
      }),
      prisma.courseClass.findMany({
        where: classScope,
        select: { id: true, classCode: true, name: true },
        orderBy: { name: "asc" },
        take: OPTION_LIMIT,
      }),
      studentId
        ? prisma.student.findFirst({
            where: {
              id: studentId,
              ...studentScope,
            },
            include: {
              enrollments: {
                include: {
                  courseClass: {
                    include: {
                      sessions: {
                        where: { status: "COMPLETED" },
                        select: { id: true },
                      },
                    },
                  },
                },
              },
            },
          })
        : null,
      classId
        ? prisma.courseClass.findFirst({
            where: {
              id: classId,
              ...classScope,
            },
            include: {
              sessions: {
                where: { status: "COMPLETED" },
                select: { id: true },
              },
              students: {
                where: { status: "ACTIVE" },
                include: { student: true },
                orderBy: { joinedAt: "desc" },
                take: CLASS_STUDENT_LIMIT,
              },
            },
          })
        : null,
    ]);

  const selectedCharges = charges.filter((charge) =>
    studentId ? charge.studentId === studentId : true,
  );
  const selectedDue = selectedCharges.reduce(
    (sum, charge) => sum + decimalToNumber(charge.amountDue),
    0,
  );
  const selectedPaid = selectedCharges.reduce(
    (sum, charge) => sum + decimalToNumber(charge.amountPaid),
    0,
  );
  const suggestedAmount =
    selectedClass?.tuitionMode === "PER_SESSION_ACTUAL"
      ? decimalToNumber(selectedClass.tuitionPerSession) *
        selectedClass.sessions.length
      : selectedClass?.tuitionMode === "PER_SESSION_TOTAL"
        ? decimalToNumber(selectedClass.tuitionPerSession) *
          (selectedClass.totalSessions ?? 0)
        : decimalToNumber(selectedClass?.tuitionFee);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Học phí"
        description="Chọn lớp, chọn học viên, kiểm tra công nợ và ghi nhận thanh toán."
        action={
          <Link
            href="/tuition/class"
            className="inline-flex h-10 items-center rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
          >
            Học phí theo lớp
          </Link>
        }
      />
      {params?.created ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã tạo khoản học phí.
        </div>
      ) : null}
      {params?.paid ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã ghi nhận thanh toán.
        </div>
      ) : null}

      <SearchFilter
        q={q}
        status={status}
        placeholder="Tìm theo học viên, tên lớp hoặc mã lớp"
        statusOptions={Object.entries(tuitionStatusLabels).map(([value, label]) => ({
          value,
          label,
        }))}
      />

      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_auto]">
        <select
          name="classId"
          defaultValue={classId}
          className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
        >
          <option value="">Tất cả lớp</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.classCode} · {item.name}
            </option>
          ))}
        </select>
        <select
          name="studentId"
          defaultValue={studentId}
          className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
        >
          <option value="">Tất cả học viên</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.fullName}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
        >
          Xem chi tiết
        </button>
      </form>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {selectedStudent || selectedClass ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-zinc-500">Phải thu</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatCurrency(selectedDue)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-zinc-500">Đã thu</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatCurrency(selectedPaid)}
                </p>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-[#fff8d7] p-4 shadow-sm">
                <p className="text-sm text-zinc-600">Gợi ý theo lớp</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatCurrency(suggestedAmount)}
                </p>
              </div>
            </div>
          ) : null}

          {selectedClass ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">
                    Báo cáo học phí lớp {selectedClass.classCode}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {selectedClass.name} · Đã học {selectedClass.sessions.length} buổi
                  </p>
                </div>
                <a
                  href={`/reports/learning?classId=${selectedClass.id}`}
                  className="text-sm font-medium text-[#08a7dc] hover:text-[#17215c]"
                >
                  Xem học tập
                </a>
              </div>
              <div className="mt-3 max-w-full overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-zinc-50 text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Học viên</th>
                      <th className="px-3 py-2 font-medium">Khoản thu</th>
                      <th className="px-3 py-2 font-medium">Phải thu</th>
                      <th className="px-3 py-2 font-medium">Đã thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {selectedClass.students.map((enrollment) => {
                      const studentCharges = charges.filter(
                        (charge) =>
                          charge.studentId === enrollment.studentId &&
                          charge.classId === selectedClass.id,
                      );
                      const due = studentCharges.reduce(
                        (sum, charge) => sum + decimalToNumber(charge.amountDue),
                        0,
                      );
                      const paid = studentCharges.reduce(
                        (sum, charge) => sum + decimalToNumber(charge.amountPaid),
                        0,
                      );

                      return (
                        <tr key={enrollment.id}>
                          <td className="px-3 py-2 font-medium">
                            {enrollment.student.fullName}
                          </td>
                          <td className="px-3 py-2 text-zinc-600">
                            {studentCharges.length}
                          </td>
                          <td className="px-3 py-2 text-zinc-600">
                            {formatCurrency(due)}
                          </td>
                          <td className="px-3 py-2 text-zinc-600">
                            {formatCurrency(paid)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="max-w-full overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Học viên</th>
                  <th className="px-4 py-3 font-medium">Lớp</th>
                  <th className="px-4 py-3 font-medium">Phải thu</th>
                  <th className="px-4 py-3 font-medium">Đã thu</th>
                  <th className="px-4 py-3 font-medium">Hạn</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Thu nhanh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {charges.map((charge) => {
                  const pay = recordPaymentAction.bind(null, charge.id);
                  const remaining =
                    decimalToNumber(charge.amountDue) -
                    decimalToNumber(charge.amountPaid);

                  return (
                    <tr key={charge.id}>
                      <td className="px-4 py-4 font-medium">
                        {charge.student.fullName}
                      </td>
                      <td className="px-4 py-4 text-zinc-600">
                        {charge.courseClass
                          ? `${charge.courseClass.classCode} · ${charge.courseClass.name}`
                          : "-"}
                      </td>
                      <td className="px-4 py-4 text-zinc-600">
                        {formatCurrency(charge.amountDue)}
                      </td>
                      <td className="px-4 py-4 text-zinc-600">
                        {formatCurrency(charge.amountPaid)}
                      </td>
                      <td className="px-4 py-4 text-zinc-600">
                        {formatDate(charge.dueDate)}
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          tone={
                            charge.status === "PAID"
                              ? "success"
                              : charge.status === "OVERDUE"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {tuitionStatusLabels[charge.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        {can(session, "payment.manage") &&
                        charge.status !== "PAID" ? (
                          <form action={pay} className="flex min-w-[320px] gap-2">
                            <input
                              name="amount"
                              type="number"
                              min="0"
                              defaultValue={Math.max(remaining, 0)}
                              placeholder="Số tiền"
                              required
                              className="h-9 w-28 rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-teal-500"
                            />
                            <select
                              name="method"
                              className="h-9 rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-teal-500"
                            >
                              {Object.entries(paymentMethodLabels).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                            <ConfirmSubmitButton
                              message={`Xác nhận thu ${formatCurrency(Math.max(remaining, 0))} cho ${charge.student.fullName}?`}
                              className="h-9 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white hover:bg-zinc-800"
                            >
                              Thu
                            </ConfirmSubmitButton>
                          </form>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedCharges.length ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 font-semibold">Lịch sử thanh toán</h2>
              <div className="space-y-3">
                {selectedCharges.flatMap((charge) =>
                  charge.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    >
                      <p className="font-medium">
                        {formatCurrency(payment.amount)} ·{" "}
                        {paymentMethodLabels[payment.method]}
                      </p>
                      <p className="text-zinc-500">
                        {formatDate(payment.paymentDate)} ·{" "}
                        {payment.receivedBy?.name ?? "Chưa ghi nhận người thu"}
                      </p>
                      {payment.note ? (
                        <p className="mt-1 text-zinc-600">{payment.note}</p>
                      ) : null}
                    </div>
                  )),
                )}
              </div>
            </div>
          ) : null}
        </div>

        {can(session, "tuition.manage") && (selectedStudent || selectedClass) ? (
          <form
            action={createTuitionChargeAction}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <h2 className="mb-4 font-semibold">Tạo khoản phải thu</h2>
            <div className="space-y-3">
              <select
                name="studentId"
                defaultValue={studentId}
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName}
                  </option>
                ))}
              </select>
              <select
                name="classId"
                defaultValue={classId}
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              >
                <option value="">Không gắn lớp</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.classCode} · {item.name}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="amountDue"
                  type="number"
                  min="0"
                  required
                  defaultValue={suggestedAmount || ""}
                  placeholder="Số tiền phải thu"
                  className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                />
                <input
                  name="discountAmount"
                  type="number"
                  min="0"
                  placeholder="Giảm giá"
                  className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                />
              </div>
              <input
                name="dueDate"
                type="date"
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
              <textarea
                name="note"
                rows={3}
                placeholder="Ghi chú"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                className="h-10 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Tạo khoản thu
              </button>
            </div>
          </form>
        ) : can(session, "tuition.manage") ? (
          <div className="rounded-lg border border-yellow-200 bg-[#fff8d7] p-4 text-sm text-zinc-700 shadow-sm">
            Chọn một lớp hoặc một học viên ở bộ lọc phía trên trước khi tạo khoản
            phải thu. Cách này giúp tránh tạo nhầm học phí cho sai người hoặc sai
            lớp.
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
