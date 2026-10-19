import React from "react";
import { useTranslation } from "react-i18next";

import { LANGUAGES } from "../i18n";

// Native-name picker; the choice is remembered in localStorage by the i18next language detector.
export default function LanguageSwitcher({ className = "" }) {
  const { t, i18n } = useTranslation();

  return (
    <select
      className={`lang-switch ${className}`.trim()}
      value={i18n.resolvedLanguage}
      onChange={(event) => i18n.changeLanguage(event.target.value)}
      aria-label={t("lang.label")}
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>{lang.native}</option>
      ))}
    </select>
  );
}
