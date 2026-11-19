import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { loginPath } from "../lib/authRedirect";
import { getSession } from "../lib/session";
import { IconBookmark } from "./icons";

// Keeps a business in the shopper's "Saved businesses" (Me -> Saved). Signed-out visitors are sent to sign in first.
export default function SaveBusinessButton({ providerId, className = "" }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const session = getSession();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const shopper = session?.user?.role === "user";

  useEffect(() => {
    if (!shopper || !providerId) return undefined;
    let active = true;
    request("/engagement/favorites")
      .then((result) => active && setSaved((result?.items || []).some((item) => item.providerId === providerId)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shopper, providerId]);

  // Sellers and admins browse as themselves; saving is a shopper's tool.
  if (session && !shopper) return null;

  const toggle = async () => {
    if (!session) return navigate(loginPath(location));
    setBusy(true);
    try {
      await request(`/engagement/favorites/${encodeURIComponent(providerId)}`, { method: saved ? "DELETE" : "POST" });
      setSaved(!saved);
    } catch {
      /* the button simply stays as it was */
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className={`sbb ${saved ? "is-saved" : ""} ${className}`.trim()} onClick={toggle} disabled={busy} aria-pressed={saved}>
      <IconBookmark width={18} height={18} fill={saved ? "currentColor" : "none"} />
      <span>{saved ? t("me.saved") : t("me.save")}</span>
    </button>
  );
}
