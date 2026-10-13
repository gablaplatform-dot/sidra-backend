import React from "react";

import { IconGrid, IconList } from "../../icons";

// Grid / list switch for product lists.
export default function LayoutToggle({ value, onChange }) {
  return (
    <div className="sb-layout-toggle" role="group" aria-label="Product layout">
      <button type="button" className={value === "grid" ? "is-active" : ""} onClick={() => onChange("grid")} aria-pressed={value === "grid"} aria-label="Grid view">
        <IconGrid width={18} height={18} />
      </button>
      <button type="button" className={value === "list" ? "is-active" : ""} onClick={() => onChange("list")} aria-pressed={value === "list"} aria-label="List view">
        <IconList width={18} height={18} />
      </button>
    </div>
  );
}
