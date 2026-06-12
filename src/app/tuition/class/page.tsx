import Link from "next/link";
import {
  createClassTuitionChargesAction,
  recordPaymentAction,
  sendClassTuitionEmailsAction,
  updateTuitionPaymentSettingAction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { BulkEmailControls } from "@/components/bulk-email-controls";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth";
import { getAccessibleClassIds } from "@/lib/data-scope";
import { formatCurrency, formatDate, toSearch } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type ClassTuitionPageProps = {
  searchParams?: Promise<{
    classId?: string;
    bankCode?: string;
    bankAccount?: string;
    accountName?: string;
    created?: string;
    skipped?: string;
    paid?: string;
    settingsUpdated?: string;
    emailSent?: string;
    emailSkipped?: string;
    emailFailed?: string;
    emailError?: string;
  }>;
};

const defaultMessageTemplate = [
  "Kính gửi phụ huynh học viên {{studentName}},",
  "",
  "HNCode thông báo khoản học phí lớp {{classCode}} - {{className}}.",
  "Nội dung: {{content}}",
  "Số tiền cần thanh toán: {{amount}}",
  "Hạn đóng: {{dueDate}}",
  "Nội dung chuyển khoản: {{qrContent}}",
  "",
  "Sau khi chuyển khoản, phụ huynh vui lòng gửi lại ảnh xác nhận để trung tâm đối soát.",
  "Trân trọng.",
].join("\n");

const templateVariableDocs = [
  {
    code: "{{studentName}}",
    label: "Tên học viên",
    example: "Nguyễn Minh Anh",
  },
  {
    code: "{{classCode}}",
    label: "Mã lớp",
    example: "PYTHON-KID-01",
  },
  {
    code: "{{className}}",
    label: "Tên lớp học",
    example: "Python thiếu nhi cơ bản",
  },
  {
    code: "{{content}}",
    label: "Nội dung khoản thu",
    example: "Học phí tháng 06/2026",
  },
  {
    code: "{{amount}}",
    label: "Số tiền cần đóng",
    example: "2.800.000 đ",
  },
  {
    code: "{{dueDate}}",
    label: "Hạn đóng học phí",
    example: "20/06/2026",
  },
  {
    code: "{{qrContent}}",
    label: "Nội dung chuyển khoản để đối soát",
    example: "HNCODE-cm123...",
  },
  {
    code: "{{qrUrl}}",
    label: "Link ảnh QR thanh toán",
    example: "Dùng khi muốn dán link QR trong nội dung",
  },
];

function toMoney(value: unknown) {
  return Number(value?.toString?.() ?? value ?? 0);
}

function netDue(charge: {
  amountDue: unknown;
  amountPaid: unknown;
  discountAmount: unknown;
}) {
  return Math.max(
    toMoney(charge.amountDue) - toMoney(charge.discountAmount) - toMoney(charge.amountPaid),
    0,
  );
}

function vietQrUrl(input: {
  bankCode: string;
  bankAccount: string;
  accountName: string;
  amount: number;
  content: string;
}) {
  if (!input.bankCode || !input.bankAccount || input.amount <= 0) {
    return null;
  }

  const base = `https://img.vietqr.io/image/${encodeURIComponent(
    input.bankCode,
  )}-${encodeURIComponent(input.bankAccount)}-compact2.png`;
  const params = new URLSearchParams({
    amount: String(Math.round(input.amount)),
    addInfo: input.content,
    accountName: input.accountName,
  });

  return `${base}?${params.toString()}`;
}

function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    return values[key] ?? "";
  });
}

