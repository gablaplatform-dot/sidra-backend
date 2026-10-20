import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";

const fold = (v) => String(v || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

// "Who do you serve?": a provider ticks the countries and cultures its customers come from. Anything not listed can be
// typed in as a new entry; it is saved as pending and customers only see it once an admin approves it.
// `value` is { ids: [audience ids], suggestions: [{kind, name}] }; `known` lists audiences the provider already has
// (including pending ones) so they show up as chips.
export default function AudiencePicker({ value, onChange, known = [] }) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState({ countries: [], cultures: [] });
  const [kind, setKind] = useState("country");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    request("/audiences")
      .then((data) => active && setCatalog({ countries: data?.countries || [], cultures: data?.cultures || [] }))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const everything = useMemo(() => {
    const byId = new Map();
    for (const a of [...catalog.countries, ...catalog.cultures, ...known]) byId.set(a.id, a);
    return byId;
  }, [catalog, known]);

  const options = kind === "country" ? catalog.countries : catalog.cultures;
  const q = fold(query);
  const matches = q ? options.filter((a) => fold(a.name).includes(q) || fold(a.code).includes(q)) : options;
  const exact = Boolean(q) && ([...options, ...known].some((a) => a.kind === kind && fold(a.name) === q) || value.suggestions.some((s) => s.kind === kind && fold(s.name) === q));
  const selected = value.ids.map((id) => everything.get(id)).filter(Boolean);

  const toggle = (id) => onChange({ ...value, ids: value.ids.includes(id) ? value.ids.filter((x) => x !== id) : [...value.ids, id] });
  const addSuggestion = () => {
    const name = query.trim().replace(/\s+/g, " ");
    if (name.length < 2) return;
    onChange({ ...value, suggestions: [...value.suggestions, { kind, name }].slice(0, 5) });
    setQuery("");
  };
  const removeSuggestion = (index) => onChange({ ...value, suggestions: value.suggestions.filter((_, i) => i !== index) });

  // Enter ticks the first match, or adds what was typed when nothing matches.
  const onSearchKey = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (matches[0]) toggle(matches[0].id);
    else if (query.trim() && !exact) addSuggestion();
  };

  return (
    <div className="aud-picker">
      <p className="aud-hint">{t("audience.hint")}</p>

      <div className="aud-chips" aria-live="polite">
        {selected.length || value.suggestions.length ? (
          <>
            {selected.map((a) => (
              <span key={a.id} className={`aud-chip ${a.moderationStatus === "pending" ? "is-pending" : ""}`} title={a.moderationStatus === "pending" ? t("audience.pendingNote") : undefined}>
                {a.name}
                {a.moderationStatus === "pending" ? <em>{t("audience.pending")}</em> : null}
                <button type="button" onClick={() => toggle(a.id)} aria-label={t("audience.remove", { name: a.name })}>×</button>
              </span>
            ))}
            {value.suggestions.map((s, i) => (
              <span key={`${s.kind}-${s.name}`} className="aud-chip is-pending" title={t("audience.pendingNote")}>
                {s.name}
                <em>{t("audience.pending")}</em>
                <button type="button" onClick={() => removeSuggestion(i)} aria-label={t("audience.remove", { name: s.name })}>×</button>
              </span>
            ))}
          </>
        ) : (
          <span className="aud-everyone">{t("audience.none")}</span>
        )}
      </div>

      <div className="aud-tabs" role="tablist">
        {["country", "culture"].map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? "is-on" : ""} onClick={() => { setKind(k); setQuery(""); }}>
            {k === "country" ? t("audience.countries") : t("audience.cultures")}
          </button>
        ))}
      </div>
      <input
        className="aud-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onSearchKey}
        placeholder={kind === "country" ? t("audience.searchCountries") : t("audience.searchCultures")}
        aria-label={kind === "country" ? t("audience.searchCountries") : t("audience.searchCultures")}
      />
      <div className="aud-list" role="listbox" aria-multiselectable="true">
        {matches.slice(0, 80).map((a) => (
          <label key={a.id} className={`aud-opt ${value.ids.includes(a.id) ? "is-on" : ""}`}>
            <input type="checkbox" checked={value.ids.includes(a.id)} onChange={() => toggle(a.id)} />
            <span>{a.name}</span>
            {a.code ? <small>{a.code}</small> : null}
          </label>
        ))}
        {!matches.length && q ? <p className="aud-empty">{t("audience.noMatch", { query })}</p> : null}
        {q && !exact ? (
          <button type="button" className="aud-add" onClick={addSuggestion}>
            + {t("audience.addNew", { name: query.trim(), kind: kind === "country" ? t("audience.kindCountry") : t("audience.kindCulture") })}
          </button>
        ) : null}
      </div>
    </div>
  );
}
