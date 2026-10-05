import React, { useEffect, useMemo, useState } from "react";

import { IconClose, IconPin, IconSearch } from "../../icons";

// Jiji-style location chooser: "All Uganda", a one-tap "near me" (browser geolocation, widens
// automatically on the server when nothing is close), then districts that actually have listings,
// each with its count for the current category and filters.
export default function LocationPicker({ districts, current, onSelect, onClose }) {
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

  const isAll = !current.district && !current.near;

  return (
    <div className="sb-modal-backdrop" onClick={onClose}>
      <div className="sb-modal" role="dialog" aria-label="Select location" onClick={(event) => event.stopPropagation()}>
        <div className="sb-modal-head">
          <h2>Select location</h2>
          <button type="button" className="sb-icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <label className="sb-modal-search">
          <IconSearch width={16} height={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search district" autoFocus />
        </label>

        <div className="sb-modal-list">
          <button type="button" className={`sb-loc-row sb-loc-near ${current.near ? "is-active" : ""}`} onClick={() => onSelect({ near: true })}>
            <IconPin width={16} height={16} />
            <span>Use my current location</span>
            <em>nearest first</em>
          </button>
          <button type="button" className={`sb-loc-row ${isAll ? "is-active" : ""}`} onClick={() => onSelect({})}>
            <span>All Uganda</span>
          </button>
          {visible.map((d) => (
            <button
              key={d.name}
              type="button"
              className={`sb-loc-row ${current.district === d.name ? "is-active" : ""}`}
              onClick={() => onSelect({ district: d.name })}
            >
              <span>{d.name}</span>
              <em>{d.count.toLocaleString()} {d.count === 1 ? "ad" : "ads"}</em>
            </button>
          ))}
          {!visible.length ? <p className="sb-modal-empty">No district matches &ldquo;{query}&rdquo;.</p> : null}
        </div>
      </div>
    </div>
  );
}
