import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";

let catalogPromise;
const loadCatalog = () => {
  if (!catalogPromise) {
    catalogPromise = request("/audiences").catch((error) => {
      catalogPromise = undefined;
      throw error;
    });
  }
  return catalogPromise;
};

export const useAudienceCatalog = () => {
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    let active = true;
    loadCatalog()
      .then((data) => active && setCatalog(data))
      .catch(() => active && setCatalog({ countries: [], cultures: [] }));
    return () => {
      active = false;
    };
  }, []);
  return catalog;
};

export const audienceName = (catalog, kind, id) => (catalog?.[kind === "country" ? "countries" : "cultures"] || []).find((a) => a.id === id)?.name || id;

// "Who it's for": narrow providers and listings to a country or a culture. Providers that serve everyone are
// included, and the ones that named the choice come first.
export default function AudienceFilter({ country = "", culture = "", onChange, compact = false }) {
  const { t } = useTranslation();
  const catalog = useAudienceCatalog();

  // Nothing to filter by yet (an empty catalogue, or no provider has chosen anything).
  const countries = (catalog?.countries || []).filter((c) => c.providerCount > 0 || c.id === country);
  const cultures = (catalog?.cultures || []).filter((c) => c.providerCount > 0 || c.id === culture);
  if (!countries.length && !cultures.length) return null;

  return (
    <div className="aud-filter">
      {compact ? null : <b>{t("audience.filterTitle")}</b>}
      {countries.length ? (
        <label>
          <span>{t("audience.filterCountry")}</span>
          <select value={country} onChange={(e) => onChange({ country: e.target.value || null })}>
            <option value="">{t("audience.allCountries")}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.providerCount})</option>
            ))}
          </select>
        </label>
      ) : null}
      {cultures.length ? (
        <label>
          <span>{t("audience.filterCulture")}</span>
          <select value={culture} onChange={(e) => onChange({ culture: e.target.value || null })}>
            <option value="">{t("audience.allCultures")}</option>
            {cultures.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.providerCount})</option>
            ))}
          </select>
        </label>
      ) : null}
      {compact ? null : <small>{t("audience.filterNote")}</small>}
    </div>
  );
}
