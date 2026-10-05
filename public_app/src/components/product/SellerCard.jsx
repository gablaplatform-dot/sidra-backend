import React from "react";
import { Link } from "react-router-dom";

import { monthYear } from "../../lib/format";
import { trackContactEvent } from "../../lib/providerContact";
import { IconLock, IconPhone, IconPin, IconStar } from "../icons";

const waLink = (whatsapp, text) => `https://wa.me/${String(whatsapp).replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`;

// Seller summary + the contact actions. Contact details sit behind the same paid unlock as the
// provider page, so until unlocked the button opens that flow; afterwards call / WhatsApp appear.
export default function SellerCard({ seller, contact, locked, listingName, onUnlock }) {
  const name = seller.businessName || "Seller";
  const hasContact = Boolean(contact?.phone || contact?.whatsapp);

  return (
    <div className="pd-seller">
      <Link to={`/provider/${seller.id}`} className="pd-seller-head">
        {seller.avatarUrl ? (
          <img src={seller.avatarUrl} alt="" className="pd-seller-avatar" />
        ) : (
          <span className="pd-seller-avatar pd-seller-initial">{name.trim().slice(0, 1).toUpperCase()}</span>
        )}
        <span className="pd-seller-id">
          <strong>{name}</strong>
          <small>
            <IconStar width={13} height={13} />
            {seller.ratingCount ? ` ${Number(seller.ratingAvg).toFixed(1)} (${seller.ratingCount})` : " New seller"}
            {seller.memberSince ? ` · Joined ${monthYear(seller.memberSince)}` : ""}
          </small>
        </span>
      </Link>

      <ul className="pd-seller-meta">
        {seller.district ? (
          <li>
            <IconPin width={15} height={15} /> {seller.district}
          </li>
        ) : null}
        {seller.productCount ? (
          <li>
            <Link to={`/provider/${seller.id}?tab=products`}>{seller.productCount} products from this seller &rarr;</Link>
          </li>
        ) : null}
      </ul>

      {locked ? (
        <button type="button" className="pd-contact-btn pd-contact-unlock" onClick={onUnlock}>
          <IconLock width={16} height={16} /> Show contact
        </button>
      ) : hasContact ? (
        <div className="pd-contact-actions">
          {contact.phone ? (
            <a className="pd-contact-btn" href={`tel:${contact.phone}`} onClick={() => trackContactEvent(seller.id, "call", contact.phone)}>
              <IconPhone width={16} height={16} /> {contact.phone}
            </a>
          ) : null}
          {contact.whatsapp ? (
            <a
              className="pd-contact-btn pd-contact-wa"
              href={waLink(contact.whatsapp, `Hi, I'm interested in "${listingName}" on Gabla.`)}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackContactEvent(seller.id, "whatsapp", contact.whatsapp)}
            >
              Chat on WhatsApp
            </a>
          ) : null}
        </div>
      ) : (
        <p className="provider-meta">This seller hasn&apos;t added contact details yet.</p>
      )}
    </div>
  );
}
