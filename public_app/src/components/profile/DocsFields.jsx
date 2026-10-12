import React from "react";

import { IconCheck } from "../icons";
import { ACCENT_PALETTE, LIMITS } from "./docsModel";

// Form controls for the quotes & receipts studio. Every control has an id + visible label, hint text and an
// inline error that is announced to assistive tech.

export function TextField({ id, label, value, onChange, path, hint, error, multiline = false, rows = 3, placeholder, type = "text", inputMode, onReset, resetLabel = "Reset to default", autoComplete = "off", suffix, className = "" }) {
  const max = path ? LIMITS[path] : undefined;
  const length = String(value ?? "").trim().length;
  const over = max !== undefined && length > max;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    value: value ?? "",
    onChange: (event) => onChange(event.target.value),
    placeholder,
    className: `docs-input${error || over ? " is-invalid" : ""}`,
    "aria-invalid": error || over ? "true" : undefined,
    "aria-describedby": describedBy,
    autoComplete
  };
  return (
    <div className={`docs-field ${className}`}>
      <div className="docs-label-row">
        <label className="docs-label" htmlFor={id}>{label}</label>
        {onReset ? (
          <button type="button" className="docs-link-btn" onClick={onReset}>{resetLabel}</button>
        ) : null}
      </div>
      {multiline ? (
        <textarea {...common} rows={rows} />
      ) : suffix ? (
        <div className="docs-input-wrap">
          <input {...common} type={type} inputMode={inputMode} />
          <span className="docs-input-suffix" aria-hidden="true">{suffix}</span>
        </div>
      ) : (
        <input {...common} type={type} inputMode={inputMode} />
      )}
      <div className="docs-field-foot">
        <div className="docs-field-notes">
          {error ? <p id={`${id}-err`} className="docs-error" role="alert">{error}</p> : null}
          {hint ? <p id={`${id}-hint`} className="docs-hint">{hint}</p> : null}
        </div>
        {max !== undefined && (multiline || length > max * 0.7) ? (
          <span className={`docs-counter${over ? " is-over" : ""}`} aria-hidden="true">{length}/{max}</span>
        ) : null}
      </div>
    </div>
  );
}

export function Toggle({ id, label, hint, checked, onChange, disabled = false }) {
  return (
    <label className={`docs-switch${disabled ? " is-disabled" : ""}`} htmlFor={id}>
      <span className="docs-switch-text">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input id={id} type="checkbox" role="switch" checked={Boolean(checked)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="docs-switch-track" aria-hidden="true"><span className="docs-switch-thumb" /></span>
    </label>
  );
}

export function ColorPalette({ id, value, onChange, error }) {
  const current = String(value || "").toLowerCase();
  const isPreset = ACCENT_PALETTE.some((c) => c.value === current);
  const validHex = /^#[0-9a-f]{6}$/i.test(value || "");
  return (
    <div className="docs-field">
      <span className="docs-label" id={`${id}-label`}>Accent colour</span>
      <div className="docs-palette" role="radiogroup" aria-labelledby={`${id}-label`}>
        {ACCENT_PALETTE.map((color) => {
          const active = color.value === current;
          return (
            <button
              key={color.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={color.name}
              title={color.name}
              className={`docs-swatch${active ? " is-active" : ""}`}
              onClick={() => onChange(color.value)}
            >
              <span style={{ background: color.value }}>{active ? <IconCheck /> : null}</span>
            </button>
          );
        })}
      </div>
      <div className="docs-custom-color">
        <label className="docs-color-picker" htmlFor={`${id}-picker`} title="Pick any colour">
          <span className="sr-only">Pick a custom colour</span>
          <input id={`${id}-picker`} type="color" value={validHex ? value : "#0b2046"} onChange={(event) => onChange(event.target.value)} />
          <span className={`docs-color-chip${!isPreset && validHex ? " is-active" : ""}`} style={{ background: validHex ? value : "#e2e8f0" }} />
        </label>
        <div className="docs-custom-hex">
          <label className="docs-label" htmlFor={`${id}-hex`}>Custom colour (hex)</label>
          <input
            id={`${id}-hex`}
            className={`docs-input${error ? " is-invalid" : ""}`}
            value={value || ""}
            onChange={(event) => onChange(event.target.value.startsWith("#") || !event.target.value ? event.target.value : `#${event.target.value}`)}
            placeholder="#0b2046"
            spellCheck="false"
            autoComplete="off"
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? `${id}-hex-err` : undefined}
          />
        </div>
      </div>
      {error ? <p id={`${id}-hex-err`} className="docs-error" role="alert">{error}</p> : null}
      <p className="docs-hint">Used for the header band, table heading and total on your documents.</p>
    </div>
  );
}

export function Accordion({ id, icon, title, summary, open, onToggle, errorCount = 0, children }) {
  return (
    <section className={`docs-acc${open ? " is-open" : ""}${errorCount ? " has-error" : ""}`}>
      <h3 className="docs-acc-heading">
        <button type="button" className="docs-acc-btn" id={`${id}-btn`} aria-expanded={open} aria-controls={`${id}-panel`} onClick={onToggle}>
          <span className="docs-acc-icon" aria-hidden="true">{icon}</span>
          <span className="docs-acc-title">
            <strong>{title}</strong>
            <small>{summary}</small>
          </span>
          {errorCount ? <span className="docs-acc-errors" aria-label={`${errorCount} problem${errorCount === 1 ? "" : "s"} in this section`}>{errorCount}</span> : null}
          <svg className="docs-acc-chevron" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </h3>
      <div className="docs-acc-body" id={`${id}-panel`} role="region" aria-labelledby={`${id}-btn`} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
