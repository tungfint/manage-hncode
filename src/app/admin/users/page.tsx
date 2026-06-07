import {
  createUserAction,
  setUserPermissionAction,
  setUserStatusAction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { formatDate, toSearch } from "@/lib/format";
import { staffTypeLabels, userStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type AdminUsersPageProps = {
  searchParams?: Promise<{
    q?: string;
    selected?: string;
    created?: string;
    statusUpdated?: string;
    permissionsUpdated?: string;
  }>;
};

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const session = await requirePermission("user.manage");
  const params = await searchParams;
  const q = toSearch(params?.q);
  const selectedUserId = toSearch(params?.selected);
  const userWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [
    users,
    usersCount,
    roles,
    selectedUser,
    permissions,
    scopeClasses,
    scopeStudents,
    scopeSessions,
    scopeBranches,
  ] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      include: {
        roles: { include: { role: true } },
        staffProfile: true,
        _count: { select: { permissions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.count({ where: userWhere }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    selectedUserId
      ? prisma.user.findUnique({
          where: { id: selectedUserId },
          include: {
            roles: { include: { role: true } },
            permissions: { include: { permission: true } },
            staffProfile: true,
          },
        })
      : Promise.resolve(null),
    selectedUserId
      ? prisma.permission.findMany({ orderBy: { code: "asc" } })
      : Promise.resolve([]),
    selectedUserId
      ? prisma.courseClass.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 80,
        })
      : Promise.resolve([]),
    selectedUserId
      ? prisma.student.findMany({
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
          take: 80,
        })
      : Promise.resolve([]),
    selectedUserId
      ? prisma.classSession.findMany({
          select: {
            id: true,
            sessionDate: true,
            courseClass: { select: { name: true } },
          },
          orderBy: { sessionDate: "desc" },
          take: 80,
        })
      : Promise.resolve([]),
    selectedUserId
      ? prisma.branch.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 80,
        })
      : Promise.resolve([]),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Tài khoản & quyền"
        description="Danh sách tài khoản được tải gọn. Chỉ mở phân quyền riêng khi thật sự cần chỉnh."
      />

      {params?.created || params?.statusUpdated || params?.permissionsUpdated ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã cập nhật thông tin tài khoản.
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <form className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <label className="min-w-[260px] flex-1">
              <span className="text-sm font-medium text-slate-700">
                Tìm tài khoản
              </span>
              <input
                name="q"
                defaultValue={q}
                placeholder="Tên, email hoặc số điện thoại"
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
            <button
              type="submit"
              className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
            >
              Tìm kiếm
            </button>
            {q ? (
              <a
                href="/admin/users"
                className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
              >
                Xóa lọc
              </a>
            ) : null}
          </form>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Danh sách tài khoản
                </h2>
                <p className="text-sm text-slate-500">
                  Hiển thị {users.length}/{usersCount} tài khoản phù hợp.
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Mỗi lần chỉ tải tối đa 50 tài khoản để trang nhẹ hơn.
              </p>
            </div>
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tài khoản</th>
                  <th className="px-4 py-3 font-medium">Vai trò</th>
                  <th className="px-4 py-3 font-medium">Loại nhân sự</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Quyền riêng</th>
                  <th className="px-4 py-3 font-medium">Ngày tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={
                      user.id === selectedUserId ? "bg-[#fff9d8]" : "hover:bg-slate-50"
                    }
                  >
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-950">{user.name}</p>
                      <p className="text-xs text-slate-500">
                        {user.email ?? "-"} · {user.phone ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {user.roles.map((item) => item.role.name).join(", ") || "-"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {user.staffProfile
                        ? staffTypeLabels[user.staffProfile.staffType]
                        : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <form
                        action={setUserStatusAction.bind(null, user.id)}
                        className="flex items-center gap-2"
                      >
                        <select
                          name="status"
                          defaultValue={user.status}
                          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#08a7dc]"
                        >
                          {Object.entries(userStatusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium hover:bg-slate-50"
                        >
                          Lưu
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Badge tone={user._count.permissions ? "info" : "default"}>
                          {user._count.permissions} quyền
                        </Badge>
                        <a
                          href={`/admin/users?${new URLSearchParams({
                            ...(q ? { q } : {}),
                            selected: user.id,
                          }).toString()}#permissions`}
                          className="text-sm font-medium text-[#08a7dc] hover:text-[#17215c]"
                        >
                          Chỉnh
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(user.createdAt)}
                    </td>
                  </tr>
                ))}
                {!users.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      Không tìm thấy tài khoản phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <section
            id="permissions"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Quyền riêng từng tài khoản
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Phần này chỉ tải khi chọn một tài khoản, giúp trang nhẹ hơn.
                </p>
              </div>
              {selectedUser ? (
                <Badge tone="info">{selectedUser.name}</Badge>
              ) : null}
            </div>

            {!selectedUser ? (
              <div className="mt-4 rounded-md border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                Bấm <span className="font-medium">Chỉnh</span> ở một tài khoản
                trong bảng để cấp thêm hoặc thu hồi quyền riêng.
              </div>
            ) : (
              <div className="mt-4">
                <datalist id="permission-scope-options">
                  {scopeClasses.map((item) => (
                    <option key={`class-${item.id}`} value={item.id}>
                      Lớp: {item.name}
                    </option>
                  ))}
                  {scopeStudents.map((item) => (
                    <option key={`student-${item.id}`} value={item.id}>
                      Học viên: {item.fullName}
                    </option>
                  ))}
                  {scopeSessions.map((item) => (
                    <option key={`session-${item.id}`} value={item.id}>
                      Buổi học: {item.courseClass.name} -{" "}
                      {formatDate(item.sessionDate)}
                    </option>
                  ))}
                  {scopeBranches.map((item) => (
                    <option key={`branch-${item.id}`} value={item.id}>
                      Cơ sở: {item.name}
                    </option>
                  ))}
                </datalist>

                <div className="mb-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                  <p>
                    Vai trò:{" "}
                    <span className="font-medium text-slate-900">
                      {selectedUser.roles.map((item) => item.role.name).join(", ") ||
                        "-"}
                    </span>
                  </p>
                  <p className="mt-1">
                    Quyền riêng hiện có:{" "}
                    <span className="font-medium text-slate-900">
                      {selectedUser.permissions.length}
                    </span>
                  </p>
                </div>

                <div className="max-h-[520px] overflow-y-auto rounded-md border border-slate-200">
                  <div className="grid min-w-[820px] grid-cols-[1fr_130px_132px_180px_64px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                    <span>Quyền</span>
                    <span>Chế độ</span>
                    <span>Phạm vi</span>
                    <span>ID phạm vi</span>
                    <span></span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {permissions.map((permission) => {
                      const override = selectedUser.permissions.find(
                        (item) =>
                          item.permissionId === permission.id &&
                          item.scopeType === "GLOBAL",
                      );

                      return (
                        <form
                          key={permission.id}
                          action={setUserPermissionAction.bind(
                            null,
                            selectedUser.id,
                          )}
                          className="grid min-w-[820px] grid-cols-[1fr_130px_132px_180px_64px] items-center gap-2 px-3 py-2"
                        >
                          <input
                            type="hidden"
                            name="permissionId"
                            value={permission.id}
                          />
                          <div className="min-w-0">
                            <span
                              className="block truncate text-xs font-medium text-slate-900"
                              title={permission.name}
                            >
                              {permission.name}
                            </span>
                            {permission.description ? (
                              <p
                                className="truncate text-[11px] text-slate-500"
                                title={permission.description}
                              >
                                {permission.description}
                              </p>
                            ) : null}
                          </div>
                          <select
                            name="mode"
                            defaultValue={override?.effect ?? "ROLE_DEFAULT"}
                            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#08a7dc]"
                          >
                            <option value="ROLE_DEFAULT">Theo vai trò</option>
                            <option value="ALLOW">Cấp thêm</option>
                            <option value="DENY">Thu hồi</option>
                          </select>
                          <select
                            name="scopeType"
                            defaultValue="GLOBAL"
                            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#08a7dc]"
                          >
                            <option value="GLOBAL">Toàn hệ thống</option>
                            <option value="CLASS">Theo lớp</option>
                            <option value="STUDENT">Theo học viên</option>
                            <option value="SESSION">Theo buổi</option>
                            <option value="BRANCH">Theo cơ sở</option>
                          </select>
                          <input
                            name="scopeId"
                            list="permission-scope-options"
                            placeholder="Để trống nếu toàn hệ thống"
                            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#08a7dc]"
                          />
                          <button
                            type="submit"
                            className="h-8 rounded-md bg-[#17215c] px-2 text-xs font-medium text-white"
                          >
                            Lưu
                          </button>
                        </form>
                      );
                    })}
                  </div>
                </div>

                {selectedUser.permissions.some((item) => item.scopeType !== "GLOBAL") ? (
                  <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="mb-1 font-medium text-slate-800">
                      Quyền theo phạm vi đang có
                    </p>
                    <div className="space-y-1">
                      {selectedUser.permissions
                        .filter((item) => item.scopeType !== "GLOBAL")
                        .map((item) => (
                          <p key={item.id}>
                            {item.permission.name} · {item.effect} ·{" "}
                            {item.scopeType} · {item.scopeId}
                          </p>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>

        <form
          action={createUserAction}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 className="mb-4 font-semibold text-slate-950">
            Tạo tài khoản nhanh
          </h2>
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium">Họ tên *</span>
              <input
                name="name"
                required
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email *</span>
              <input
                name="email"
                type="email"
                required
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Số điện thoại</span>
              <input
                name="phone"
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Mật khẩu tạm *</span>
              <input
                name="password"
                type="password"
                minLength={8}
                required
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Loại nhân sự</span>
              <select
                name="staffType"
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              >
                {Object.entries(staffTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Công việc phụ trách</span>
              <input
                name="responsibility"
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Ngân hàng</span>
                <input
                  name="bankName"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Số tài khoản</span>
                <input
                  name="bankAccountNumber"
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium">Trạng thái tài khoản</span>
              <select
                name="status"
                defaultValue="ACTIVE"
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              >
                {Object.entries(userStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Vai trò</span>
              <select
                name="roleId"
                className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="h-10 w-full rounded-md bg-[#17215c] text-sm font-medium text-white hover:bg-[#25308d]"
            >
              Tạo tài khoản
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
