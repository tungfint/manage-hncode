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
  searchParams?: Promise<{ q?: string; created?: string }>;
};

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const session = await requirePermission("user.manage");
  const params = await searchParams;
  const q = toSearch(params?.q);
  const [
    users,
    roles,
    permissions,
    scopeClasses,
    scopeStudents,
    scopeSessions,
    scopeBranches,
  ] = await Promise.all([
    prisma.user.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      include: {
        roles: { include: { role: true } },
        permissions: { include: { permission: true } },
        staffProfile: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.permission.findMany({ orderBy: { code: "asc" } }),
    prisma.courseClass.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.student.findMany({
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 100,
    }),
    prisma.classSession.findMany({
      select: {
        id: true,
        sessionDate: true,
        courseClass: { select: { name: true } },
      },
      orderBy: { sessionDate: "desc" },
      take: 100,
    }),
    prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Tài khoản"
        description="Tạo, xem và gán vai trò mặc định cho tài khoản nhân sự."
      />

      {params?.created ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã tạo tài khoản mới.
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
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
              Buổi học: {item.courseClass.name} - {formatDate(item.sessionDate)}
            </option>
          ))}
          {scopeBranches.map((item) => (
            <option key={`branch-${item.id}`} value={item.id}>
              Cơ sở: {item.name}
            </option>
          ))}
        </datalist>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tài khoản</th>
                <th className="px-4 py-3 font-medium">Vai trò</th>
                <th className="px-4 py-3 font-medium">Loại nhân sự</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Quyền riêng</th>
                <th className="px-4 py-3 font-medium">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-4">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-zinc-500">
                      {user.email ?? "-"} · {user.phone ?? "-"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {user.roles.map((item) => item.role.name).join(", ") || "-"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
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
                        className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-[#08a7dc]"
                      >
                        {Object.entries(userStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50"
                      >
                        Lưu
                      </button>
                    </form>
                    <Badge tone={user.status === "ACTIVE" ? "success" : "warning"}>
                      {userStatusLabels[user.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    <details>
                      <summary className="cursor-pointer font-medium text-[#08a7dc]">
                        Cấp/thu hồi
                      </summary>
                      <div className="mt-3 grid max-h-80 w-[360px] gap-2 overflow-y-auto rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
                        {permissions.map((permission) => {
                          const override = user.permissions.find(
                            (item) =>
                              item.permissionId === permission.id &&
                              item.scopeType === "GLOBAL",
                          );

                          return (
                            <form
                              key={permission.id}
                              action={setUserPermissionAction.bind(null, user.id)}
                              className="grid grid-cols-[1fr_112px_108px_150px_48px] items-center gap-2"
                            >
                              <input
                                type="hidden"
                                name="permissionId"
                                value={permission.id}
                              />
                              <span className="truncate text-xs" title={permission.name}>
                                {permission.name}
                              </span>
                              <select
                                name="mode"
                                defaultValue={override?.effect ?? "ROLE_DEFAULT"}
                                className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-[#08a7dc]"
                              >
                                <option value="ROLE_DEFAULT">Theo vai trò</option>
                                <option value="ALLOW">Cấp thêm</option>
                                <option value="DENY">Thu hồi</option>
                              </select>
                              <select
                                name="scopeType"
                                defaultValue="GLOBAL"
                                className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-[#08a7dc]"
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
                                placeholder="ID phạm vi"
                                className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-[#08a7dc]"
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
                        {user.permissions.some((item) => item.scopeType !== "GLOBAL") ? (
                          <div className="mt-2 rounded-md bg-zinc-50 p-2 text-xs text-zinc-600">
                            <p className="mb-1 font-medium text-zinc-800">
                              Quyền theo phạm vi đang có
                            </p>
                            <div className="space-y-1">
                              {user.permissions
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
                    </details>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {formatDate(user.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          action={createUserAction}
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <h2 className="mb-4 font-semibold">Tạo tài khoản nhanh</h2>
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium">Họ tên *</span>
              <input
                name="name"
                required
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email *</span>
              <input
                name="email"
                type="email"
                required
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Số điện thoại</span>
              <input
                name="phone"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Mật khẩu tạm *</span>
              <input
                name="password"
                type="password"
                minLength={8}
                required
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Loại nhân sự</span>
              <select
                name="staffType"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
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
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Ngân hàng</span>
                <input
                  name="bankName"
                  className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Số tài khoản</span>
                <input
                  name="bankAccountNumber"
                  className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium">Trạng thái tài khoản</span>
              <select
                name="status"
                defaultValue="ACTIVE"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
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
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-teal-500"
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
              className="h-10 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Tạo tài khoản
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
