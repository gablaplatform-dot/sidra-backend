import React from "react";
import { Link } from "react-router-dom";

import ContactSidebar from "../ContactSidebar";
import ProviderCustomFields from "../ProviderCustomFields";
import { IconBox, IconChevronLeft, IconImage, IconStar } from "../icons";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

export default function ProviderLayoutGallery({ provider, categoryId, categoryName, providerFields = [], listings, gallery, onUnlock }) {
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

      <div className="detail-block gallery-layout-body">
        {provider.description ? <p className="provider-description gallery-layout-intro">{provider.description}</p> : null}
        <ProviderCustomFields fields={providerFields} values={provider.customFields} />

        <h2>Gallery</h2>
        {gallery.length ? (
          <div className="masonry-gallery">
            {gallery.map((url) => (
              <div key={url} className="masonry-item" style={{ backgroundImage: `url("${url}")` }} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <IconImage />
            <p>No gallery photos yet.</p>
          </div>
        )}
      </div>

      <div className="provider-detail-grid">
        <div className="provider-detail-main">
          <section className="detail-block">
            <h2>Products &amp; services</h2>
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
                      {Number(item.price) > 0 ? <div className="listing-price">UGX {Number(item.price).toLocaleString()}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <IconBox />
                <p>No products or services listed yet.</p>
              </div>
            )}
          </section>
        </div>
        <aside className="provider-detail-sidebar">
          <ContactSidebar provider={provider} onUnlock={onUnlock} />
        </aside>
      </div>
    </>
  );
}
