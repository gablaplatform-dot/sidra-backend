import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { loginPath } from "../../lib/authRedirect";
import BackButton from "../BackButton";
import { clearSession, getSession } from "../../lib/session";
import { BusIcon, Calendar, ChevronLeft, Ticket, Building } from "./icons";

// The bus experience has its own look (warm sand + navy + orange, ticket-style cards) so it feels
// like a separate booking product inside Gabla, with an obvious way back to the main marketplace.
//   tabbar={false}  hides the phone tab bar (the trip page has its own sticky buy bar)
//   bare            no page padding at the bottom (pages that end in a full-bleed band)
export default function BusLayout({ children, tabbar = true }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [session, setSession] = useState(() => getSession());

  useEffect(() => {
    document.title = t("bus.layout.docTitle");
  }, [t, i18n.language]);

  const logout = () => {
    clearSession();
    setSession(null);
  };

  const tabClass = ({ isActive }) => `bus-nav-link ${isActive ? "is-active" : ""}`;

  return (
    <div className={`bus-app bus-cust ${tabbar ? "has-tabbar" : "no-tabbar"}`}>
      <a href="#bus-main" className="bus-skip">{t("bus.layout.skip")}</a>
      <header className="bus-header">
        <div className="bus-header-inner">
          <BackButton className="back-btn-bus" fallback={location.pathname === "/bus" ? "/home" : "/bus"} />
          <Link to="/bus" className="bus-brand" aria-label={t("bus.layout.homeAria")}>
            <span className="bus-brand-mark"><BusIcon size={22} /></span>
            <span className="bus-brand-text"><strong>Gabla Bus</strong><small>{t("bus.layout.tagline")}</small></span>
          </Link>
          <nav className="bus-nav" aria-label={t("bus.layout.navAria")}>
            <NavLink to="/bus" end className={tabClass}>{t("bus.layout.book")}</NavLink>
            <NavLink to="/bus/parks" className={tabClass}>{t("bus.layout.busParks")}</NavLink>
            <NavLink to="/bus/tickets" className={tabClass}>{t("bus.layout.myTickets")}</NavLink>
          </nav>
          <div className="bus-header-actions">
            <Link to="/home" className="bus-back-link"><ChevronLeft size={16} /> {t("bus.layout.gablaHome")}</Link>
            {session ? (
              <button type="button" className="bus-btn bus-btn-light bus-btn-sm" onClick={logout}>{t("nav.logOut")}</button>
            ) : (
              <Link to={loginPath(location)} className="bus-btn bus-btn-navy bus-btn-sm">{t("nav.signIn")}</Link>
            )}
          </div>
        </div>
      </header>

      <main className="bus-main" id="bus-main">{children}</main>

      <footer className="bus-footer">
        <div className="bus-footer-inner">
          <div className="bus-footer-brand">
            <span className="bus-brand-mark"><BusIcon size={20} /></span>
            <p><strong>Gabla Bus</strong>{t("bus.layout.footerBlurb")}</p>
          </div>
          <nav className="bus-footer-links" aria-label={t("bus.layout.footerAria")}>
            <Link to="/bus/parks">{t("bus.layout.busParks")}</Link>
            <Link to="/bus/tickets">{t("bus.layout.myTickets")}</Link>
            <Link to="/home">{t("bus.layout.gablaHome")}</Link>
            <Link to="/bus/operator">{t("bus.layout.operatorLink")}</Link>
          </nav>
        </div>
      </footer>

      {/* Phone-style tab bar so the three main places are always a thumb away. */}
      {tabbar ? (
        <nav className="bus-tabbar" aria-label={t("bus.layout.tabbarAria")}>
          <NavLink to="/bus" end className={tabClass}><Calendar size={22} /><span>{t("bus.layout.book")}</span></NavLink>
          <NavLink to="/bus/parks" className={tabClass}><Building size={22} /><span>{t("bus.layout.parks")}</span></NavLink>
          <NavLink to="/bus/tickets" className={tabClass}><Ticket size={22} /><span>{t("bus.layout.tickets")}</span></NavLink>
        </nav>
      ) : null}
    </div>
  );
}
