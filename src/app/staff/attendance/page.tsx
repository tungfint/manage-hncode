import {
  createStaffAttendanceAction,
  deleteStaffAttendanceAction,
  updateStaffAttendanceAction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth";
import { formatDate, toSearch } from "@/lib/format";
import {
  staffAttendanceStatusLabels,
  staffTypeLabels,
} from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const STAFF_OPTION_LIMIT = 200;

type StaffAttendancePageProps = {
  searchParams?: Promise<{
    staffUserId?: string;
    status?: string;
    from?: string;
    to?: string;
    created?: string;
    updated?: string;
    deleted?: string;
    error?: string;
  }>;
};

function dateInputValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function parseDateParam(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

export default async function StaffAttendancePage({
  searchParams,
}: StaffAttendancePageProps) {
  const session = await requirePermission("staff_attendance.view");
  const params = await searchParams;
  const staffUserId = toSearch(params?.staffUserId);
  const status = toSearch(params?.status);
  const from = toSearch(params?.from);
  const to = toSearch(params?.to);
  const canManage = can(session, "staff_attendance.manage");
  const fromDate = parseDateParam(from);
  const toDate = parseDateParam(to);

  const [staff, records] = await Promise.all([
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        staffProfile: { isNot: null },
      },
      select: { id: true, name: true, staffProfile: true },
      orderBy: { name: "asc" },
      take: STAFF_OPTION_LIMIT,
    }),
    prisma.staffAttendance.findMany({
      where: {
        ...(staffUserId ? { staffUserId } : {}),
        ...(status ? { status: status as never } : {}),
        ...(fromDate || toDate
          ? {
              workDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      include: {
        staffUser: { include: { staffProfile: true } },
        confirmedBy: true,
      },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      take: 120,
    }),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Chấm công nhân sự"
        description="Theo dõi ngày công, giờ làm, ca làm và trạng thái chấm công của nhân sự ngoài buổi dạy."
      />

      {params?.created || params?.updated || params?.deleted ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {params.deleted
            ? "Đã xóa dòng chấm công."
            : params.updated
              ? "Đã cập nhật dòng chấm công."
              : "Đã tạo dòng chấm công."}
        </div>
      ) : null}

      {params?.error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {params.error === "duplicate"
            ? "Dòng chấm công đã tồn tại cho nhân sự, ngày và ca này. Vui lòng sửa dòng cũ."
            : "Vui lòng kiểm tra lại nhân sự, ngày công và dữ liệu nhập."}
        </div>
      ) : null}

      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_160px_160px_160px_auto]">
        <select
          name="staffUserId"
          defaultValue={staffUserId}
          className="h-10 min-w-0 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
        >
          <option value="">Tất cả nhân sự</option>
          {staff.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.staffProfile ? ` · ${staffTypeLabels[item.staffProfile.staffType]}` : ""}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(staffAttendanceStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          name="from"
          type="date"
          defaultValue={from}
          className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
        />
        <input
          name="to"
          type="date"
          defaultValue={to}
          className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
        />
        <button
          type="submit"
          className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
        >
          Lọc
        </button>
      </form>

      {canManage ? (
        <form
          action={createStaffAttendanceAction}
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <h2 className="mb-3 font-semibold">Tạo dòng chấm công</h2>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <select
              name="staffUserId"
              required
              className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
            >
              {staff.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              name="workDate"
              type="date"
              required
              className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
            />
            <input
              name="shiftName"
              placeholder="Ca làm"
              className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
            />
            <input
              name="checkIn"
              type="time"
              className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
            />
            <input
              name="checkOut"
              type="time"
              className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
            />
            <input
              name="hoursCount"
              type="number"
              min="0"
              step="0.25"
              placeholder="Số giờ"
              className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
            />
            <input
              name="workName"
              placeholder="Công việc"
              className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500 md:col-span-2"
            />
            <select
              name="status"
              defaultValue="PRESENT"
              className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
            >
              {Object.entries(staffAttendanceStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              name="note"
              placeholder="Ghi chú"
              className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500 md:col-span-2"
            />
            <button
              type="submit"
              className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Lưu
            </button>
          </div>
        </form>
      ) : null}

      <div className="max-w-full overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nhân sự</th>
              <th className="px-4 py-3 font-medium">Ngày</th>
              <th className="px-4 py-3 font-medium">Ca / công việc</th>
              <th className="px-4 py-3 font-medium">Giờ</th>
              <th className="px-4 py-3 font-medium">Số giờ</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Xác nhận</th>
              <th className="px-4 py-3 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {records.map((record) => (
              <tr key={record.id}>
                <td className="px-4 py-4">
                  <p className="font-medium">{record.staffUser.name}</p>
                  <p className="text-xs text-zinc-500">
                    {record.staffUser.staffProfile
                      ? staffTypeLabels[record.staffUser.staffProfile.staffType]
                      : "-"}
                  </p>
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {formatDate(record.workDate)}
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  <p>{record.shiftName ?? "-"}</p>
                  <p className="text-xs text-zinc-500">{record.workName ?? "-"}</p>
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {record.checkIn ?? "--:--"} - {record.checkOut ?? "--:--"}
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {record.hoursCount.toString()}
                </td>
                <td className="px-4 py-4">
                  <Badge
                    tone={
                      record.status === "PRESENT"
                        ? "success"
                        : record.status === "UNEXCUSED"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {staffAttendanceStatusLabels[record.status]}
                  </Badge>
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {record.confirmedBy?.name ?? "-"}
                </td>
                <td className="px-4 py-4">
                  {canManage ? (
                    <div className="flex items-center gap-3">
                      <details>
                        <summary className="cursor-pointer font-medium text-[#08a7dc]">
                          Sửa
                        </summary>
                        <form
                          action={updateStaffAttendanceAction.bind(null, record.id)}
                          className="mt-3 grid w-[520px] gap-2 rounded-md border border-zinc-200 bg-white p-3 shadow-sm sm:grid-cols-2"
                        >
                          <select
                            name="staffUserId"
                            defaultValue={record.staffUserId}
                            className="h-9 rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-teal-500"
                          >
                            {staff.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          <input
                            name="workDate"
                            type="date"
                            defaultValue={dateInputValue(record.workDate)}
                            className="h-9 rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-teal-500"
                          />
                          <input
                            name="shiftName"
                            defaultValue={record.shiftName ?? ""}
                            placeholder="Ca làm"
                            className="h-9 rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-teal-500"
                          />
                          <input
                            name="workName"
                            defaultValue={record.workName ?? ""}
                            placeholder="Công việc"
                            className="h-9 rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-teal-500"
                          />
                          <input
                            name="checkIn"
                            type="time"
                            defaultValue={record.checkIn ?? ""}
                            className="h-9 rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-teal-500"
                          />
                          <input
                            name="checkOut"
                            type="time"
                            defaultValue={record.checkOut ?? ""}
                            className="h-9 rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-teal-500"
                          />
                          <input
                            name="hoursCount"
                            type="number"
                            min="0"
                            step="0.25"
                            defaultValue={record.hoursCount.toString()}
                            className="h-9 rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-teal-500"
                          />
                          <select
                            name="status"
                            defaultValue={record.status}
                            className="h-9 rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-teal-500"
                          >
                            {Object.entries(staffAttendanceStatusLabels).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                          <input
                            name="note"
                            defaultValue={record.note ?? ""}
                            placeholder="Ghi chú"
                            className="h-9 rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-teal-500 sm:col-span-2"
                          />
                          <button
                            type="submit"
                            className="h-9 rounded-md bg-[#17215c] text-sm font-medium text-white hover:bg-[#25308d] sm:col-span-2"
                          >
                            Lưu thay đổi
                          </button>
                        </form>
                      </details>
                      <form action={deleteStaffAttendanceAction.bind(null, record.id)}>
                        <ConfirmSubmitButton
                          message="Xóa dòng chấm công này?"
                          className="font-medium text-rose-700 hover:text-rose-800"
                        >
                          Xóa
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!records.length ? (
          <p className="p-4 text-sm text-zinc-500">
            Chưa có dòng chấm công phù hợp bộ lọc.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
