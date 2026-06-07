import { Search } from "lucide-react";

type Option = {
  label: string;
  value: string;
};

type SearchFilterProps = {
  q?: string;
  status?: string;
  placeholder?: string;
  statusOptions?: Option[];
};

export function SearchFilter({
  q = "",
  status = "",
  placeholder = "Tìm kiếm",
  statusOptions = [],
}: SearchFilterProps) {
  return (
    <form className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:flex-row">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Tìm kiếm</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          size={17}
          aria-hidden="true"
        />
        <input
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-500"
        />
      </label>
      {statusOptions.length ? (
        <select
          name="status"
          defaultValue={status}
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
        >
          <option value="">Tất cả trạng thái</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Lọc
      </button>
    </form>
  );
}
