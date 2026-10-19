import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import ProviderCustomFields, { hasAnsweredCustomFields } from "../ProviderCustomFields";
import { IconBox, IconChevronLeft, IconClockIcon, IconImage, IconStar } from "../icons";
import { formatUgx } from "../../lib/format";
import { unitLabel } from "../../lib/bookings";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

export default function ProviderLayoutBooking({ provider, categoryId, categoryName, providerFields = [], listings, gallery, onUnlock }) {
  const { t } = useTranslation();
  return (
    <>
      <section
        className="provider-hero"
        style={provider.media?.coverUrl ? { backgroundImage: `url("${provider.media.coverUrl}")` } : undefined}
      >
        <Link to={categoryId ? `/category/${categoryId}` : "/home"} className="banner-back">
          <IconChevronLeft /> {categoryId ? categoryName : t("nav.home")}
        </Link>
        <div className="provider-hero-label">
          {!provider.media?.coverUrl ? <span className="provider-hero-icon">{initials(provider.businessName)}</span> : null}
          <div>
            <h1>{provider.businessName}</h1>
            <p className="provider-hero-meta">
              {categoryName}
              <span className="hero-trust-dot">&middot;</span>
              <IconStar /> {provider.ratingAvg ? provider.ratingAvg.toFixed(1) : t("common.new")}
            </p>
          </div>
        </div>
      </section>

      <div className="booking-cta-card">
        <IconClockIcon />
        <div>
          <h2>{t("layouts.checkAvailability")}</h2>
          <p className="provider-meta">{t("layouts.contactToConfirm", { name: provider.businessName })}</p>
        </div>
        <button type="button" className="cta-button" onClick={provider.contactLocked ? onUnlock : undefined}>
          {provider.contactLocked ? t("layouts.unlockToRequest") : t("layouts.requestBooking")}
        </button>
      </div>

      <div className="provider-detail-grid">
        <div className="provider-detail-main">
          {provider.description || hasAnsweredCustomFields(providerFields, provider.customFields) ? (
            <section className="detail-block">
              <h2>{t("layouts.about")}</h2>
              {provider.description ? <p className="provider-description">{provider.description}</p> : null}
              <ProviderCustomFields fields={providerFields} values={provider.customFields} />
            </section>
          ) : null}

          <section className="detail-block">
            <h2>{t("layouts.roomsPackages")}</h2>
            {listings.length ? (
              <div className="listing-grid">
                {listings.map((item) => (
                  <div key={item.id} className="listing-card">
                    <div
                      className="listing-cover"
                      style={item.media?.imageUrl ? { backgroundImage: `url("${item.media.imageUrl}")` } : undefined}
                    >
                      {!item.media?.imageUrl ? <IconBox /> : null}
                    </div>
                    <div className="listing-body">
                      <h3>{item.name}</h3>
                      {item.description ? <p className="provider-meta">{item.description}</p> : null}
                      {Number(item.price) > 0 ? <div className="listing-price">{formatUgx(item.price)} / {unitLabel("night")}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <IconBox />
                <p>{t("layouts.noRooms")}</p>
              </div>
            )}
          </section>

          <section className="detail-block">
            <h2>{t("layouts.gallery")}</h2>
            {gallery.length ? (
              <div className="gallery-grid">
                {gallery.map((url) => (
                  <div key={url} className="gallery-item" style={{ backgroundImage: `url("${url}")` }} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <IconImage />
                <p>{t("layouts.noGallery")}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
