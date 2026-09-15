import React from "react";
import { Link } from "react-router-dom";

import ContactSidebar from "../ContactSidebar";
import { IconBox, IconChevronLeft, IconClockIcon, IconImage, IconStar } from "../icons";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

export default function ProviderLayoutBooking({ provider, categoryId, categoryName, listings, gallery, onUnlock }) {
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

      <div className="booking-cta-card">
        <IconClockIcon />
        <div>
          <h2>Check availability</h2>
          <p className="provider-meta">Contact {provider.businessName} directly to confirm dates and pricing.</p>
        </div>
        <button type="button" className="cta-button" onClick={provider.contactLocked ? onUnlock : undefined}>
          {provider.contactLocked ? "Unlock to request booking" : "Request booking"}
        </button>
      </div>

      <div className="provider-detail-grid">
        <div className="provider-detail-main">
          {provider.description ? (
            <section className="detail-block">
              <h2>About</h2>
              <p className="provider-description">{provider.description}</p>
            </section>
          ) : null}

          <section className="detail-block">
            <h2>Rooms &amp; packages</h2>
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
                      {Number(item.price) > 0 ? <div className="listing-price">UGX {Number(item.price).toLocaleString()} / night</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <IconBox />
                <p>No rooms or packages listed yet.</p>
              </div>
            )}
          </section>

          <section className="detail-block">
            <h2>Gallery</h2>
            {gallery.length ? (
              <div className="gallery-grid">
                {gallery.map((url) => (
                  <div key={url} className="gallery-item" style={{ backgroundImage: `url("${url}")` }} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <IconImage />
                <p>No gallery photos yet.</p>
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
