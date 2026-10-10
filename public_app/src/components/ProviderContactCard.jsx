import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { monthYear } from "../lib/format";
import { CLEAN_MAP_STYLE, loadGoogleMaps } from "../lib/maps";
import { trackContactEvent } from "../lib/providerContact";
import { IconChat, IconCheck, IconClose, IconGlobe, IconLock, IconPhone, IconPin, IconShield, IconStar } from "./icons";

const ugx = (value) => `UGX ${Number(value || 0).toLocaleString("en-US")}`;
const waLink = (whatsapp, text) => `https://wa.me/${String(whatsapp).replace(/[^\d]/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
const directionsUrl = (location) => {
  const c = location?.geo?.coordinates;
  if (Array.isArray(c) && c.length === 2) return `https://www.google.com/maps/dir/?api=1&destination=${c[1]},${c[0]}`;
  const text = [location?.address, location?.city, location?.region, location?.country].filter(Boolean).join(", ");
  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : null;
};

// A small read-only map with the exact pin, shown once the location is unlocked.
function PinMap({ location }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  const coords = location?.geo?.coordinates;

  useEffect(() => {
    if (!Array.isArray(coords) || coords.length !== 2) return undefined;
    let active = true;
    loadGoogleMaps()
      .then((google) => {
        if (!active || !ref.current) return;
        const center = { lat: coords[1], lng: coords[0] };
        const map = new google.maps.Map(ref.current, { center, zoom: 16, disableDefaultUI: true, gestureHandling: "cooperative", clickableIcons: false, styles: CLEAN_MAP_STYLE });
        new google.maps.Marker({
          position: center,
          map,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: "#ea580c", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 }
        });
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [coords?.[0], coords?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!Array.isArray(coords) || coords.length !== 2 || failed) return null;
  return <div ref={ref} className="pcc-map" aria-label="Map showing the exact location" />;
}

// One line of contact info. Locked rows show what exists (so the buyer knows what they are paying for)
// next to a blurred placeholder bar, never invented digits.
function Row({ icon, label, locked, children, hint, action }) {
  return (
    <li className={`pcc-row ${locked ? "is-locked" : ""}`}>
      <span className="pcc-row-icon">{icon}</span>
      <span className="pcc-row-body">
        <small>{label}</small>
        {locked ? (
          <>
            <span className="pcc-blur" aria-hidden="true" />
            <span className="sr-only">Hidden until you unlock</span>
          </>
        ) : (
          children
        )}
        {locked && hint ? <em>{hint}</em> : null}
      </span>
      {locked ? <IconLock width={15} height={15} className="pcc-row-lock" /> : action}
    </li>
  );
}

function CopyButton({ value }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      // Clipboard blocked: the number is on screen to copy by hand.
    }
  };
  return (
    <button type="button" className="pcc-copy" onClick={copy}>
      {done ? "Copied" : "Copy"}
    </button>
  );
}

// The provider's profile and contact details in one card. Until the visitor pays the unlock fee it shows who
// the provider is, which channels they have and what unlocking gives; afterwards it becomes the call,
// WhatsApp and directions card. `variant="sidebar"` is sticky beside the page on desktop and a bottom bar +
// sheet on phones; `variant="inline"` just sits where it is placed (the product page).
export default function ProviderContactCard({ provider, fallback, pending, categoryName, listingName, onUnlock, variant = "sidebar" }) {
  const p = provider || {};
  const base = fallback || {};
  const name = p.businessName || base.businessName || "Seller";
  const locked = Boolean(p.contactLocked);
  const contact = p.contact || {};
  const location = p.location || {};
  const avail = p.contactAvailable || {};
  const stats = p.stats || {};
  const avatar = p.media?.avatarUrl || base.avatarUrl;
  const rating = p.ratingAvg ?? base.ratingAvg;
  const ratingCount = p.ratingCount ?? base.ratingCount;
  const area = [location.city, location.region].filter((v, i, a) => v && a.indexOf(v) === i).join(", ") || base.district || "";
  const joined = p.createdAt || base.memberSince;
  const [open, setOpen] = useState(false); // phone sheet
  const [aboutOpen, setAboutOpen] = useState(false);
  const description = p.description || "";
  const longAbout = description.length > 150;

  const track = (type, value) => p.id && trackContactEvent(p.id, type, value);
  const unlockedHasAnything = Boolean(contact.phone || contact.whatsapp || contact.website || contact.email || location.address);
  const fee = ugx(p.contactFee);

  // What the buyer would be paying for, from what this provider has actually filled in.
  const perks = [];
  if (avail.phone || avail.whatsapp) perks.push(`${avail.phone && avail.whatsapp ? "Phone and WhatsApp" : avail.phone ? "Phone number" : "WhatsApp"} for a direct line to the owner`);
  if (avail.address || avail.pin) perks.push(`${avail.address ? "Exact address" : "Location"}${avail.pin ? " with a map pin and directions" : ""}`);
  if (avail.website || avail.email) perks.push(`${avail.website && avail.email ? "Website and email" : avail.website ? "Website" : "Email"} details`);
  perks.push("Pay once and it stays unlocked on this device or your account");

  const card = (
    <div className={`pcc ${variant === "inline" ? "pcc-inline" : ""}`}>
      <div className="pcc-cover">
        <span className="pcc-verified"><IconShield width={14} height={14} /> Approved on Gabla</span>
        {variant === "sidebar" ? <button type="button" className="pcc-close" onClick={() => setOpen(false)} aria-label="Close"><IconClose width={18} height={18} /></button> : null}
      </div>

      <div className="pcc-head">
        {avatar ? <img src={avatar} alt="" className="pcc-avatar" /> : <span className="pcc-avatar pcc-initial">{name.trim().slice(0, 1).toUpperCase()}</span>}
        <div className="pcc-id">
          <h2>{variant === "inline" && p.id ? <Link to={`/provider/${p.id}`}>{name}</Link> : name}</h2>
          <p>{[categoryName, area].filter(Boolean).join(" · ")}</p>
          <span className="pcc-rating">
            <IconStar width={14} height={14} />
            {ratingCount ? <><strong>{Number(rating).toFixed(1)}</strong> <span>({ratingCount} reviews)</span></> : <span>New on Gabla</span>}
          </span>
        </div>
      </div>

      <div className="pcc-stats">
        <div><strong>{joined ? monthYear(joined) : "-"}</strong><small>Member since</small></div>
        <div><strong>{stats.listingCount ?? base.productCount ?? 0}</strong><small>Listings</small></div>
        <div>
          <strong>{stats.unlockCount >= 3 ? stats.unlockCount : <IconCheck width={18} height={18} />}</strong>
          <small>{stats.unlockCount >= 3 ? "Buyers reached out" : "Gabla approved"}</small>
        </div>
      </div>

      <div className="pcc-contact">
        <h3>Contact details</h3>
        {pending ? (
          <div className="pcc-pending"><span className="skel" /><span className="skel" /><span className="skel" /></div>
        ) : (
          <ul className="pcc-rows">
            {(locked ? avail.phone : contact.phone) ? (
              <Row icon={<IconPhone width={18} height={18} />} label="Phone number" locked={locked} action={contact.phone ? <CopyButton value={contact.phone} /> : null}>
                <a href={`tel:${contact.phone}`} onClick={() => track("call", contact.phone)}>{contact.phone}</a>
              </Row>
            ) : null}
            {(locked ? avail.whatsapp : contact.whatsapp) ? (
              <Row icon={<IconChat width={18} height={18} />} label="WhatsApp" locked={locked}>
                <a href={waLink(contact.whatsapp)} target="_blank" rel="noreferrer" onClick={() => track("whatsapp", contact.whatsapp)}>{contact.whatsapp}</a>
              </Row>
            ) : null}
            {(locked ? avail.website : contact.website) ? (
              <Row icon={<IconGlobe width={18} height={18} />} label="Website" locked={locked}>
                <a href={contact.website} target="_blank" rel="noreferrer" onClick={() => track("website", contact.website)}>{String(contact.website).replace(/^https?:\/\//, "")}</a>
              </Row>
            ) : null}
            {(locked ? avail.address || avail.pin : location.address) ? (
              <Row icon={<IconPin width={18} height={18} />} label="Exact address" locked={locked} hint={area ? `Somewhere in ${area}` : undefined}>
                <span>{location.address}</span>
              </Row>
            ) : null}
            {!locked && !unlockedHasAnything ? <li className="pcc-empty">This provider hasn&apos;t added contact details yet.</li> : null}
          </ul>
        )}
        {!locked && !pending ? <PinMap location={location} /> : null}
      </div>

      {locked && !pending ? (
        <div className="pcc-unlock">
          <ul className="pcc-perks">
            {perks.map((text) => (
              <li key={text}><IconCheck width={16} height={16} /> {text}</li>
            ))}
          </ul>
          <button type="button" className="pcc-cta" onClick={onUnlock}>
            <IconLock width={18} height={18} />
            <span>Unlock contact</span>
            <strong>{fee}</strong>
          </button>
          <p className="pcc-fine">One-time fee · pay with mobile money · no account needed</p>
        </div>
      ) : null}

      {!locked && !pending && unlockedHasAnything ? (
        <div className="pcc-actions">
          {contact.phone ? (
            <a className="pcc-btn pcc-btn-call" href={`tel:${contact.phone}`} onClick={() => track("call", contact.phone)}><IconPhone width={18} height={18} /> Call now</a>
          ) : null}
          {contact.whatsapp ? (
            <a
              className="pcc-btn pcc-btn-wa"
              href={waLink(contact.whatsapp, listingName ? `Hi, I'm interested in "${listingName}" on Gabla.` : `Hi ${name}, I found you on Gabla.`)}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("whatsapp", contact.whatsapp)}
            >
              <IconChat width={18} height={18} /> WhatsApp
            </a>
          ) : null}
          {directionsUrl(location) && (location.address || location.geo) ? (
            <a className="pcc-btn pcc-btn-dir" href={directionsUrl(location)} target="_blank" rel="noreferrer" onClick={() => track("directions")}><IconPin width={18} height={18} /> Get directions</a>
          ) : null}
        </div>
      ) : null}
      {description ? (
        <div className="pcc-about">
          <h3>About</h3>
          <p className={aboutOpen ? "" : "is-clamped"}>{description}</p>
          {longAbout ? <button type="button" onClick={() => setAboutOpen((v) => !v)}>{aboutOpen ? "Show less" : "Read more"}</button> : null}
        </div>
      ) : null}

    </div>
  );

  if (variant === "inline") return <section className="pcc-wrap pcc-wrap-inline" aria-label={`Contact ${name}`}>{card}</section>;

  return (
    <>
      <aside className={`pcc-wrap ${open ? "is-open" : ""}`} aria-label={`Contact ${name}`}>
        <div className="pcc-scrim" onClick={() => setOpen(false)} />
        {card}
      </aside>

      {/* On phones the card lives in a sheet, and this bar keeps the one action that matters on screen. */}
      <div className={`pcc-bar ${open ? "is-hidden" : ""}`}>
        <div className="pcc-bar-id">
          {avatar ? <img src={avatar} alt="" /> : <span>{name.trim().slice(0, 1).toUpperCase()}</span>}
          <div>
            <strong>{name}</strong>
            <small>{locked ? `${fee} · one-time` : "Contact unlocked"}</small>
          </div>
        </div>
        {!locked && contact.phone ? (
          <a className="pcc-bar-btn" href={`tel:${contact.phone}`} onClick={() => track("call", contact.phone)}><IconPhone width={18} height={18} /> Call</a>
        ) : null}
        <button type="button" className="pcc-bar-btn is-primary" onClick={() => setOpen(true)} disabled={pending}>
          {locked ? <><IconLock width={16} height={16} /> Unlock</> : "Details"}
        </button>
      </div>
    </>
  );
}
