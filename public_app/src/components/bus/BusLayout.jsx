import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { loginPath } from "../../lib/authRedirect";
import { clearSession, getSession } from "../../lib/session";
import { IconBus, IconCalendar, IconChevronLeft, IconStore, IconTicket } from "../icons";

// The bus experience has its own look (navy + orange, ticket-style cards) so it feels like a
// separate booking product inside Gabla, with an obvious way back to the main marketplace.
export default function BusLayout({ children, wide = false }) {
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
    <div className="bus-app">
      <header className="bus-header">
        <div className="bus-header-inner">
          <Link to="/bus" className="bus-brand" aria-label="Gabla Bus home">
            <span className="bus-brand-mark"><IconBus /></span>
            <span className="bus-brand-text"><strong>Gabla Bus</strong><small>Tickets across Uganda</small></span>
          </Link>
          <nav className="bus-nav" aria-label="Bus navigation">
            <NavLink to="/bus" end className={tabClass}>Book</NavLink>
            <NavLink to="/bus/parks" className={tabClass}>Bus parks</NavLink>
            <NavLink to="/bus/tickets" className={tabClass}>My tickets</NavLink>
          </nav>
          <div className="bus-header-actions">
            <Link to="/home" className="bus-back-link"><IconChevronLeft width={16} height={16} /> Gabla home</Link>
            {session ? (
              <button type="button" className="bus-btn bus-btn-ghost bus-btn-sm" onClick={logout}>Log out</button>
            ) : (
              <Link to={loginPath(location)} className="bus-btn bus-btn-primary bus-btn-sm">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <main className={`bus-main ${wide ? "bus-main-wide" : ""}`}>{children}</main>

      <footer className="bus-footer">
        <p><strong>Gabla Bus</strong> · Safe, simple bus tickets. Pay with MTN MoMo or Airtel Money. All times are East Africa Time (EAT).</p>
        <p><Link to="/bus/operator">Bus company? Sign in to your portal</Link></p>
      </footer>

      {/* Phone-style tab bar so the three main places are always a thumb away. */}
      <nav className="bus-tabbar" aria-label="Bus quick navigation">
        <NavLink to="/bus" end className={tabClass}><IconCalendar /><span>Book</span></NavLink>
        <NavLink to="/bus/parks" className={tabClass}><IconStore /><span>Parks</span></NavLink>
        <NavLink to="/bus/tickets" className={tabClass}><IconTicket /><span>Tickets</span></NavLink>
      </nav>
    </div>
  );
}
