import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

// Every file in locales/<lang>/*.json is merged into that language's translation tree, so each
// feature owns its own file (core.json, home.json, shop.json ...) and top-level keys must not clash.
const files = import.meta.glob("./locales/*/*.json", { eager: true, import: "default" });
const bundle = (code) =>
  Object.entries(files).reduce(
    (acc, [path, json]) => (path.startsWith(`./locales/${code}/`) ? Object.assign(acc, json) : acc),
    {}
  );

export const LANGUAGES = [
  { code: "en", native: "English", intl: "en-GB" },
  { code: "ti", native: "ትግርኛ", intl: "ti" },
  { code: "so", native: "Soomaali", intl: "so" },
  { code: "lg", native: "Oluganda", intl: "lg" }
];

export const LANGUAGE_STORAGE_KEY = "gabla-lang";

const applyDocumentLanguage = (code) => {
  if (typeof document !== "undefined") document.documentElement.lang = code || "en";
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: bundle("en") },
      ti: { translation: bundle("ti") },
      so: { translation: bundle("so") },
      lg: { translation: bundle("lg") }
    },
    supportedLngs: LANGUAGES.map((l) => l.code),
    // "so-SO" / "ti-ER" etc. resolve to the base language.
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    fallbackLng: "en",
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"]
    }
  });

applyDocumentLanguage(i18n.resolvedLanguage);
i18n.on("languageChanged", () => applyDocumentLanguage(i18n.resolvedLanguage));

// Locale tag for Intl / toLocale*String, following the active UI language.
export const intlLocale = () =>
  LANGUAGES.find((l) => l.code === i18n.resolvedLanguage)?.intl || "en-GB";

export default i18n;
