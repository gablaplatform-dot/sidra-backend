import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { IconClose, IconPin, IconSearch } from "../../icons";

// Jiji-style location chooser: "All Uganda", a one-tap "near me" (browser geolocation, widens
// automatically on the server when nothing is close), then districts that actually have listings,
// each with its count for the current category and filters.
export default function LocationPicker({ districts, current, preferred, onSelect, onClose }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? districts.filter((d) => d.name.toLowerCase().includes(q)) : districts;
  }, [districts, query]);

  const isAround = !current.district && !current.near && !current.everywhere;

  return (
    <div className="sb-modal-backdrop" onClick={onClose}>
      <div className="sb-modal" role="dialog" aria-label={t("shop.location.title")} onClick={(event) => event.stopPropagation()}>
        <div className="sb-modal-head">
          <h2>{t("shop.location.title")}</h2>
          <button type="button" className="sb-icon-btn" onClick={onClose} aria-label={t("shop.location.close")}>
            <IconClose />
          </button>
        </div>

        <label className="sb-modal-search">
          <IconSearch width={16} height={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("shop.location.search")} autoFocus />
        </label>

        <div className="sb-modal-list">
          <button type="button" className={`sb-loc-row sb-loc-near ${current.near ? "is-active" : ""}`} onClick={() => onSelect({ near: true })}>
            <IconPin width={16} height={16} />
            <span>{t("shop.location.useCurrent")}</span>
            <em>{t("shop.location.nearestFirst")}</em>
          </button>
          {preferred ? (
            <button type="button" className={`sb-loc-row ${isAround ? "is-active" : ""}`} onClick={() => onSelect({})}>
              <span>{t("shop.location.around", { district: preferred })}</span>
              <em>{t("shop.location.yourAreaNearest")}</em>
            </button>
          ) : null}
          <button type="button" className={`sb-loc-row ${current.everywhere || (!preferred && isAround) ? "is-active" : ""}`} onClick={() => onSelect({ everywhere: true })}>
            <span>{t("shop.location.allUganda")}</span>
          </button>
          {visible.map((d) => (
            <button
              key={d.name}
              type="button"
              className={`sb-loc-row ${current.district === d.name ? "is-active" : ""}`}
              onClick={() => onSelect({ district: d.name })}
            >
              <span>{d.name}</span>
              <em>{t("shop.location.ads", { count: d.count, n: d.count.toLocaleString() })}</em>
            </button>
          ))}
          {!visible.length ? <p className="sb-modal-empty">{t("shop.location.noMatch", { query })}</p> : null}
        </div>
      </div>
    </div>
  );
}