export default async function ClassTuitionPage({
  searchParams,
}: ClassTuitionPageProps) {
  const session = await requirePermission("tuition.view");
  const params = await searchParams;
  const classId = toSearch(params?.classId);
  const accessibleClassIds = await getAccessibleClassIds(session, "tuition.view");
  const classScope = accessibleClassIds ? { id: { in: accessibleClassIds } } : {};

  const [setting, classes, selectedClass, charges] = await Promise.all([
    prisma.tuitionPaymentSetting.findUnique({ where: { id: "default" } }),
    prisma.courseClass.findMany({
      where: classScope,
      select: {
        id: true,
        classCode: true,
        name: true,
        tuitionFee: true,
        tuitionMode: true,
        tuitionPerSession: true,
        totalSessions: true,
      },
      orderBy: { name: "asc" },
      take: 200,
    }),
    classId
      ? prisma.courseClass.findFirst({
          where: { id: classId, ...classScope },
          include: {
            sessions: {
              where: { status: "COMPLETED" },
              select: { id: true },
            },
            students: {
              where: { status: "ACTIVE" },
              include: {
                student: {
                  include: {
                    parents: {
                      include: { parent: true },
                      orderBy: { id: "asc" },
                    },
                  },
                },
              },
              orderBy: { joinedAt: "asc" },
            },
          },
        })
      : Promise.resolve(null),
    classId
      ? prisma.tuitionCharge.findMany({
          where: { classId },
          include: {
            payments: {
              include: { receivedBy: true },
              orderBy: { paymentDate: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const bankCode =
    toSearch(params?.bankCode) ||
    setting?.bankCode ||
    process.env.HNCODE_QR_BANK_CODE ||
    "";
  const bankAccount =
    toSearch(params?.bankAccount) ||
    setting?.bankAccount ||
    process.env.HNCODE_QR_BANK_ACCOUNT ||
    "";
  const accountName =
    toSearch(params?.accountName) ||
    setting?.accountName ||
    process.env.HNCODE_QR_ACCOUNT_NAME ||
    "HNCode";
  const messageTemplate =
    setting?.messageTemplate || defaultMessageTemplate;

  const suggestedAmount =
    selectedClass?.tuitionMode === "PER_SESSION_ACTUAL"
      ? toMoney(selectedClass.tuitionPerSession) * selectedClass.sessions.length
      : selectedClass?.tuitionMode === "PER_SESSION_TOTAL"
        ? toMoney(selectedClass.tuitionPerSession) *
          (selectedClass.totalSessions ?? 0)
        : toMoney(selectedClass?.tuitionFee);
  const currentQuery = new URLSearchParams({
    ...(classId ? { classId } : {}),
    ...(bankCode ? { bankCode } : {}),
    ...(bankAccount ? { bankAccount } : {}),
    ...(accountName ? { accountName } : {}),
  }).toString();

  const rows =
    selectedClass?.students.map((enrollment) => {
      const studentCharges = charges.filter(
        (charge) => charge.studentId === enrollment.studentId,
      );
      const openCharge =
        studentCharges.find((charge) => charge.status !== "PAID") ??
        studentCharges[0];
      const totalDue = studentCharges.reduce(
        (sum, charge) => sum + toMoney(charge.amountDue) - toMoney(charge.discountAmount),
        0,
      );
      const totalPaid = studentCharges.reduce(
        (sum, charge) => sum + toMoney(charge.amountPaid),
        0,
      );
      const remaining = Math.max(totalDue - totalPaid, 0);
      const status = !studentCharges.length
        ? "NO_CHARGE"
        : remaining <= 0
          ? "PAID"
          : totalPaid > 0
            ? "PARTIAL"
            : "UNPAID";

      return {
        enrollment,
        student: enrollment.student,
        charges: studentCharges,
        charge: openCharge,
        totalDue,
        totalPaid,
        remaining,
        status,
      };
    }) ?? [];

  const totalDue = rows.reduce((sum, row) => sum + row.totalDue, 0);
  const totalPaid = rows.reduce((sum, row) => sum + row.totalPaid, 0);
  const paidCount = rows.filter((row) => row.status === "PAID").length;
  const unpaidCount = rows.filter(
    (row) => row.status === "UNPAID" || row.status === "NO_CHARGE",
  ).length;
  const partialCount = rows.filter((row) => row.status === "PARTIAL").length;

  return (
    <AppShell session={session}>
      <PageHeader
        title="Danh sách học phí theo lớp"
        description="Tạo khoản học phí hàng loạt, gửi nội dung chuyển khoản và theo dõi đã đóng/chưa đóng theo từng học viên."
        action={
          <Link
            href="/tuition"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Học phí chung
          </Link>
        }
      />

      {params?.created || params?.paid ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {params?.paid
            ? "Đã ghi nhận thanh toán."
            : `Đã tạo ${params.created} khoản học phí. Bỏ qua ${params.skipped ?? 0} học viên.`}
        </div>
      ) : null}
      {params?.settingsUpdated ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã lưu tài khoản thu và mẫu tin nhắn.
        </div>
      ) : null}
      {params?.emailSent || params?.emailError ? (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            params.emailError
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-teal-200 bg-teal-50 text-teal-800"
          }`}
        >
          {params.emailError === "smtp"
            ? "Chưa cấu hình SMTP nên chưa thể gửi mail hàng loạt."
            : params.emailError === "empty"
              ? "Vui lòng chọn ít nhất một khoản học phí để gửi mail."
              : `Đã gửi ${params.emailSent} email, bỏ qua ${params.emailSkipped ?? 0}, lỗi ${params.emailFailed ?? 0}.`}
        </div>
      ) : null}

      {can(session, "tuition.manage") ? (
        <form
          action={updateTuitionPaymentSettingAction}
          className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
        >
          <input
            type="hidden"
            name="redirectTo"
            value={`/tuition/class?${currentQuery}`}
          />
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#fff8d7_0%,#ffffff_58%,#edfaff_100%)] px-4 py-3">
            <h2 className="font-semibold text-slate-950">
              Cấu hình thu học phí
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Lưu tài khoản nhận tiền, mẫu tin nhắn và các biến tự động để dùng
              lại cho mọi lớp.
            </p>
          </div>
          <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Mã ngân hàng
                  </span>
                  <input
                    name="bankCode"
                    defaultValue={bankCode}
                    placeholder="Ví dụ: VCB, ACB, TCB"
                    className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Số tài khoản nhận học phí
                  </span>
                  <input
                    name="bankAccount"
                    defaultValue={bankAccount}
                    placeholder="Nhập số tài khoản"
                    className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Chủ tài khoản
                  </span>
                  <input
                    name="accountName"
                    defaultValue={accountName}
                    placeholder="HNCode"
                    className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Mẫu tin nhắn chung gửi phụ huynh
                </span>
                <textarea
                  name="messageTemplate"
                  rows={10}
                  required
                  defaultValue={messageTemplate}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-[#08a7dc]"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span>
                  Email hàng loạt sẽ tự kèm ảnh QR. Nếu chưa cấu hình SMTP, hệ
                  thống sẽ báo rõ thay vì gửi giả.
                </span>
                <button
                  type="submit"
                  className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
                >
                  Lưu cấu hình
                </button>
              </div>
            </div>

            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Ý nghĩa biến trong mẫu tin nhắn
              </h3>
              <div className="mt-3 space-y-2">
                {templateVariableDocs.map((item) => (
                  <div
                    key={item.code}
                    className="rounded-md border border-slate-200 bg-white p-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code className="rounded bg-[#fff8d7] px-1.5 py-0.5 text-xs font-semibold text-[#17215c]">
                        {item.code}
                      </code>
                      <span className="text-xs font-medium text-slate-700">
                        {item.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Ví dụ: {item.example}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </form>
      ) : null}

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(240px,1fr)_auto] lg:items-end">
        <label>
          <span className="text-sm font-medium text-slate-700">
            Chọn lớp cần lập hoặc xem học phí
          </span>
          <select
            name="classId"
            defaultValue={classId}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#08a7dc]"
          >
            <option value="">Chọn lớp</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.classCode} · {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
        >
          Xem danh sách
        </button>
      </form>

      {!selectedClass ? (
        <EmptyState title="Chọn một lớp để lập danh sách học phí" />
      ) : (
        <section className="space-y-5">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Học viên</p>
              <p className="mt-1 text-2xl font-semibold">{rows.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Đã đóng</p>
              <p className="mt-1 text-2xl font-semibold text-teal-700">
                {paidCount}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Đóng một phần</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">
                {partialCount}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Chưa đóng</p>
              <p className="mt-1 text-2xl font-semibold text-rose-700">
                {unpaidCount}
              </p>
            </div>
            <div className="rounded-lg border border-yellow-200 bg-[#fff8d7] p-4 shadow-sm">
              <p className="text-sm text-slate-600">Còn phải thu</p>
              <p className="mt-1 text-xl font-semibold">
                {formatCurrency(Math.max(totalDue - totalPaid, 0))}
              </p>
            </div>
          </div>

          {can(session, "tuition.manage") ? (
            <form
              action={createClassTuitionChargesAction}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <input type="hidden" name="classId" value={selectedClass.id} />
              <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_220px]">
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Nội dung học phí
                  </span>
                  <input
                    name="content"
                    required
                    defaultValue={`Học phí ${selectedClass.classCode} - ${selectedClass.name}`}
                    className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Hạn đóng
                  </span>
                  <input
                    name="dueDate"
                    type="date"
                    className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
                  />
                </label>
                <label className="mt-7 flex items-start gap-2 text-sm text-slate-600">
                  <input
                    name="skipOpenCharges"
                    type="checkbox"
                    defaultChecked
                    className="mt-1"
                  />
                  Bỏ qua học viên đang còn khoản chưa hoàn tất
                </label>
              </div>

              <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Học viên</th>
                      <th className="px-3 py-2 font-medium">Phụ huynh</th>
                      <th className="px-3 py-2 font-medium">Học phí</th>
                      <th className="px-3 py-2 font-medium">Giảm giá</th>
                      <th className="px-3 py-2 font-medium">Khoản hiện có</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr key={row.student.id}>
                        <td className="px-3 py-2 font-medium">
                          {row.student.fullName}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {row.student.parents[0]?.parent.fullName ?? "-"}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            name={`amount:${row.student.id}`}
                            type="number"
                            min="0"
                            defaultValue={suggestedAmount || ""}
                            className="h-9 w-36 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-[#08a7dc]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            name={`discount:${row.student.id}`}
                            type="number"
                            min="0"
                            placeholder="0"
                            className="h-9 w-32 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-[#08a7dc]"
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {row.charges.length} khoản · còn{" "}
                          {formatCurrency(row.remaining)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <ConfirmSubmitButton
                  message={`Tạo danh sách học phí cho ${rows.length} học viên lớp ${selectedClass.classCode}?`}
                  className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
                >
                  Tạo danh sách học phí
                </ConfirmSubmitButton>
              </div>
            </form>
          ) : null}

          <div
            id="report"
            className="rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">
                    Báo cáo đóng học phí lớp {selectedClass.classCode}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Tổng phải thu {formatCurrency(totalDue)} · đã thu{" "}
                    {formatCurrency(totalPaid)}
                  </p>
                </div>
                {can(session, "tuition.manage") ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <BulkEmailControls />
                    <form id="bulk-tuition-email-form" action={sendClassTuitionEmailsAction}>
                      <input type="hidden" name="classId" value={selectedClass.id} />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={`/tuition/class?${currentQuery}#report`}
                      />
                      <ConfirmSubmitButton
                        message="Gửi email học phí cho các phụ huynh đã chọn?"
                        className="h-9 rounded-md bg-[#17215c] px-3 text-xs font-medium text-white"
                      >
                        Gửi mail đã chọn
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1160px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Học viên</th>
                    <th className="px-4 py-3 font-medium">Chọn gửi</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                    <th className="px-4 py-3 font-medium">Phải thu</th>
                    <th className="px-4 py-3 font-medium">Đã thu</th>
                    <th className="px-4 py-3 font-medium">Còn lại</th>
                    <th className="px-4 py-3 font-medium">Gửi phụ huynh</th>
                    <th className="px-4 py-3 font-medium">QR / xác nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const charge = row.charge;
                    const remaining = charge ? netDue(charge) : row.remaining;
                    const qrContent = charge
                      ? `HNCODE-${charge.id}`
                      : `HNCode ${selectedClass.classCode} ${row.student.fullName}`;
                    const qrUrl = vietQrUrl({
                      bankCode,
                      bankAccount,
                      accountName,
                      amount: remaining,
                      content: qrContent,
                    });
                    const message = renderTemplate(messageTemplate, {
                      studentName: row.student.fullName,
                      classCode: selectedClass.classCode,
                      className: selectedClass.name,
                      content: charge?.note ?? "Học phí",
                      amount: formatCurrency(remaining),
                      dueDate: formatDate(charge?.dueDate),
                      qrContent,
                      qrUrl: qrUrl ?? "",
                    });
                    const parentEmail = row.student.parents.find(
                      (item) => item.parent.email,
                    )?.parent.email;
                    const mailHref = parentEmail
                      ? `mailto:${parentEmail}?${new URLSearchParams({
                          subject: `Thông báo học phí ${selectedClass.classCode}`,
                          body: qrUrl ? `${message}\n\nQR thanh toán: ${qrUrl}` : message,
                        }).toString()}`
                      : null;

                    return (
                      <tr key={row.student.id} className="align-top">
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-950">
                            {row.student.fullName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {parentEmail ?? "Chưa có email phụ huynh"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {charge && parentEmail && remaining > 0 ? (
                            <input
                              form="bulk-tuition-email-form"
                              data-bulk-email-checkbox="true"
                              type="checkbox"
                              name="chargeId"
                              value={charge.id}
                              className="size-4 rounded border-slate-300"
                            />
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            tone={
                              row.status === "PAID"
                                ? "success"
                                : row.status === "PARTIAL"
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {row.status === "PAID"
                              ? "Đã đóng"
                              : row.status === "PARTIAL"
                                ? "Đóng một phần"
                                : row.status === "NO_CHARGE"
                                  ? "Chưa tạo khoản"
                                  : "Chưa đóng"}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatCurrency(row.totalDue)}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatCurrency(row.totalPaid)}
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-900">
                          {formatCurrency(row.remaining)}
                        </td>
                        <td className="px-4 py-4">
                          {charge ? (
                            <div className="flex flex-wrap gap-2">
                              <CopyButton text={message} label="Copy nội dung" />
                              {mailHref ? (
                                <a
                                  href={mailHref}
                                  className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Gửi mail
                                </a>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {charge && remaining > 0 ? (
                            <div className="flex min-w-[320px] gap-3">
                              {qrUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={qrUrl}
                                  alt={`QR học phí ${row.student.fullName}`}
                                  className="size-28 rounded-md border border-slate-200 bg-white object-contain"
                                />
                              ) : (
                                <div className="grid size-28 place-items-center rounded-md border border-dashed border-slate-200 bg-slate-50 p-2 text-center text-xs text-slate-500">
                                  Nhập ngân hàng để tạo QR
                                </div>
                              )}
                              {can(session, "payment.manage") ? (
                                <form
                                  action={recordPaymentAction.bind(null, charge.id)}
                                  className="space-y-2"
                                >
                                  <input
                                    type="hidden"
                                    name="redirectTo"
                                    value={`/tuition/class?${currentQuery}#report`}
                                  />
                                  <input
                                    name="amount"
                                    type="number"
                                    min="0"
                                    defaultValue={remaining}
                                    className="h-9 w-32 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-[#08a7dc]"
                                  />
                                  <select
                                    name="method"
                                    defaultValue="BANK_TRANSFER"
                                    className="h-9 w-32 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-[#08a7dc]"
                                  >
                                    {Object.entries(paymentMethodLabels).map(
                                      ([value, label]) => (
                                        <option key={value} value={value}>
                                          {label}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                  <input
                                    name="note"
                                    defaultValue={qrContent}
                                    className="h-9 w-48 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-[#08a7dc]"
                                  />
                                  <ConfirmSubmitButton
                                    message={`Xác nhận đã thu ${formatCurrency(remaining)} của ${row.student.fullName}?`}
                                    className="h-9 rounded-md bg-[#17215c] px-3 text-xs font-medium text-white"
                                  >
                                    Xác nhận đã đóng
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-400">
                              {charge ? "Đã hoàn tất" : "Chưa có khoản thu"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}
