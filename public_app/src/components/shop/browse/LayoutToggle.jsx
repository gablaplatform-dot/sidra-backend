import React from "react";
import { useTranslation } from "react-i18next";

import { IconGrid, IconList } from "../../icons";

// Grid / list switch for product lists.
export default function LayoutToggle({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="sb-layout-toggle" role="group" aria-label={t("shop.layout.label")}>
      <button type="button" className={value === "grid" ? "is-active" : ""} onClick={() => onChange("grid")} aria-pressed={value === "grid"} aria-label={t("shop.layout.grid")}>
        <IconGrid width={18} height={18} />
      </button>
      <button type="button" className={value === "list" ? "is-active" : ""} onClick={() => onChange("list")} aria-pressed={value === "list"} aria-label={t("shop.layout.list")}>
        <IconList width={18} height={18} />
      </button>
    </div>
  );
}
