import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getCartCount } from "../lib/cart";
import { IconBookmark, IconBus, IconCalendar, IconCar, IconCart, IconGrid, IconList, IconSearch, IconStore, IconTicket, IconUser, IconWrench } from "./icons";

// The phone's bottom navigation. One bar on every screen, and inside a module the bar turns into that module's own
// shortcuts (Shop: shop, categories, cart ...) with Home and Me always at the ends, so the thumb never has to reach
// the top of the screen to move around.

const IconHome = (props) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
  </svg>
);
const IconBriefcase = (props) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
  </svg>
);

const HOME = { key: "home", to: "/home", Icon: IconHome, match: (p) => p === "/home" || p === "/" };
const ME = { key: "me", to: "/me", Icon: IconUser, match: (p) => p === "/me" || p.startsWith("/me/") || p === "/orders" || p.startsWith("/account") || p === "/profile" || p.startsWith("/profile/") };
const starts = (prefix) => (p) => p === prefix || p.startsWith(`${prefix}/`);

const GLOBAL = [
  HOME,
  { key: "shop", to: "/shop", Icon: IconStore, match: starts("/shop") },
  { key: "services", to: "/services", Icon: IconWrench, match: starts("/services") },
  { key: "bus", to: "/bus", Icon: IconBus, match: starts("/bus") },
  { key: "ride", to: "/ride", Icon: IconCar, match: starts("/ride") },
  ME
];

const MODULES = [
  {
    test: (p) => p.startsWith("/shop") || p === "/cart",
    tabs: [
      HOME,
      { key: "shop", to: "/shop", Icon: IconStore, match: (p) => p === "/shop" || p.startsWith("/shop/product") || p.startsWith("/shop/new") || p.startsWith("/shop/best") || p.startsWith("/shop/all") },
      { key: "categories", to: "/shop/categories", Icon: IconGrid, match: starts("/shop/categories") },
      { key: "cart", to: "/cart", Icon: IconCart, match: starts("/cart"), badge: true },
      ME
    ]
  },
  {
    test: (p) => p.startsWith("/bus"),
    tabs: [
      HOME,
      { key: "book", to: "/bus", Icon: IconBus, match: (p) => p === "/bus" || p.startsWith("/bus/search") || p.startsWith("/bus/trip") },
      { key: "parks", to: "/bus/parks", Icon: IconStore, match: starts("/bus/parks") },
      { key: "tickets", to: "/bus/tickets", Icon: IconTicket, match: starts("/bus/tickets") },
      ME
    ]
  },
  {
    test: (p) => p.startsWith("/services") || p === "/search" || p.startsWith("/category/") || p.startsWith("/provider/"),
    tabs: [
      HOME,
      { key: "services", to: "/services", Icon: IconWrench, match: (p) => p === "/services" || p.startsWith("/category/") || p.startsWith("/provider/") },
      { key: "browse", to: "/services/all", Icon: IconGrid, match: starts("/services/all") },
      { key: "search", to: "/search", Icon: IconSearch, match: starts("/search") },
      ME
    ]
  },
  {
    test: (p) => p.startsWith("/jobs"),
    tabs: [
      HOME,
      { key: "jobs", to: "/jobs", Icon: IconBriefcase, match: (p) => p === "/jobs" || p.startsWith("/jobs/p/") },
      { key: "saved", to: "/jobs/saved", Icon: IconBookmark, match: starts("/jobs/saved") },
      { key: "mine", to: "/jobs/mine", Icon: IconList, match: (p) => starts("/jobs/mine")(p) || starts("/jobs/applications")(p) },
      ME
    ]
  },
  {
    test: (p) => p.startsWith("/events"),
    tabs: [
      HOME,
      { key: "events", to: "/events", Icon: IconCalendar, match: (p) => p === "/events" || p.startsWith("/events/p/") },
      { key: "saved", to: "/events/saved", Icon: IconBookmark, match: starts("/events/saved") },
      { key: "eventTickets", to: "/events/tickets", Icon: IconTicket, match: starts("/events/tickets") },
      ME
    ]
  }
];

// Screens that need the whole bottom of the screen for themselves.
const HIDDEN = [
  /^\/login/, /^\/welcome/, /^\/accept-invite/, /^\/provider\/onboarding/, /^\/profile\/listings/, /^\/bus\/operator/, /^\/bus\/onboarding/,
  /^\/(jobs|events)\/(new|edit)/, /^\/events\/p\/[^/]+\/door/
];

export default function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const ref = useRef(null);
  const [typing, setTyping] = useState(false);
  const [cart, setCart] = useState(() => getCartCount());

  const hidden = HIDDEN.some((re) => re.test(pathname));
  const tabs = (MODULES.find((m) => m.test(pathname)) || { tabs: GLOBAL }).tabs;

  useEffect(() => {
    const sync = () => setCart(getCartCount());
    window.addEventListener("gabla-cart-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gabla-cart-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // The on-screen keyboard needs the room: tuck the bar away while a field is being typed in.
  useEffect(() => {
    const isField = (el) => el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !["checkbox", "radio", "button", "submit", "file"].includes(el.type);
    const onIn = (e) => isField(e.target) && setTyping(true);
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  // Tell the page how much room the bar takes (pages with fixed bottoms and the home story use it).
  useLayoutEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const height = !hidden && ref.current && getComputedStyle(ref.current).display !== "none" ? ref.current.offsetHeight : 0;
      root.style.setProperty("--bn-px", String(height));
      document.body.classList.toggle("has-bn", height > 0);
      return height;
    };
    const before = root.style.getPropertyValue("--bn-px");
    const height = apply();
    if (String(height) !== before) window.dispatchEvent(new Event("resize"));
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [hidden, pathname]);

  if (hidden) return null;
  return (
    <nav ref={ref} className={`bn ${typing ? "is-typing" : ""}`} aria-label={t("bottomNav.aria")}>
      {tabs.map(({ key, to, Icon, match, badge }) => {
        const active = match(pathname);
        return (
          <NavLink key={key} to={to} className={`bn-item ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
            <span className="bn-icon">
              <Icon width={22} height={22} />
              {badge && cart > 0 ? <b className="bn-badge">{cart > 9 ? "9+" : cart}</b> : null}
            </span>
            <span className="bn-label">{t(`bottomNav.${key}`)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
