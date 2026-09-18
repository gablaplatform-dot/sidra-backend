import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NAV_LINKS } from "../../data/shopData";
import { getCartCount } from "../../lib/cart";
import { IconSearch, IconCart, IconMenu, IconClose, IconChevronLeft } from "../icons";

const IconHeart = (props) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);

const IconUser = (props) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </svg>
);

export default function ShopNavbar({ session, onLogout }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartCount, setCartCount] = useState(() => getCartCount());
  const isProvider = Boolean(session?.provider);

  useEffect(() => {
    const sync = () => setCartCount(getCartCount());
    window.addEventListener("gabla-cart-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gabla-cart-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <>
      <header className="shop-navbar">
        <div className="shop-navbar-inner">
          <Link to="/home" className="shop-brand">
            <span className="shop-brand-mark">G</span>
            <strong>Gabla</strong>
          </Link>

          <nav className="shop-nav-links">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} to={link.href} className={link.label === "Shop" ? "is-active" : ""}>
                {link.label}
                {link.dropdown ? <span className="shop-nav-chevron"><IconChevronLeft /></span> : null}
              </Link>
            ))}
            {isProvider ? <Link to="/profile">Profile</Link> : null}
          </nav>

          <div className="shop-nav-actions">
            <button type="button" className="shop-icon-button" aria-label="Search">
              <IconSearch />
            </button>
            <button type="button" className="shop-icon-button" aria-label="Wishlist">
              <IconHeart />
            </button>
            <button type="button" className="shop-icon-button" aria-label="Account">
              <IconUser />
            </button>
            <Link to="/cart" className="shop-icon-button" aria-label="Cart">
              <IconCart />
              {cartCount > 0 ? <span className="shop-cart-badge">{cartCount}</span> : null}
            </Link>
            <button
              type="button"
              className="shop-icon-button shop-hamburger"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
            >
              <IconMenu />
            </button>
          </div>
        </div>
      </header>

      <div className={`shop-drawer-overlay ${drawerOpen ? "is-open" : ""}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`shop-drawer ${drawerOpen ? "is-open" : ""}`}>
        <div className="shop-drawer-top">
          <Link to="/home" className="shop-brand" onClick={() => setDrawerOpen(false)}>
            <span className="shop-brand-mark">G</span>
            <strong>Gabla</strong>
          </Link>
          <button type="button" className="shop-icon-button" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>
            <IconClose />
          </button>
        </div>
        <nav className="shop-drawer-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} to={link.href} onClick={() => setDrawerOpen(false)}>{link.label}</Link>
          ))}
          <Link to="/cart" onClick={() => setDrawerOpen(false)}>Cart{cartCount > 0 ? ` (${cartCount})` : ""}</Link>
          {isProvider ? <Link to="/profile" onClick={() => setDrawerOpen(false)}>Profile</Link> : null}
        </nav>
        {session ? (
          <button type="button" className="shop-cta-button shop-drawer-cta" onClick={() => { setDrawerOpen(false); onLogout?.(); }}>Log out</button>
        ) : (
          <Link className="shop-cta-button shop-drawer-cta" to="/login" onClick={() => setDrawerOpen(false)}>Sign in</Link>
        )}
      </aside>
    </>
  );
}
