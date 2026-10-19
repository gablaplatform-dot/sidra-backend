import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import ProviderCustomFields, { hasAnsweredCustomFields } from "../ProviderCustomFields";
import { IconChevronLeft, IconImage, IconStar } from "../icons";
import { formatUgx } from "../../lib/format";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

export default function ProviderLayoutPortfolio({ provider, categoryId, categoryName, providerFields = [], listings, gallery, onUnlock }) {
  const { t } = useTranslation();
  return (
    <>
      <section className="provider-hero provider-hero-compact">
        <Link to={categoryId ? `/category/${categoryId}` : "/home"} className="banner-back">
          <IconChevronLeft /> {categoryId ? categoryName : t("nav.home")}
        </Link>
        <div className="provider-hero-label">
          <span className="provider-hero-icon">{initials(provider.businessName)}</span>
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

      <div className="provider-detail-grid">
        <div className="provider-detail-main">
          {provider.description || hasAnsweredCustomFields(providerFields, provider.customFields) ? (
            <section className="detail-block portfolio-about">
              <h2>{t("layouts.aboutName", { name: provider.businessName })}</h2>
              {provider.description ? <p className="provider-description">{provider.description}</p> : null}
              <ProviderCustomFields fields={providerFields} values={provider.customFields} />
            </section>
          ) : null}

          <section className="detail-block">
            <h2>{t("layouts.portfolio")}</h2>
            {gallery.length ? (
              <div className="portfolio-gallery">
                {gallery.map((url) => (
                  <div key={url} className="portfolio-item" style={{ backgroundImage: `url("${url}")` }} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <IconImage />
                <p>{t("layouts.noPortfolio")}</p>
              </div>
            )}
          </section>

          {listings.length ? (
            <section className="detail-block">
              <h2>{t("layouts.servicesOffered")}</h2>
              <ul className="portfolio-services">
                {listings.map((item) => (
                  <li key={item.id}>
                    <span>{item.name}</span>
                    {Number(item.price) > 0 ? <strong>{formatUgx(item.price)}</strong> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
