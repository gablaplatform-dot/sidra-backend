import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

// Every file in locales/<lang>/*.json is merged into that language's translation tree, so each
// feature owns its own file (core.json, home.json, shop.json ...) and top-level keys must not clash.
// English ships in the main bundle; the other languages are separate files fetched only when someone uses them.
const mergeFiles = (files) => Object.values(files).reduce((acc, json) => Object.assign(acc, json), {});
const english = mergeFiles(import.meta.glob("./locales/en/*.json", { eager: true, import: "default" }));
const lazyFiles = import.meta.glob("./locales/{ti,so,lg}/*.json", { import: "default" });

const loaded = new Set(["en"]);
export const loadLanguage = async (code) => {
  const base = String(code || "en").split("-")[0];
  if (loaded.has(base)) return;
  const entries = Object.entries(lazyFiles).filter(([path]) => path.startsWith(`./locales/${base}/`));
  if (!entries.length) return;
  const files = await Promise.all(entries.map(async ([path, load]) => [path, await load()]));
  i18n.addResourceBundle(base, "translation", mergeFiles(Object.fromEntries(files)), true, true);
  loaded.add(base);
};

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
    resources: { en: { translation: english } },
    supportedLngs: LANGUAGES.map((l) => l.code),
    // "so-SO" / "ti-ER" etc. resolve to the base language.
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    fallbackLng: "en",
    interpolation: { escapeValue: false }, // React already escapes
    react: { bindI18nStore: "added" },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"]
    }
  });

applyDocumentLanguage(i18n.resolvedLanguage);
i18n.on("languageChanged", () => applyDocumentLanguage(i18n.resolvedLanguage));

// Fetch a language's texts before switching to it, so the screen never shows half-translated.
const changeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (lng, callback) => {
  await loadLanguage(lng).catch(() => {});
  return changeLanguage(lng, callback);
};

// Resolves once the language this visitor starts in is ready (immediately for English).
export const i18nReady = (() => {
  // i18n.language is what the visitor asked for (saved choice, else the phone's language), even before its texts exist.
  const wanted = String(i18n.language || "en").split("-")[0];
  return loadLanguage(wanted).catch(() => {}).then(() => i18n.changeLanguage(LANGUAGES.some((l) => l.code === wanted) ? wanted : "en"));
})();

// Locale tag for Intl / toLocale*String, following the active UI language.
export const intlLocale = () =>
  LANGUAGES.find((l) => l.code === i18n.resolvedLanguage)?.intl || "en-GB";

export default i18n;
