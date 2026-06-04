import { createI18n } from "vue-i18n";
import en from "./en.js";
import fr from "./fr.js";

export type AppLocale = "fr" | "en";

function detectLocale(): AppLocale {
  try {
    const stored = localStorage.getItem("listo.locale");
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* localStorage unavailable */
  }
  const nav = (typeof navigator !== "undefined" ? navigator.language : "fr").slice(0, 2);
  return nav === "en" ? "en" : "fr";
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: "fr",
  messages: { fr, en },
});

export function setLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale;
  try {
    localStorage.setItem("listo.locale", locale);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

export function currentLocale(): AppLocale {
  return i18n.global.locale.value as AppLocale;
}
