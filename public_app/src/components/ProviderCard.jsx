import React from "react";
import { Link } from "react-router-dom";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

export default function ProviderCard({ provider, categoryName }) {
  return (
    <Link to={`/provider/${provider.id}`} className="provider-card">
      <div
        className="provider-cover"
        style={provider.media?.coverUrl ? { backgroundImage: `url("${provider.media.coverUrl}")` } : undefined}
      >
        {!provider.media?.coverUrl ? <span>{initials(provider.businessName)}</span> : null}
      </div>
      <div className="provider-body">
        <h3>{provider.businessName}</h3>
        <p className="provider-meta">{categoryName}</p>
        <p className="provider-meta provider-location">
          {[provider.location?.city, provider.location?.country].filter(Boolean).join(", ") || "Location not set"}
        </p>
        <div className="provider-rating">★ {provider.ratingAvg ? provider.ratingAvg.toFixed(1) : "New"}</div>
      </div>
    </Link>
  );
}
