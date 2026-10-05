import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { clearSession, getSession } from "../../lib/session";
import { operatorApi } from "../../lib/bus";
import { Skel } from "../../components/Skeleton";
import {
  IconCalendar, IconChat, IconClockIcon, IconClose, IconMenu, IconPin, IconQr, IconReceipt, IconStore, IconTarget, IconUsers, IconWallet
} from "../../components/icons";
import { ErrorBox, IconExternal, IconLogout, OperatorContext, errMsg, useLoad, useToasts } from "../../components/bus/operator/ui";

import OperatorDashboard from "./operator/OperatorDashboard";
import OperatorTrips from "./operator/OperatorTrips";
import OperatorTripDetail from "./operator/OperatorTripDetail";
import OperatorRoutes from "./operator/OperatorRoutes";
import OperatorSessions from "./operator/OperatorSessions";
import OperatorTickets from "./operator/OperatorTickets";
import OperatorBookings from "./operator/OperatorBookings";
import OperatorCustomers from "./operator/OperatorCustomers";
import OperatorAnnouncements from "./operator/OperatorAnnouncements";
import OperatorPayouts from "./operator/OperatorPayouts";
import OperatorProfile from "./operator/OperatorProfile";

const NAV = [
  { to: "/bus/operator", end: true, label: "Dashboard", Icon: IconTarget, tab: true },
  { to: "/bus/operator/trips", label: "Trips", Icon: IconCalendar, tab: true },
  { to: "/bus/operator/tickets", label: "Verify tickets", short: "Verify", Icon: IconQr, tab: true },
  { to: "/bus/operator/bookings", label: "Bookings", Icon: IconReceipt, tab: true },
  { to: "/bus/operator/routes", label: "Routes & prices", Icon: IconPin },
  { to: "/bus/operator/sessions", label: "Sessions", Icon: IconClockIcon },
  { to: "/bus/operator/customers", label: "Customers", Icon: IconUsers },
  { to: "/bus/operator/announcements", label: "Announcements", Icon: IconChat },
  { to: "/bus/operator/payouts", label: "Payouts", Icon: IconWallet },
  { to: "/bus/operator/profile", label: "Company profile", Icon: IconStore }
];

