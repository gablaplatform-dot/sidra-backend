import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../busOperator.css";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import i18n from "../../i18n";

import { clearSession, getSession } from "../../lib/session";
import { eatTime, operatorApi, todayEat } from "../../lib/bus";
import { Skel } from "../../components/Skeleton";
import { Avatar, ErrorBox, Modal, OperatorContext, ShellContext, errMsg, useLoad, useToasts } from "../../components/bus/operator/ui";
import {
  IcArrowLeft, IcBuilding, IcBus, IcChevronDown, IcChevronRight, IcExternal, IcHome, IcLogout, IcMegaphone, IcReceipt, IcRoute, IcClock, IcScan, IcTrips, IcUsers, IcWallet, IcDots
} from "../../components/bus/operator/icons";
import { longDayLabel, useNow } from "../../components/bus/operator/util";

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

const BASE = "/bus/operator";
// `k` is the stable key; labels come from busOp.nav.<k> and groups from busOp.nav.g.<group>.
const NAV = [
  { to: BASE, end: true, k: "dashboard", Icon: IcHome, group: "operate" },
  { to: `${BASE}/trips`, k: "trips", Icon: IcTrips, group: "operate" },
  { to: `${BASE}/tickets`, k: "verify", Icon: IcScan, group: "operate" },
  { to: `${BASE}/bookings`, k: "orders", Icon: IcReceipt, group: "operate" },
  { to: `${BASE}/routes`, k: "routes", Icon: IcRoute, group: "network" },
  { to: `${BASE}/sessions`, k: "sessions", Icon: IcClock, group: "network" },
  { to: `${BASE}/customers`, k: "customers", Icon: IcUsers, group: "grow" },
  { to: `${BASE}/announcements`, k: "announcements", Icon: IcMegaphone, group: "grow" },
  { to: `${BASE}/payouts`, k: "payouts", Icon: IcWallet, group: "business" },
  { to: `${BASE}/profile`, k: "profile", Icon: IcBuilding, group: "business" }
];
const GROUPS = ["operate", "network", "grow", "business"];
const MORE = NAV.filter((n) => ["routes", "sessions", "customers", "announcements", "payouts", "profile"].includes(n.k));

const titleFor = (pathname) => {
  if (/\/trips\/[^/]+/.test(pathname)) return i18n.t("busOp.nav.trip");
  const hit = [...NAV].reverse().find((n) => (n.end ? pathname.replace(/\/$/, "") === n.to : pathname.startsWith(n.to)));
  return i18n.t(`busOp.nav.${hit?.k || "dashboard"}`);
};

function ShellSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="bus-app bop-app" role="status" aria-busy="true" aria-label={t("busOp.portal.loading")}>
      <aside className="bop-rail">
        <div className="bop-brand"><Skel w={44} h={44} r={14} /><div style={{ flex: 1, display: "grid", gap: 8 }}><Skel w="80%" h={14} /><Skel w="50%" h={10} /></div></div>
        <div style={{ display: "grid", gap: 8, marginTop: 28 }}>{Array.from({ length: 8 }).map((_, i) => <Skel key={i} h={44} r={12} />)}</div>
      </aside>
      <div className="bop-content">
        <div className="bop-topbar"><div style={{ display: "grid", gap: 8 }}><Skel w={180} h={22} /><Skel w={130} h={11} /></div></div>
        <main className="bop-main">
          <div className="bop-kpis">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bop-card bop-kpi"><Skel w="50%" h={11} /><Skel w="70%" h={28} style={{ marginTop: 14 }} /><Skel w="40%" h={10} style={{ marginTop: 12 }} /></div>)}</div>
          <Skel h={300} r={18} style={{ marginTop: 18 }} />
        </main>
      </div>
    </div>
  );
}

function Blocked({ title, children, logout }) {
  const { t } = useTranslation();
  return (
    <div className="bus-app bop-ob bop-blocked">
      <main className="bop-ob-center">
        <div className="bop-card bop-notice">
          <span className="bop-notice-icon is-error">!</span>
          <h1>{title}</h1>
          <p>{children}</p>
          <button type="button" className="bop-btn bop-btn-light" onClick={logout}>{t("nav.logOut")}</button>
        </div>
      </main>
    </div>
  );
}

