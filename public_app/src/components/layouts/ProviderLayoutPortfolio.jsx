import React from "react";
import { Link } from "react-router-dom";

import ContactSidebar from "../ContactSidebar";
import { IconChevronLeft, IconImage, IconStar } from "../icons";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

export default function ProviderLayoutPortfolio({ provider, categoryId, categoryName, listings, gallery, onUnlock }) {
  return (
    <>
      <section className="provider-hero provider-hero-compact">
        <Link to={categoryId ? `/category/${categoryId}` : "/home"} className="banner-back">
          <IconChevronLeft /> {categoryId ? categoryName : "Home"}
        </Link>
        <div className="provider-hero-label">
          <span className="provider-hero-icon">{initials(provider.businessName)}</span>
          <div>
            <h1>{provider.businessName}</h1>
            <p className="provider-hero-meta">
              {categoryName}
              <span className="hero-trust-dot">&middot;</span>
              <IconStar /> {provider.ratingAvg ? provider.ratingAvg.toFixed(1) : "New"}
            </p>
          </div>
        </div>
      </section>

      <div className="provider-detail-grid">
        <div className="provider-detail-main">
          {provider.description ? (
            <section className="detail-block portfolio-about">
              <h2>About {provider.businessName}</h2>
              <p className="provider-description">{provider.description}</p>
            </section>
          ) : null}

          <section className="detail-block">
            <h2>Portfolio</h2>
            {gallery.length ? (
              <div className="portfolio-gallery">
                {gallery.map((url) => (
                  <div key={url} className="portfolio-item" style={{ backgroundImage: `url("${url}")` }} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <IconImage />
                <p>No portfolio photos yet.</p>
              </div>
            )}
          </section>

          {listings.length ? (
            <section className="detail-block">
              <h2>Services offered</h2>
              <ul className="portfolio-services">
                {listings.map((item) => (
                  <li key={item.id}>
                    <span>{item.name}</span>
                    {Number(item.price) > 0 ? <strong>UGX {Number(item.price).toLocaleString()}</strong> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="provider-detail-sidebar">
          <ContactSidebar provider={provider} onUnlock={onUnlock} />
        </aside>
      </div>
    </>
  );
}
