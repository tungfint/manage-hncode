type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  query?: Record<string, string | undefined>;
};

function hrefFor(
  basePath: string,
  page: number,
  query: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  params.set("page", String(page));

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }

  return `${basePath}?${params.toString()}`;
}

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  query = {},
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
      <span>
        Hiển thị trang {page}/{totalPages}, tổng {total} dòng
      </span>
      <div className="flex items-center gap-2">
        <a
          aria-disabled={page <= 1}
          className="rounded-md border border-zinc-200 px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40"
          href={hrefFor(basePath, Math.max(1, page - 1), query)}
        >
          Trước
        </a>
        <a
          aria-disabled={page >= totalPages}
          className="rounded-md border border-zinc-200 px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40"
          href={hrefFor(basePath, Math.min(totalPages, page + 1), query)}
        >
          Sau
        </a>
      </div>
    </div>
  );
}
