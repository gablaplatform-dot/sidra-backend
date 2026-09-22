import React, { useState } from "react";

import { request } from "../../lib/api";
import { getCurrentPosition } from "../../lib/geolocation";
import { mapProductDto } from "../../lib/shopMappers";
import { ProductCard } from "./ShopNewArrivals";
import Pagination from "../Pagination";
import { IconClose, IconSearch } from "../icons";

const RADIUS_KM = 15;
const PAGE_LIMIT = 12;

const LOCATION_NOTICES = {
  denied: "Location access was declined — showing all results instead of nearest first.",
  unsupported: "This browser can't share your location — showing all results instead of nearest first.",
  timeout: "Couldn't get your location in time — showing all results instead of nearest first.",
  unavailable: "Couldn't determine your location — showing all results instead of nearest first."
};

export default function NearbySearchModal({ onClose }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationNotice, setLocationNotice] = useState("");
  const [searched, setSearched] = useState(false);

  const runSearch = async (nextPage) => {
    setLoading(true);
    setError("");
    try {
      let coords = null;
      try {
        coords = await getCurrentPosition();
        setLocationNotice("");
      } catch (geoError) {
        coords = null;
        setLocationNotice(LOCATION_NOTICES[geoError.message] || LOCATION_NOTICES.unavailable);
      }

      const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE_LIMIT) });
      if (query.trim()) params.set("q", query.trim());
      if (coords) {
        params.set("lat", String(coords.lat));
        params.set("lng", String(coords.lng));
        params.set("radiusKm", String(RADIUS_KM));
      }

      const data = await request(`/listings?${params.toString()}`);
      setResult(data);
      setPage(nextPage);
      setSearched(true);
    } catch (submitError) {
      setError(submitError.message || "Unable to search right now.");
    } finally {
      setLoading(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    runSearch(1);
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
        {error ? <div className="error-message">{error}</div> : null}

        {loading && !result ? (
          <p className="home-empty page-loading">Searching…</p>
        ) : searched && items.length === 0 ? (
          <p className="home-empty">No results nearby. Try a different search.</p>
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
            <Pagination page={page} limit={PAGE_LIMIT} total={result.total} onPageChange={(p) => runSearch(p)} />
          </>
        ) : null}
      </div>
    </div>
  );
}
