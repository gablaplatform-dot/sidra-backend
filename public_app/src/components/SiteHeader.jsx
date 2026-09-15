import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getCartCount } from "../lib/cart";
import { IconBookmark, IconCart, IconClose, IconMenu, IconSearch } from "./icons";

const NAV_LINKS = [
  { label: "Home", href: "/home#top" },
  { label: "Shop", href: "/shop" },
  { label: "Ride", href: "/ride" },
  { label: "Categories", href: "/home#categories" },
  { label: "Providers", href: "/home#providers" },
  { label: "About", href: "/home#about" }
];

export default function SiteHeader({ session, onLogout }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartCount, setCartCount] = useState(() => getCartCount());

  useEffect(() => {
    const sync = () => setCartCount(getCartCount());
    window.addEventListener("gabla-cart-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gabla-cart-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const closeDrawer = () => setDrawerOpen(false);
  const isProvider = Boolean(session?.provider);

  return (
    <>
      <header className="site-header shop-themed-header" id="top">
        <Link to="/home#top" className="brand shop-themed-brand">
          <span className="brand-mark shop-themed-brand-mark">G</span>
          <strong>Gabla</strong>
        </Link>

        <nav className="site-nav shop-themed-nav">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} to={link.href}>{link.label}</Link>
          ))}
          {isProvider ? <Link to="/profile">Profile</Link> : null}
        </nav>

        <div className="header-actions">
          <Link to="/search" className="icon-button shop-themed-icon" aria-label="Search">
            <IconSearch />
          </Link>
          <button type="button" className="icon-button shop-themed-icon" aria-label="Saved providers">
            <IconBookmark />
          </button>
          <Link to="/cart" className="icon-button shop-themed-icon cart-button" aria-label="Cart">
            <IconCart />
            {cartCount > 0 ? <span className="cart-badge shop-themed-cart-badge">{cartCount}</span> : null}
          </Link>
          {session ? (
            <button type="button" className="cta-button shop-themed-cta" onClick={onLogout}>Log out</button>
          ) : (
            <Link className="cta-button shop-themed-cta" to="/login">Sign in</Link>
          )}
          <button
            type="button"
            className="icon-button shop-themed-icon hamburger"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <IconMenu />
          </button>
        </div>
      </header>

      <div className={`drawer-overlay ${drawerOpen ? "is-open" : ""}`} onClick={closeDrawer} />
      <aside className={`drawer shop-themed-drawer ${drawerOpen ? "is-open" : ""}`}>
        <div className="drawer-top">
          <div className="brand shop-themed-brand">
            <span className="brand-mark shop-themed-brand-mark">G</span>
            <strong>Gabla</strong>
          </div>
          <button type="button" className="icon-button shop-themed-icon" aria-label="Close menu" onClick={closeDrawer}>
            <IconClose />
          </button>
        </div>
        <nav className="drawer-links shop-themed-drawer-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} to={link.href} onClick={closeDrawer}>{link.label}</Link>
          ))}
          <Link to="/cart" onClick={closeDrawer}>Cart{cartCount > 0 ? ` (${cartCount})` : ""}</Link>
          {isProvider ? <Link to="/profile" onClick={closeDrawer}>Profile</Link> : null}
        </nav>
        {session ? (
          <button type="button" className="cta-button drawer-cta shop-themed-cta" onClick={() => { closeDrawer(); onLogout(); }}>Log out</button>
        ) : (
          <Link className="cta-button drawer-cta shop-themed-cta" to="/login" onClick={closeDrawer}>Sign in</Link>
        )}
      </aside>
    </>
  );
}
