import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { twMerge } from "tailwind-merge";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
};

type Base = {
  toolbar?: ReactNode;
  empty?: ReactNode;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
};

type Legacy = Base & {
  columns: string[];
  children: ReactNode;
  rows?: never;
};

type Dynamic<T> = Base & {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  children?: never;
};

function getPageItems(page: number, pages: number): Array<number | "ellipsis"> {
  if (pages <= 5) return Array.from({ length: pages }, (_, index) => index + 1);
  const values = new Set([1, pages, page - 1, page, page + 1].filter(value => value >= 1 && value <= pages));
  const sorted = [...values].sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push("ellipsis");
    result.push(value);
  });
  return result;
}

export function DataTable<T>({
  toolbar,
  empty,
  total,
  page = 1,
  pageSize = 10,
  onPageChange,
  ...props
}: Legacy | Dynamic<T>) {
  const dynamic = "rows" in props;
  const dynamicProps = props as Dynamic<T>;
  const legacyProps = props as Legacy;
  const rowCount = dynamic ? dynamicProps.rows.length : undefined;
  const recordCount = total ?? rowCount ?? 0;
  const pages = Math.max(1, Math.ceil(recordCount / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pages);
  const start = recordCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, recordCount);
  const headers = dynamic ? dynamicProps.columns.map(column => column.header) : legacyProps.columns;
  const pageItems = getPageItems(currentPage, pages);

  const navigationButton = "grid size-9 place-items-center rounded-lg border border-[#d9e2d8] bg-white text-[#526b5e] shadow-sm transition hover:border-[#9caf9f] hover:bg-[#f1f6ef] hover:text-[#164c39] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[#d9e2d8] disabled:hover:bg-white";

  return (
    <div className="relative overflow-hidden border border-[#d8dee4] bg-white shadow-[0_6px_20px_rgba(15,23,42,0.06)]">

      {toolbar && (
        <div className="border-b border-[#e2e8e1] bg-[#fafbfc] px-4 py-4 sm:px-5">
          {toolbar}
        </div>
      )}

      <div className="overflow-x-auto [scrollbar-color:#b9c8bd_transparent] [scrollbar-width:thin]">
        <table className="w-full min-w-180 border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-1">
            <tr className="bg-[#f4f6f8]">
              {headers.map((header, index) => (
                <th
                  key={index}
                  scope="col"
                  className="whitespace-nowrap border-b border-[#cfd6dd] px-5 py-5 text-[11px] font-extrabold uppercase tracking-[0.09em] text-[#374151]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr]:transition-colors [&_tr:nth-child(even)]:bg-[#fafbfc] [&_tr:hover]:bg-[#f5f7f8] [&_td]:border-b [&_td]:border-[#e7ece6] [&_td]:px-4 [&_td]:py-3.5 sm:[&_td]:px-5 sm:[&_td]:py-4 [&_td]:text-sm [&_td]:text-[#263b31] [&_tr:last-child_td]:border-b-0">
            {dynamic
              ? dynamicProps.rows.map(row => (
                  <tr key={dynamicProps.rowKey(row)}>
                    {dynamicProps.columns.map(column => (
                      <td key={column.key} className={twMerge("align-middle", column.className)}>
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))
              : legacyProps.children}
          </tbody>
        </table>
      </div>

      {empty}

      {total !== undefined && (
        <div className="flex flex-col items-stretch justify-between gap-3 border-t sm:flex-row sm:items-center sm:gap-4 border-[#dbe4da] bg-[#fafbfc] px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3 text-xs text-[#6a8074]">
            <span className="rounded-full border border-[#d9e4d7] bg-white px-3 py-1.5 font-semibold shadow-sm">
              {recordCount} {recordCount === 1 ? "record" : "records"}
            </span>
            <span className="hidden sm:inline">
              Showing <strong className="text-[#264838]">{start}-{end}</strong>
            </span>
          </div>

          <nav className="flex items-center justify-between gap-1.5 sm:justify-end" aria-label="Table pagination">
            <button type="button" className={navigationButton} disabled={currentPage === 1} onClick={() => onPageChange?.(1)} title="First page" aria-label="First page">
              <ChevronsLeft size={16} />
            </button>
            <button type="button" className={navigationButton} disabled={currentPage === 1} onClick={() => onPageChange?.(currentPage - 1)} title="Previous page" aria-label="Previous page">
              <ChevronLeft size={16} />
            </button>

            <span className="px-2 text-xs font-semibold text-[#526b5e] sm:hidden">{currentPage} / {pages}</span>
            <div className="mx-1 hidden items-center gap-1 sm:flex">
              {pageItems.map((item, index) =>
                item === "ellipsis" ? (
                  <span key={"ellipsis-" + index} className="grid size-9 place-items-center text-sm text-[#8a9b91]">...</span>
                ) : (
                  <button
                    type="button"
                    key={item}
                    onClick={() => onPageChange?.(item)}
                    aria-current={item === currentPage ? "page" : undefined}
                    className={twMerge(
                      "grid size-9 place-items-center rounded-lg border text-xs font-bold transition",
                      item === currentPage
                        ? "border-[#174f3a] bg-[#174f3a] text-white shadow-[0_4px_10px_rgba(23,79,58,0.2)]"
                        : "border-transparent text-[#61766a] hover:border-[#d4ded3] hover:bg-white",
                    )}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>

            <button type="button" className={navigationButton} disabled={currentPage === pages} onClick={() => onPageChange?.(currentPage + 1)} title="Next page" aria-label="Next page">
              <ChevronRight size={16} />
            </button>
            <button type="button" className={navigationButton} disabled={currentPage === pages} onClick={() => onPageChange?.(pages)} title="Last page" aria-label="Last page">
              <ChevronsRight size={16} />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
