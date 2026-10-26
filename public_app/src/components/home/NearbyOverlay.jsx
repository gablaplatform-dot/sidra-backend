import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { getSession } from "../../lib/session";
import NearbyFinder from "../mobilehome/NearbyFinder";
import { IconClose } from "../icons";

// The home search is a "find it near me" search: submitting it opens this full-screen map + list of matching
// products and services around the visitor, nearest first.
export default function NearbyOverlay({ text, onTextChange, onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="mh nb-overlay" role="dialog" aria-modal="true" aria-label={t("nearby.ariaLabel")}>
      <div className="nb-overlay-inner">
        <button type="button" className="nb-overlay-close" onClick={onClose} aria-label={t("nearby.close")}><IconClose /></button>
        <NearbyFinder session={getSession()} initialText={text} onTextChange={onTextChange} />
      </div>
    </div>
  );
}
