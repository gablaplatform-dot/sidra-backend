import React from "react";
import { IconChevronLeft } from "./icons";

// Compact page-number list: always shows first/last, the current page +/-1, and "…" gaps -
// avoids rendering 50 page buttons for a large result set.
const pageNumbers = (current, totalPages) => {
  const pages = new Set([1, totalPages, current, current - 1, current + 1]);
  return Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
};

export default function Pagination({ page, limit, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  const numbers = pageNumbers(page, totalPages);

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="pagination-nav"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <IconChevronLeft />
      </button>

      {numbers.map((n, i) => {
        const prev = numbers[i - 1];
        const showGap = prev !== undefined && n - prev > 1;
        return (
          <React.Fragment key={n}>
            {showGap ? <span className="pagination-ellipsis">…</span> : null}
            <button
              type="button"
              className={`pagination-page ${n === page ? "is-active" : ""}`}
              onClick={() => onPageChange(n)}
              aria-current={n === page ? "page" : undefined}
            >
              {n}
            </button>
          </React.Fragment>
        );
      })}

      <button
        type="button"
        className="pagination-nav pagination-nav-right"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <IconChevronLeft />
      </button>
    </nav>
  );
}
