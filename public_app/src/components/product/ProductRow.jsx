import React from "react";
import { Link } from "react-router-dom";

import BrowseCard from "../shop/browse/BrowseCard";

// A titled grid of product cards (similar products, more from this seller).
export default function ProductRow({ title, items, seeAllTo, seeAllLabel }) {
  if (!items.length) return null;
  return (
    <section className="pd-row">
      <div className="pd-row-head">
        <h2>{title}</h2>
        {seeAllTo ? (
          <Link to={seeAllTo} className="sb-link-btn">
            {seeAllLabel || "See all"} &rarr;
          </Link>
        ) : null}
      </div>
      <div className="pd-row-grid">
        {items.map((listing) => (
          <BrowseCard key={listing.id} listing={listing} />
        ))}
      </div>
    </section>
  );
}