function ShellSkeleton() {
  return (
    <div className="bus-app bop-app">
      <aside className="bop-side"><Skel w={160} h={44} r={12} /><div style={{ display: "grid", gap: 10, marginTop: 28 }}>{Array.from({ length: 8 }).map((_, i) => <Skel key={i} h={38} r={10} />)}</div></aside>
      <div className="bop-content"><main className="bop-main" role="status" aria-busy="true" aria-label="Loading your portal"><Skel w="30%" h={28} /><div style={{ display: "grid", gap: 14, marginTop: 24, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>{Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={110} r={18} />)}</div><Skel h={260} r={18} style={{ marginTop: 18 }} /></main></div>
    </div>
  );
}

function Blocked({ title, children, logout }) {
  return (
    <div className="bus-app bop-ob">
      <main className="bop-ob-main">
        <div className="bus-card bop-ob-notice">
          <span className="bop-ob-notice-icon is-error">!</span>
          <h1>{title}</h1>
          <p>{children}</p>
          <button type="button" className="bus-btn bus-btn-light" onClick={logout}>Log out</button>
        </div>
      </main>
    </div>
  );
}

function Portal({ session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [toast, toastView] = useToasts();
  const me = useLoad(() => operatorApi.get("/me"), []);

  const logout = useCallback(() => {
    clearSession();
    navigate("/bus/operator/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    const onExpired = () => navigate("/bus/operator/login", { replace: true });
    window.addEventListener("gabla-session-expired", onExpired);
    return () => window.removeEventListener("gabla-session-expired", onExpired);
  }, [navigate]);
  useEffect(() => setMenu(false), [location.pathname]);

  if (me.loading && !me.data) return <ShellSkeleton />;
  if (me.error && !me.data) {
    if (me.error.status === 401) return <Navigate to="/bus/operator/login" replace />;
    if (me.error.code === "BUS_OPERATOR_SUSPENDED" || me.error.status === 403) {
      return <Blocked title="Your account is suspended" logout={logout}>{errMsg(me.error, "This bus company has been suspended. Contact Gabla support.")}</Blocked>;
    }
    return (
      <div className="bus-app bop-ob"><main className="bop-ob-main"><ErrorBox error={me.error} onRetry={me.refresh} /><p style={{ marginTop: 14 }}><button className="bus-btn bus-btn-light" onClick={logout}>Log out</button></p></main></div>
    );
  }

  const { operator, questions } = me.data;
  if (operator.onboardingStatus !== "registered") {
    return (
      <Blocked title="Finish setting up your company" logout={logout}>
        Open the invitation email from Gabla and follow its link to complete your onboarding. Ask Gabla to resend the invitation if you can’t find it.
      </Blocked>
    );
  }

  const ctx = { operator, questions, reloadMe: me.reload, toast, logout, session };
  const initial = (operator.companyName || "B").slice(0, 1).toUpperCase();

  const Brand = (
    <div className="bop-company">
      <span className="bop-company-logo">{operator.logoUrl ? <img src={operator.logoUrl} alt="" /> : initial}</span>
      <div><strong>{operator.companyName}</strong><small>Gabla Bus portal</small></div>
    </div>
  );
  const links = (
    <>
      <nav className="bop-nav" aria-label="Portal">
        {NAV.map(({ to, end, label, Icon }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `bop-nav-link ${isActive ? "is-active" : ""}`}><Icon width={19} height={19} /><span>{label}</span></NavLink>
        ))}
      </nav>
      <div className="bop-side-foot">
        <Link to={`/bus/parks/${operator.slug}`} className="bop-nav-link" target="_blank" rel="noreferrer"><IconExternal width={18} height={18} /><span>View public page</span></Link>
        <button type="button" className="bop-nav-link" onClick={logout}><IconLogout width={18} height={18} /><span>Log out</span></button>
      </div>
    </>
  );

  return (
    <OperatorContext.Provider value={ctx}>
      <div className="bus-app bop-app">
        <aside className="bop-side">{Brand}{links}</aside>

        <div className="bop-content">
          <header className="bop-topbar">
            <span className="bop-company-logo">{operator.logoUrl ? <img src={operator.logoUrl} alt="" /> : initial}</span>
            <strong>{operator.companyName}</strong>
            <button type="button" className="bop-icon-btn bop-topbar-menu" onClick={() => setMenu(true)} aria-label="Open menu"><IconMenu /></button>
          </header>
          <main className="bop-main">
            <Routes>
              <Route index element={<OperatorDashboard />} />
              <Route path="trips" element={<OperatorTrips />} />
              <Route path="trips/:tripId" element={<OperatorTripDetail />} />
              <Route path="routes" element={<OperatorRoutes />} />
              <Route path="sessions" element={<OperatorSessions />} />
              <Route path="tickets" element={<OperatorTickets />} />
              <Route path="bookings" element={<OperatorBookings />} />
              <Route path="customers" element={<OperatorCustomers />} />
              <Route path="announcements" element={<OperatorAnnouncements />} />
              <Route path="payouts" element={<OperatorPayouts />} />
              <Route path="profile" element={<OperatorProfile />} />
              <Route path="*" element={<Navigate to="/bus/operator" replace />} />
            </Routes>
          </main>
        </div>

        <nav className="bop-tabbar" aria-label="Quick navigation">
          {NAV.filter((n) => n.tab).map(({ to, end, label, short, Icon }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `bop-tab ${isActive ? "is-active" : ""}`}><Icon width={22} height={22} /><span>{short || label}</span></NavLink>
          ))}
          <button type="button" className={`bop-tab ${menu ? "is-active" : ""}`} onClick={() => setMenu(true)}><IconMenu width={22} height={22} /><span>More</span></button>
        </nav>

        {menu ? (
          <div className="bop-drawer-back" onMouseDown={(e) => e.target === e.currentTarget && setMenu(false)}>
            <div className="bop-drawer" role="dialog" aria-label="Menu">
              <div className="bop-drawer-head">{Brand}<button type="button" className="bop-icon-btn" onClick={() => setMenu(false)} aria-label="Close menu"><IconClose /></button></div>
              {links}
            </div>
          </div>
        ) : null}
        {toastView}
      </div>
    </OperatorContext.Provider>
  );
}

export default function BusOperatorPortal() {
  const session = getSession();
  if (!session || session.user?.role !== "bus_operator") return <Navigate to="/bus/operator/login" replace />;
  return <Portal session={session} />;
}