function AccountMenu({ operator, logout }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="bop-account" ref={ref}>
      <button type="button" className="bop-account-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={operator.companyName} src={operator.logoUrl} size={36} square />
        <span className="bop-account-name">{operator.companyName}</span>
        <IcChevronDown size={16} />
      </button>
      {open ? (
        <div className="bop-menu" role="menu">
          <div className="bop-menu-head"><strong>{operator.companyName}</strong><small>{operator.email}</small></div>
          <Link role="menuitem" to={`${BASE}/profile`} onClick={() => setOpen(false)}><IcBuilding size={17} />{t("busOp.nav.profile")}</Link>
          <Link role="menuitem" to={`/bus/parks/${operator.slug}`} target="_blank" rel="noreferrer"><IcExternal size={17} />{t("busOp.portal.viewPublic")}</Link>
          <button role="menuitem" type="button" onClick={logout}><IcLogout size={17} />{t("nav.logOut")}</button>
        </div>
      ) : null}
    </div>
  );
}

function Portal({ session }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [more, setMore] = useState(false);
  const [meta, setMetaState] = useState(null);
  const [toast, toastView] = useToasts();
  const me = useLoad(() => operatorApi.get("/me"), []);
  const now = useNow(30000);

  const setMeta = useCallback((m) => setMetaState(m), []);
  const shell = useMemo(() => ({ setMeta }), [setMeta]);

  const logout = useCallback(() => {
    clearSession();
    navigate("/bus/operator/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    const onExpired = () => navigate("/bus/operator/login", { replace: true });
    window.addEventListener("gabla-session-expired", onExpired);
    return () => window.removeEventListener("gabla-session-expired", onExpired);
  }, [navigate]);
  useEffect(() => {
    setMore(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (me.loading && !me.data) return <ShellSkeleton />;
  if (me.error && !me.data) {
    if (me.error.status === 401) return <Navigate to="/bus/operator/login" replace />;
    if (me.error.code === "BUS_OPERATOR_SUSPENDED" || me.error.status === 403) {
      return <Blocked title={t("busOp.portal.suspendedTitle")} logout={logout}>{errMsg(me.error, t("busOp.portal.suspendedBody"))}</Blocked>;
    }
    return (
      <div className="bus-app bop-ob"><main className="bop-ob-center"><div style={{ width: "100%", maxWidth: 520 }}><ErrorBox error={me.error} onRetry={me.refresh} /><p style={{ marginTop: 14 }}><button className="bop-btn bop-btn-light" onClick={logout}>{t("nav.logOut")}</button></p></div></main></div>
    );
  }

  const { operator, questions } = me.data;
  if (operator.onboardingStatus !== "registered") {
    return (
      <Blocked title={t("busOp.portal.finishTitle")} logout={logout}>
        {t("busOp.portal.finishBody")}
      </Blocked>
    );
  }

  const ctx = { operator, questions, reloadMe: me.reload, toast, logout, session };
  const title = meta?.title || titleFor(location.pathname);
  const back = meta?.back || (/\/trips\/[^/]+/.test(location.pathname) ? `${BASE}/trips` : null);
  const verifyActive = location.pathname.startsWith(`${BASE}/tickets`);
  const moreActive = MORE.some((n) => location.pathname.startsWith(n.to));
  const isVerifyPage = verifyActive;

  return (
    <OperatorContext.Provider value={ctx}>
      <ShellContext.Provider value={shell}>
        <div className="bus-app bop-app">
          <a href="#bop-main" className="bop-skip">{t("busOp.portal.skip")}</a>
          <aside className="bop-rail" aria-label={t("busOp.portal.navLabel")}>
            <Link to={BASE} className="bop-brand" aria-label={t("busOp.nav.dashboard")}>
              <Avatar name={operator.companyName} src={operator.logoUrl} size={44} square />
              <span className="bop-brand-text"><strong>{operator.companyName}</strong><small><IcBus size={12} /> {t("busOp.portal.portalName")}</small></span>
            </Link>
            <nav className="bop-nav">
              {GROUPS.map((g) => (
                <div className="bop-nav-group" key={g}>
                  <span className="bop-nav-title">{t(`busOp.nav.g.${g}`)}</span>
                  {NAV.filter((n) => n.group === g).map(({ to, end, k, Icon }) => (
                    <NavLink key={to} to={to} end={end} title={t(`busOp.nav.${k}`)} className={({ isActive }) => `bop-nav-link ${isActive ? "is-active" : ""}`}>
                      <Icon size={20} /><span>{t(`busOp.nav.${k}`)}</span>
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
            <div className="bop-rail-foot">
              <Link to={`/bus/parks/${operator.slug}`} className="bop-nav-link" target="_blank" rel="noreferrer" title={t("busOp.portal.viewPublic")}><IcExternal size={19} /><span>{t("busOp.portal.viewPublic")}</span></Link>
              <button type="button" className="bop-nav-link" onClick={logout} title={t("nav.logOut")}><IcLogout size={19} /><span>{t("nav.logOut")}</span></button>
            </div>
          </aside>

          <div className="bop-content">
            <header className="bop-topbar">
              {back ? <Link to={back} className="bop-back" aria-label={t("busOp.portal.back")}><IcArrowLeft size={20} /></Link> : <Link to={BASE} className="bop-topbar-logo" aria-label={t("busOp.nav.dashboard")}><Avatar name={operator.companyName} src={operator.logoUrl} size={34} square /></Link>}
              <div className="bop-topbar-title">
                <h1>{title}</h1>
                <p><span className="bop-live" aria-hidden="true" />{longDayLabel(todayEat())} · {eatTime(now)} EAT</p>
              </div>
              <div className="bop-topbar-actions">
                {!isVerifyPage ? <Link to={`${BASE}/tickets`} className="bop-btn bop-btn-primary bop-btn-sm bop-topbar-verify"><IcScan size={18} /> {t("busOp.portal.verifyTicket")}</Link> : null}
                <AccountMenu operator={operator} logout={logout} />
              </div>
            </header>
            <main className="bop-main" id="bop-main">
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

          <nav className="bop-tabbar" aria-label={t("busOp.portal.quickNav")}>
            <NavLink to={BASE} end className={({ isActive }) => `bop-tab ${isActive ? "is-active" : ""}`}><IcHome size={22} /><span>{t("nav.home")}</span></NavLink>
            <NavLink to={`${BASE}/trips`} className={({ isActive }) => `bop-tab ${isActive ? "is-active" : ""}`}><IcTrips size={22} /><span>{t("busOp.nav.trips")}</span></NavLink>
            <NavLink to={`${BASE}/tickets`} className={({ isActive }) => `bop-tab bop-tab-fab ${isActive ? "is-active" : ""}`} aria-label={t("busOp.nav.verify")}><b><IcScan size={26} strokeWidth={2.1} /></b><span>{t("busOp.nav.verifyShort")}</span></NavLink>
            <NavLink to={`${BASE}/bookings`} className={({ isActive }) => `bop-tab ${isActive ? "is-active" : ""}`}><IcReceipt size={22} /><span>{t("busOp.nav.orders")}</span></NavLink>
            <button type="button" className={`bop-tab ${moreActive || more ? "is-active" : ""}`} onClick={() => setMore(true)}><IcDots size={22} /><span>{t("busOp.portal.more")}</span></button>
          </nav>

          {more ? (
            <Modal title={t("busOp.portal.more")} subtitle={operator.companyName} onClose={() => setMore(false)} size="sm">
              <div className="bop-more-grid">
                {MORE.map(({ to, k, Icon }) => (
                  <Link key={to} to={to} className="bop-more-tile" onClick={() => setMore(false)}><span><Icon size={22} /></span>{t(`busOp.nav.${k}`)}</Link>
                ))}
              </div>
              <div className="bop-more-list">
                <Link to={`/bus/parks/${operator.slug}`} target="_blank" rel="noreferrer"><IcExternal size={19} /><span>{t("busOp.portal.viewPublic")}</span><IcChevronRight size={16} /></Link>
                <button type="button" onClick={logout}><IcLogout size={19} /><span>{t("nav.logOut")}</span><IcChevronRight size={16} /></button>
              </div>
            </Modal>
          ) : null}
          {toastView}
        </div>
      </ShellContext.Provider>
    </OperatorContext.Provider>
  );
}

export default function BusOperatorPortal() {
  const session = getSession();
  if (!session || session.user?.role !== "bus_operator") return <Navigate to="/bus/operator/login" replace />;
  return <Portal session={session} />;
}
