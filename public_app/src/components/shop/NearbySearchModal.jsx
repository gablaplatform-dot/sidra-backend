import React, { useEffect, useState } from "react";

import { request } from "../../lib/api";
import { getCurrentPosition } from "../../lib/geolocation";
import { mapProductDto } from "../../lib/shopMappers";
import { ProductCard } from "./ShopNewArrivals";
import Pagination from "../Pagination";
import { IconClose, IconSearch } from "../icons";

const RADIUS_KM = 15;
const PAGE_LIMIT = 12;

const LOCATION_NOTICES = {
  denied: "Location access was declined — pick a district below, or we'll show all results.",
  unsupported: "This browser can't share your location — pick a district below, or we'll show all results.",
  timeout: "Couldn't get your location in time — pick a district below, or we'll show all results.",
  unavailable: "Couldn't determine your location — pick a district below, or we'll show all results."
};

export default function NearbySearchModal({ onClose }) {
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [districts, setDistricts] = useState([]);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationNotice, setLocationNotice] = useState("");
  const [searched, setSearched] = useState(false);
  // The geo/district scope actually behind the current result set - not necessarily what the
  // shopper asked for, since the backend widens (bigger radius, then nationwide) when a narrow
  // scope comes up empty. Pagination has to keep resending THIS, not the original ask, or page 2
  // could silently re-narrow to a scope already known to have nothing in it.
  const [activeScope, setActiveScope] = useState(null);

  useEffect(() => {
    let active = true;
    request("/providers/districts")
      .then((data) => {
        if (active) setDistricts(data?.items || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const runQuery = async (nextPage, scope) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE_LIMIT) });
      if (query.trim()) params.set("q", query.trim());
      if (scope.lat != null) {
        params.set("lat", String(scope.lat));
        params.set("lng", String(scope.lng));
        params.set("radiusKm", String(scope.radiusKm));
      } else if (scope.district) {
        params.set("district", scope.district);
      }

      const data = await request(`/listings?${params.toString()}`);
      setResult(data);
      setPage(nextPage);
      setSearched(true);
      setActiveScope({
        lat: scope.lat ?? null,
        lng: scope.lng ?? null,
        radiusKm: scope.lat != null ? (data.effectiveRadiusKm ?? scope.radiusKm) : null,
        district: scope.lat == null ? (data.effectiveDistrict !== undefined ? data.effectiveDistrict : scope.district) : null
      });
    } catch (submitError) {
      setError(submitError.message || "Unable to search right now.");
    } finally {
      setLoading(false);
    }
  };

  const searchWithScope = (scope) => runQuery(1, scope);

  const submit = async (event) => {
    event.preventDefault();
    try {
      const coords = await getCurrentPosition();
      setLocationNotice("");
      setShowDistrictPicker(false);
      await searchWithScope({ lat: coords.lat, lng: coords.lng, radiusKm: RADIUS_KM });
    } catch (geoError) {
      setLocationNotice(LOCATION_NOTICES[geoError.message] || LOCATION_NOTICES.unavailable);
      setShowDistrictPicker(true);
      await searchWithScope({ district: district || undefined });
    }
  };

  const changeDistrict = (nextDistrict) => {
    setDistrict(nextDistrict);
    searchWithScope({ district: nextDistrict || undefined });
  };

  const changePage = (nextPage) => {
    if (!activeScope) return;
    runQuery(nextPage, activeScope);
  };

  const items = (result?.items || []).map((p) => mapProductDto(p));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card is-wide" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>

        <h2>Search nearby</h2>
        <form className="nearby-search-form" onSubmit={submit}>
          <div className="nearby-search-input">
            <IconSearch />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What are you looking for?"
              autoFocus
            />
          </div>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {locationNotice ? <p className="modal-hint">{locationNotice}</p> : null}
        {showDistrictPicker ? (
          <select
            className="nearby-district-select"
            value={district}
            onChange={(e) => changeDistrict(e.target.value)}
            disabled={loading}
          >
            <option value="">All of Uganda</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        ) : null}
        {result?.widened ? (
          <p className="modal-hint">
            {activeScope?.lat == null
              ? `No results in ${district || "that district"} — showing results from across Uganda instead.`
              : "No results nearby — showing results from farther away instead."}
          </p>
        ) : null}
        {error ? <div className="error-message">{error}</div> : null}

        {loading && !result ? (
          <p className="home-empty page-loading">Searching…</p>
        ) : searched && items.length === 0 ? (
          <p className="home-empty">No results anywhere for that search. Try a different query.</p>
        ) : items.length ? (
          <>
            <div className="shop-nearby-grid">
              {items.map((product) => (
                <div key={product.id} className="shop-nearby-grid-item">
                  <ProductCard product={product} />
                  {product.distanceKm != null ? (
                    <p className="shop-nearby-distance">
                      {product.providerName ? `${product.providerName} — ` : ""}
                      {product.distanceKm} km away
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <Pagination page={page} limit={PAGE_LIMIT} total={result.total} onPageChange={changePage} />
          </>
        ) : null}
      </div>
    </div>
  );
}
