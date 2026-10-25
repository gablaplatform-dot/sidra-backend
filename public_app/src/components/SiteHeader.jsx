import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { loginPath } from "../lib/authRedirect";

import { getCartCount } from "../lib/cart";
import BackButton from "./BackButton";
import LanguageSwitcher from "./LanguageSwitcher";
import { IconBookmark, IconCart, IconClose, IconMenu, IconSearch } from "./icons";

const NAV_LINKS = [
  { key: "home", href: "/home#top" },
  { key: "shop", href: "/shop" },
  { key: "ride", href: "/ride" },
  { key: "busTickets", href: "/bus" },
  { key: "categories", href: "/home#categories" },
  { key: "providers", href: "/home#providers" },
  { key: "about", href: "/home#about" }
];

export default function SiteHeader({ session, onLogout }) {
  const { t } = useTranslation();
  const location = useLocation();
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
        {location.pathname !== "/home" ? <BackButton /> : null}
        <Link to="/home#top" className="brand shop-themed-brand">
          <span className="brand-mark shop-themed-brand-mark">G</span>
          <strong>Gabla</strong>
        </Link>

        <nav className="site-nav shop-themed-nav">
          {NAV_LINKS.map((link) => (
            <Link key={link.key} to={link.href}>{t(`nav.${link.key}`)}</Link>
          ))}
          {session ? <Link to="/orders">{t("nav.myOrders")}</Link> : null}
          {isProvider ? <Link to="/profile">{t("nav.profile")}</Link> : null}
        </nav>

        <div className="header-actions">
          <Link to="/search" className="icon-button shop-themed-icon" aria-label={t("nav.search")}>
            <IconSearch />
          </Link>
          <button type="button" className="icon-button shop-themed-icon" aria-label={t("nav.savedProviders")}>
            <IconBookmark />
          </button>
          <Link to="/cart" className="icon-button shop-themed-icon cart-button" aria-label={t("nav.cart")}>
            <IconCart />
            {cartCount > 0 ? <span className="cart-badge shop-themed-cart-badge">{cartCount}</span> : null}
          </Link>
          {session ? (
            <button type="button" className="cta-button shop-themed-cta" onClick={onLogout}>{t("nav.logOut")}</button>
          ) : (
            <Link className="cta-button shop-themed-cta" to={loginPath(location)}>{t("nav.signIn")}</Link>
          )}
          <LanguageSwitcher />
          <button
            type="button"
            className="icon-button shop-themed-icon hamburger"
            aria-label={t("nav.openMenu")}
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
          <button type="button" className="icon-button shop-themed-icon" aria-label={t("nav.closeMenu")} onClick={closeDrawer}>
            <IconClose />
          </button>
        </div>
        <nav className="drawer-links shop-themed-drawer-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.key} to={link.href} onClick={closeDrawer}>{t(`nav.${link.key}`)}</Link>
          ))}
          <Link to="/cart" onClick={closeDrawer}>{t("nav.cart")}{cartCount > 0 ? ` (${cartCount})` : ""}</Link>
          {session ? <Link to="/orders" onClick={closeDrawer}>{t("nav.myOrders")}</Link> : null}
          {isProvider ? <Link to="/profile" onClick={closeDrawer}>{t("nav.profile")}</Link> : null}
          {session ? <Link to="/account/delete" onClick={closeDrawer}>{t("nav.deleteAccount")}</Link> : null}
        </nav>
        {session ? (
          <button type="button" className="cta-button drawer-cta shop-themed-cta" onClick={() => { closeDrawer(); onLogout(); }}>{t("nav.logOut")}</button>
        ) : (
          <Link className="cta-button drawer-cta shop-themed-cta" to={loginPath(location)} onClick={closeDrawer}>{t("nav.signIn")}</Link>
        )}
      </aside>
    </>
  );
}
