import { Plus } from "lucide-react";
import Link from "next/link";
import { deleteParentAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilter } from "@/components/ui/search-filter";
import { can, requirePermission } from "@/lib/auth";
import { toInt, toSearch } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const pageSize = 10;

type ParentsPageProps = {
  searchParams?: Promise<{
    q?: string;
    page?: string;
    created?: string;
    updated?: string;
    deleted?: string;
  }>;
};

export default async function ParentsPage({ searchParams }: ParentsPageProps) {
  const session = await requirePermission("parent.view");
  const params = await searchParams;
  const q = toSearch(params?.q);
  const page = toInt(params?.page);
  const where = q
    ? {
        OR: [
          { fullName: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [parents, total] = await Promise.all([
    prisma.parent.findMany({
      where,
      include: {
        students: {
          include: {
            student: true,
          },
        },
      },
      orderBy: { fullName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.parent.count({ where }),
  ]);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Phụ huynh"
        description="Tra cứu thông tin liên hệ và học viên liên kết."
        action={
          can(session, "parent.create") ? (
            <Link
              href="/parents/new"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              <Plus size={17} aria-hidden="true" />
              Thêm phụ huynh
            </Link>
          ) : null
        }
      />

      {params?.created ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã thêm phụ huynh mới.
        </div>
      ) : null}
      {params?.updated ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã cập nhật phụ huynh.
        </div>
      ) : null}
      {params?.deleted ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã xóa phụ huynh.
        </div>
      ) : null}

      <SearchFilter q={q} placeholder="Tìm theo tên, SĐT, email" />

      {parents.length ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Phụ huynh</th>
                <th className="px-4 py-3 font-medium">Liên hệ</th>
                <th className="px-4 py-3 font-medium">Học viên</th>
                <th className="px-4 py-3 font-medium">Ghi chú</th>
                <th className="px-4 py-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {parents.map((parent) => (
                <tr key={parent.id}>
                  <td className="px-4 py-4 font-medium">{parent.fullName}</td>
                  <td className="px-4 py-4 text-zinc-600">
                    <p>{parent.phone ?? "-"}</p>
                    <p className="text-xs text-zinc-500">{parent.email ?? "-"}</p>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {parent.students
                      .map(
                        (item) =>
                          `${item.student.fullName} (${item.relationship})`,
                      )
                      .join(", ") || "-"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">{parent.note ?? "-"}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {can(session, "parent.update") ? (
                        <Link
                          href={`/parents/${parent.id}/edit`}
                          className="font-medium text-[#08a7dc] hover:text-[#17215c]"
                        >
                          Sửa
                        </Link>
                      ) : null}
                      {can(session, "parent.delete") ? (
                        <form action={deleteParentAction.bind(null, parent.id)}>
                          <ConfirmSubmitButton
                            message={`Xóa phụ huynh ${parent.fullName}?`}
                            className="font-medium text-rose-700 hover:text-rose-800"
                          >
                            Xóa
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Chưa có phụ huynh phù hợp" />
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/parents"
        query={{ q }}
      />
    </AppShell>
  );
}
