import React from "react";
import { request } from "../lib/api";
import { getDeviceId } from "../lib/deviceId";
import { IconGlobe, IconLock, IconPhone, IconPin } from "./icons";

// Prefers the exact pin (Google Maps ranks a coordinate search far more precisely than a text
// address), falling back to the address text when no geo point was set.
const buildMapsUrl = (location) => {
  const coordinates = location?.geo?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length === 2) {
    const [lng, lat] = coordinates;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const address = [location?.address, location?.city, location?.region, location?.country].filter(Boolean).join(", ");
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
};

const waLink = (whatsapp) => `https://wa.me/${String(whatsapp).replace(/[^\d]/g, "")}`;

export default function ContactSidebar({ provider, onUnlock }) {
  const locked = provider.contactLocked;
  const contact = provider.contact || {};
  const hasContact = Boolean(contact.phone || contact.whatsapp || contact.website);
  const addressText =
    [provider.location?.address, provider.location?.city, provider.location?.region, provider.location?.country]
      .filter(Boolean)
      .join(", ") || "Location not set";
  const mapsUrl = locked ? null : buildMapsUrl(provider.location);

  // Never blocks the tel:/wa.me/etc navigation the click already triggered - just a fire-and-forget
  // ping that powers the provider's own Analytics tab.
  const trackContact = (type, value) => {
    request(`/engagement/providers/${encodeURIComponent(provider.id)}/contact-events`, {
      method: "POST",
      body: JSON.stringify({ type, value: value ?? null, sessionId: getDeviceId() })
    }).catch(() => {});
  };

  return (
    <div className="sidebar-card">
      <h2>Contact &amp; location</h2>
      {locked ? (
        <div className="locked-panel">
          <IconLock />
          <p>Contact and exact location are locked.</p>
          <p className="provider-meta">{[provider.location?.city, provider.location?.country].filter(Boolean).join(", ") || "Location hidden"}</p>
          <button type="button" className="cta-button" onClick={onUnlock}>Unlock contact &amp; location</button>
        </div>
      ) : (
        <>
          <ul className="contact-list">
            {contact.phone ? (
              <li>
                <a href={`tel:${contact.phone}`} onClick={() => trackContact("call", contact.phone)}>
                  <IconPhone /> {contact.phone}
                </a>
              </li>
            ) : null}
            {contact.whatsapp ? (
              <li>
                <a href={waLink(contact.whatsapp)} target="_blank" rel="noreferrer" onClick={() => trackContact("whatsapp", contact.whatsapp)}>
                  <IconPhone /> {contact.whatsapp} (WhatsApp)
                </a>
              </li>
            ) : null}
            {contact.website ? (
              <li>
                <a href={contact.website} target="_blank" rel="noreferrer" onClick={() => trackContact("website", contact.website)}>
                  <IconGlobe /> {contact.website}
                </a>
              </li>
            ) : null}
            {!hasContact ? <li className="provider-meta">No contact details provided.</li> : null}
          </ul>
          <div className="sidebar-divider" />
          {mapsUrl ? (
            <a className="sidebar-location-link" href={mapsUrl} target="_blank" rel="noreferrer" onClick={() => trackContact("directions")}>
              <IconPin /> <span>{addressText}</span>
            </a>
          ) : (
            <p className="sidebar-location-link is-static"><IconPin /> <span>{addressText}</span></p>
          )}
        </>
      )}
    </div>
  );
}
