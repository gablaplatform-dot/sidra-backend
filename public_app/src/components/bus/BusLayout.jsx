import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { loginPath } from "../../lib/authRedirect";
import { clearSession, getSession } from "../../lib/session";
import { BusIcon, Calendar, ChevronLeft, Ticket, Building } from "./icons";

// The bus experience has its own look (warm sand + navy + orange, ticket-style cards) so it feels
// like a separate booking product inside Gabla, with an obvious way back to the main marketplace.
//   tabbar={false}  hides the phone tab bar (the trip page has its own sticky buy bar)
//   bare            no page padding at the bottom (pages that end in a full-bleed band)
export default function BusLayout({ children, tabbar = true }) {
  const location = useLocation();
  const [session, setSession] = useState(() => getSession());

  useEffect(() => {
    document.title = "Gabla Bus - book bus tickets in Uganda";
  }, []);

  const logout = () => {
    clearSession();
    setSession(null);
  };

  const tabClass = ({ isActive }) => `bus-nav-link ${isActive ? "is-active" : ""}`;

  return (
    <div className={`bus-app bus-cust ${tabbar ? "has-tabbar" : "no-tabbar"}`}>
      <a href="#bus-main" className="bus-skip">Skip to content</a>
      <header className="bus-header">
        <div className="bus-header-inner">
          <Link to="/bus" className="bus-brand" aria-label="Gabla Bus home">
            <span className="bus-brand-mark"><BusIcon size={22} /></span>
            <span className="bus-brand-text"><strong>Gabla Bus</strong><small>Tickets across Uganda</small></span>
          </Link>
          <nav className="bus-nav" aria-label="Bus navigation">
            <NavLink to="/bus" end className={tabClass}>Book</NavLink>
            <NavLink to="/bus/parks" className={tabClass}>Bus parks</NavLink>
            <NavLink to="/bus/tickets" className={tabClass}>My tickets</NavLink>
          </nav>
          <div className="bus-header-actions">
            <Link to="/home" className="bus-back-link"><ChevronLeft size={16} /> Gabla home</Link>
            {session ? (
              <button type="button" className="bus-btn bus-btn-light bus-btn-sm" onClick={logout}>Log out</button>
            ) : (
              <Link to={loginPath(location)} className="bus-btn bus-btn-navy bus-btn-sm">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <main className="bus-main" id="bus-main">{children}</main>

      <footer className="bus-footer">
        <div className="bus-footer-inner">
          <div className="bus-footer-brand">
            <span className="bus-brand-mark"><BusIcon size={20} /></span>
            <p><strong>Gabla Bus</strong>Safe, simple bus tickets across Uganda. Pay with MTN MoMo or Airtel Money. All times are East Africa Time (EAT).</p>
          </div>
          <nav className="bus-footer-links" aria-label="Footer">
            <Link to="/bus/parks">Bus parks</Link>
            <Link to="/bus/tickets">My tickets</Link>
            <Link to="/home">Gabla home</Link>
            <Link to="/bus/operator">Bus company? Sign in to your portal</Link>
          </nav>
        </div>
      </footer>

      {/* Phone-style tab bar so the three main places are always a thumb away. */}
      {tabbar ? (
        <nav className="bus-tabbar" aria-label="Bus quick navigation">
          <NavLink to="/bus" end className={tabClass}><Calendar size={22} /><span>Book</span></NavLink>
          <NavLink to="/bus/parks" className={tabClass}><Building size={22} /><span>Parks</span></NavLink>
          <NavLink to="/bus/tickets" className={tabClass}><Ticket size={22} /><span>Tickets</span></NavLink>
        </nav>
      ) : null}
    </div>
  );
}
