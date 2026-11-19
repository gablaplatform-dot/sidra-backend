import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { loginPath } from "../lib/authRedirect";
import { formatUgx } from "../lib/format";
import { ORDER_STATUS } from "../lib/myOrders";
import { clearSession, getSession, setSession } from "../lib/session";
import { uploadFile } from "../lib/storage";
import LanguageSwitcher from "../components/LanguageSwitcher";
import SiteHeader from "../components/SiteHeader";
import { IconBookmark, IconBus, IconCalendar, IconCamera, IconCar, IconCart, IconChevronLeft, IconStar, IconStore, IconTicket } from "../components/icons";

const initial = (name) => (name || "G").trim().slice(0, 1).toUpperCase();
const dateLabel = (value) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// "Me": everything that belongs to the signed-in person in one place - who they are, the businesses they saved,
// their orders, tickets and posts, and the few settings that matter.
export default function Account() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSessionState] = useState(() => getSession());
  const user = session?.user;
  const shopper = user?.role === "user";

  const [saved, setSaved] = useState(null);
  const [orders, setOrders] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", district: "" });
  const [districts, setDistricts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const photoRef = useRef(null);
  const savedRef = useRef(null);

  const load = useCallback(() => {
    if (!session) return;
    request("/engagement/orders/mine?limit=3").then((r) => setOrders(r?.items || [])).catch(() => setOrders([]));
    if (shopper) request("/engagement/favorites").then((r) => setSaved(r?.items || [])).catch(() => setSaved([]));
    else setSaved([]);
  }, [session, shopper]);

  useEffect(load, [load]);
  useEffect(() => {
    if (!session) return;
    setForm({ name: user?.name || "", phone: user?.phone || "", district: user?.profile?.district || "" });
    request("/providers/districts").then((r) => setDistricts(Array.isArray(r) ? r : r?.items || [])).catch(() => {});
  }, [session, user?.name, user?.phone, user?.profile?.district]);

  // The header's bookmark lands here: bring the saved businesses into view.
  useEffect(() => {
    if (location.search.includes("tab=saved") && saved) savedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.search, saved]);

  const logout = () => {
    clearSession();
    setSessionState(null);
    navigate("/home");
  };

  const saveProfile = async (patch) => {
    const { user: updated } = await request("/auth/me", { method: "PATCH", body: JSON.stringify(patch) });
    const next = { ...session, user: { ...session.user, ...updated } };
    setSession(next);
    setSessionState(next);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setError(t("me.errName"));
    setBusy(true);
    setError("");
    try {
      await saveProfile({ name: form.name.trim(), phone: form.phone.trim() || null, profile: { district: form.district || null } });
      setEditing(false);
    } catch (e) {
      setError(e.message || t("me.errSave"));
    } finally {
      setBusy(false);
    }
  };

  const changePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const url = await uploadFile(file, "user-avatars", { register: false });
      await saveProfile({ avatarUrl: url });
    } catch (e) {
      setError(e.message || t("me.errPhoto"));
    } finally {
      setBusy(false);
    }
  };

  const unsave = async (providerId) => {
    setSaved((list) => (list || []).filter((item) => item.providerId !== providerId));
    request(`/engagement/favorites/${encodeURIComponent(providerId)}`, { method: "DELETE" }).catch(load);
  };

  if (!session) {
    return (
      <main className="home-shell home-themed">
        <SiteHeader session={null} onLogout={logout} />
        <div className="me-page">
          <section className="me-card me-signin">
            <h1>{t("me.signedOutTitle")}</h1>
            <p>{t("me.signedOutText")}</p>
            <Link to={loginPath(location)} className="cta-button">{t("nav.signIn")}</Link>
          </section>
          <section className="me-card">
            <h2>{t("me.language")}</h2>
            <LanguageSwitcher />
          </section>
        </div>
      </main>
    );
  }

  const links = [
    { to: "/bus/tickets", Icon: IconBus, label: t("me.busTickets") },
    { to: "/ride", Icon: IconCar, label: t("me.rides") },
    { to: "/jobs/mine", Icon: IconStore, label: t("me.myJobs") },
    { to: "/jobs/applications", Icon: IconStar, label: t("me.myApplications") },
    { to: "/events/saved", Icon: IconBookmark, label: t("me.savedEvents") },
    { to: "/events/tickets", Icon: IconTicket, label: t("me.eventTickets") },
    { to: "/events/mine", Icon: IconCalendar, label: t("me.myEvents") },
    { to: "/cart", Icon: IconCart, label: t("nav.cart") }
  ];

  return (
    <main className="home-shell home-themed">
      <SiteHeader session={session} onLogout={logout} />
      <div className="me-page">
        <section className="me-card me-head">
          <div className="me-avatar-wrap">
            <span className="me-avatar" style={user?.avatarUrl ? { backgroundImage: `url("${user.avatarUrl}")` } : undefined}>{!user?.avatarUrl ? initial(user?.name) : null}</span>
            <button type="button" className="me-avatar-edit" onClick={() => photoRef.current?.click()} disabled={busy} aria-label={t("me.changePhoto")}><IconCamera width={16} height={16} /></button>
            <input ref={photoRef} type="file" accept="image/*" hidden onChange={changePhoto} />
          </div>
          <div className="me-who">
            <h1>{user?.name}</h1>
            <p>{[user?.email, user?.phone].filter(Boolean).join(" · ")}</p>
            {user?.profile?.district ? <small>{user.profile.district}</small> : null}
          </div>
          <button type="button" className="secondary-button" onClick={() => setEditing((v) => !v)}>{editing ? t("me.cancel") : t("me.editProfile")}</button>
        </section>

        {editing ? (
          <form className="me-card me-form" onSubmit={submit}>
            <label><span>{t("me.name")}</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label>
            <label><span>{t("me.phone")}</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" autoComplete="tel" /></label>
            <label>
              <span>{t("me.district")}</span>
              <select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
                <option value="">{t("me.chooseDistrict")}</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            {error ? <div className="error-message">{error}</div> : null}
            <button type="submit" className="cta-button" disabled={busy}>{busy ? t("me.saving") : t("me.save")}</button>
          </form>
        ) : error ? <div className="error-message">{error}</div> : null}

        {user?.role === "provider" ? (
          <Link to="/profile" className="me-card me-business">
            <IconStore width={22} height={22} />
            <span><strong>{t("me.myBusiness")}</strong><small>{t("me.myBusinessSub")}</small></span>
            <IconChevronLeft className="me-chevron" />
          </Link>
        ) : null}

        {shopper ? (
          <section className="me-card" ref={savedRef}>
            <div className="me-section-head"><h2>{t("me.savedTitle")}</h2><span>{saved ? saved.length : ""}</span></div>
            {saved === null ? <p className="me-muted">…</p> : saved.length ? (
              <ul className="me-list">
                {saved.map((item) => (
                  <li key={item.id}>
                    <Link to={`/provider/${item.providerId}`} className="me-row">
                      <span className="me-mini" style={item.provider.media?.avatarUrl ? { backgroundImage: `url("${item.provider.media.avatarUrl}")` } : undefined}>{!item.provider.media?.avatarUrl ? initial(item.provider.businessName) : null}</span>
                      <span className="me-row-text"><strong>{item.provider.businessName}</strong><small>{item.provider.ratingCount ? `★ ${Number(item.provider.ratingAvg).toFixed(1)} (${item.provider.ratingCount})` : t("me.newBusiness")}</small></span>
                    </Link>
                    <button type="button" className="me-remove" onClick={() => unsave(item.providerId)}>{t("me.remove")}</button>
                  </li>
                ))}
              </ul>
            ) : <p className="me-muted">{t("me.savedEmpty")}</p>}
          </section>
        ) : null}

        <section className="me-card">
          <div className="me-section-head"><h2>{t("me.ordersTitle")}</h2><Link to="/orders">{t("me.seeAll")}</Link></div>
          {orders === null ? <p className="me-muted">…</p> : orders.length ? (
            <ul className="me-list">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link to="/orders" className="me-row">
                    <span className="me-row-text">
                      <strong>{order.provider?.businessName}</strong>
                      <small>{dateLabel(order.createdAt)} · {formatUgx(order.total)}</small>
                    </span>
                    <span className={`mo-chip mo-chip-${(ORDER_STATUS[order.status] || ORDER_STATUS.pending).tone}`}>{t(`orders.status.${ORDER_STATUS[order.status] ? order.status : "pending"}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="me-muted">{t("me.ordersEmpty")}</p>}
        </section>

        <section className="me-card">
          <h2>{t("me.moreTitle")}</h2>
          <div className="me-grid">
            {links.map(({ to, Icon, label }) => (
              <Link key={to} to={to} className="me-tile"><Icon width={22} height={22} /><span>{label}</span></Link>
            ))}
          </div>
        </section>

        <section className="me-card me-settings">
          <div className="me-setting"><span>{t("me.language")}</span><LanguageSwitcher /></div>
          <Link to="/account/delete" className="me-setting-link">{t("nav.deleteAccount")}</Link>
          <button type="button" className="secondary-button" onClick={logout}>{t("nav.logOut")}</button>
        </section>
      </div>
    </main>
  );
}
