import React from "react";
import { Link } from "react-router-dom";

import { listingCover } from "../../../lib/shopMappers";
import { cardTags } from "../../../lib/browseFilters";
import { formatUgx } from "../../../lib/format";
import { IconPin } from "../../icons";
import LazyImg from "../../LazyImg";

export default function BrowseCard({ listing }) {
  const price = Number(listing.price) || 0;
  const was = Number(listing.originalPrice) || 0;
  const tags = cardTags(listing.customFields);
  const district = listing.provider?.district;
  const distance = Number.isFinite(listing.distanceKm) ? listing.distanceKm : null;

  return (
    <Link to={`/shop/product/${listing.id}`} className="sb-card">
      <div className="sb-card-media">
        <LazyImg src={listingCover(listing)} alt={listing.name} loading="lazy" />
        {listing.discountPercent ? <span className="sb-card-badge">-{listing.discountPercent}%</span> : null}
        {listing.isNew ? <span className="sb-card-new">New</span> : null}
      </div>
      <div className="sb-card-body">
        <div className="sb-card-price">
          <strong>{price > 0 ? formatUgx(price) : "Contact for price"}</strong>
          {was > price ? <s>{formatUgx(was)}</s> : null}
        </div>
        <h3 className="sb-card-name">{listing.name}</h3>
        {listing.description ? <p className="sb-card-desc">{listing.description}</p> : null}
        {tags.length ? (
          <div className="sb-card-tags">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
        <div className="sb-card-foot">
          <span className="sb-card-place">
            <IconPin width={14} height={14} />
            {district || "Uganda"}
            {distance !== null ? ` · ${distance < 1 ? "< 1" : distance} km` : ""}
          </span>
          {listing.provider?.businessName ? <span className="sb-card-seller">{listing.provider.businessName}</span> : null}
        </div>
      </div>
    </Link>
  );
}
