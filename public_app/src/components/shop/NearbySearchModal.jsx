import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { request } from "../../lib/api";
import { getCurrentPosition } from "../../lib/geolocation";
import { getPreferredDistrict } from "../../lib/userLocation";
import { trackInterest } from "../../lib/tracking";
import { mapProductDto } from "../../lib/shopMappers";
import { ProductCard } from "./ShopNewArrivals";
import Pagination from "../Pagination";
import { IconClose, IconSearch } from "../icons";
import { ProductGridSkeleton } from "../Skeleton";

const RADIUS_KM = 15;
const PAGE_LIMIT = 12;

// Geolocation error codes (from lib/geolocation); shown as shop.nearby.notice.<code>.
const LOCATION_NOTICE_CODES = ["denied", "unsupported", "timeout", "unavailable"];

export default function NearbySearchModal({ onClose }) {
  const { t } = useTranslation();
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
      if (query.trim()) {
        params.set("q", query.trim());
        if (nextPage === 1) trackInterest({ type: "search", query: query.trim() });
      }
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
      setError(submitError.message || t("shop.nearby.unableSearch"));
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
      setLocationNotice(t(`shop.nearby.notice.${LOCATION_NOTICE_CODES.includes(geoError.message) ? geoError.message : "unavailable"}`));
      setShowDistrictPicker(true);
      // No position to go on: fall back to the district they chose when they joined / last picked.
      await searchWithScope({ district: district || getPreferredDistrict() || undefined });
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
        <button type="button" className="modal-close" onClick={onClose} aria-label={t("shop.nearby.close")}>
          <IconClose />
        </button>

        <h2>{t("shop.nearby.title")}</h2>
        <form className="nearby-search-form" onSubmit={submit}>
          <div className="nearby-search-input">
            <IconSearch />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("shop.nearby.placeholder")}
              autoFocus
            />
          </div>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? t("shop.nearby.searching") : t("shop.nearby.search")}
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
            <option value="">{t("shop.nearby.allUganda")}</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        ) : null}
        {result?.widened ? (
          <p className="modal-hint">
            {activeScope?.lat == null
              ? t("shop.nearby.noResultsDistrict", { district: district || t("shop.nearby.thatDistrict") })
              : t("shop.nearby.noResultsNearby")}
          </p>
        ) : null}
        {error ? <div className="error-message">{error}</div> : null}

        {loading && !result ? (
          <ProductGridSkeleton count={4} className="shop-category-product-grid" label={t("shop.nearby.searchingLabel")} />
        ) : searched && items.length === 0 ? (
          <p className="home-empty">{t("shop.nearby.noResultsAnywhere")}</p>
        ) : items.length ? (
          <>
            <div className="shop-nearby-grid">
              {items.map((product) => (
                <div key={product.id} className="shop-nearby-grid-item">
                  <ProductCard product={product} />
                  {product.distanceKm != null ? (
                    <p className="shop-nearby-distance">
                      {product.providerName
                        ? t("shop.nearby.awayFrom", { provider: product.providerName, km: product.distanceKm })
                        : t("shop.nearby.away", { km: product.distanceKm })}
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
