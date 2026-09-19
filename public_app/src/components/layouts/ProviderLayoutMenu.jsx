import React from "react";
import { Link } from "react-router-dom";

import ContactSidebar from "../ContactSidebar";
import ProviderCustomFields, { hasAnsweredCustomFields } from "../ProviderCustomFields";
import { IconChevronLeft, IconStar } from "../icons";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

export default function ProviderLayoutMenu({ provider, categoryId, categoryName, providerFields = [], listings, gallery, onUnlock }) {
  return (
    <>
      <section
        className="provider-hero"
        style={provider.media?.coverUrl ? { backgroundImage: `url("${provider.media.coverUrl}")` } : undefined}
      >
        <Link to={categoryId ? `/category/${categoryId}` : "/home"} className="banner-back">
          <IconChevronLeft /> {categoryId ? categoryName : "Home"}
        </Link>
        <div className="provider-hero-label">
          {!provider.media?.coverUrl ? <span className="provider-hero-icon">{initials(provider.businessName)}</span> : null}
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
          {provider.description || hasAnsweredCustomFields(providerFields, provider.customFields) ? (
            <section className="detail-block">
              {provider.description ? <p className="provider-description">{provider.description}</p> : null}
              <ProviderCustomFields fields={providerFields} values={provider.customFields} />
            </section>
          ) : null}

          <section className="detail-block">
            <h2>Menu</h2>
            {listings.length ? (
              <div className="menu-list">
                {listings.map((item) => (
                  <div key={item.id} className="menu-row">
                    <div className="menu-row-main">
                      <h3>{item.name}</h3>
                      {item.description ? <p className="provider-meta">{item.description}</p> : null}
                    </div>
                    <div className="menu-row-price">
                      {Number(item.price) > 0 ? `UGX ${Number(item.price).toLocaleString()}` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="home-empty">Nothing on the menu yet.</p>
            )}
          </section>

          {gallery.length ? (
            <section className="detail-block">
              <h2>Gallery</h2>
              <div className="gallery-grid">
                {gallery.map((url) => (
                  <div key={url} className="gallery-item" style={{ backgroundImage: `url("${url}")` }} />
                ))}
              </div>
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
