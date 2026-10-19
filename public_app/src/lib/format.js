import i18n, { intlLocale } from "../i18n";

export const formatUgx = (value) => `UGX ${Number(value || 0).toLocaleString(intlLocale())}`;

export const timeAgo = (value) => {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 60) return minutes <= 1 ? i18n.t("time.justNow") : i18n.t("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18n.t("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return i18n.t("time.daysAgo", { count: days });
  const months = Math.floor(days / 30);
  return months < 12 ? i18n.t("time.monthsAgo", { count: months }) : i18n.t("time.yearsAgo", { count: Math.floor(months / 12) });
};

export const monthYear = (value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(intlLocale(), { month: "short", year: "numeric" }) : "";
};
