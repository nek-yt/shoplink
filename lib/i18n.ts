"use client";

import { useCallback, useSyncExternalStore } from "react";
import { RU, TG, type Dictionary } from "./translations";

// Translations: English text is the key; RU and TG (Tajik) dictionaries give the other languages.
// Missing entries fall back to English, so nothing ever shows a raw key.

export type Lang = "en" | "ru" | "tg";

export const LANGS: { code: Lang; short: string; label: string }[] = [
  { code: "en", short: "EN", label: "English" },
  { code: "ru", short: "RU", label: "Русский" },
  { code: "tg", short: "TJ", label: "Тоҷикӣ" },
];

const KEY = "shoplink_lang";
const CHANGE = "shoplink-lang";
const DICTIONARIES: Record<Lang, Dictionary> = { en: {}, ru: RU, tg: TG };
/** For dates and numbers. Tajik dates use the Russian calendar names, which every browser has. */
export const LOCALES: Record<Lang, string> = { en: "en-GB", ru: "ru-RU", tg: "ru-RU" };

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "ru" || saved === "tg" ? saved : "en";
  } catch {
    return "en"; // storage blocked
  }
}

export function setLang(lang: Lang) {
  try {
    if (lang === "en") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, lang);
  } catch {
    // storage blocked: still switch for this visit
  }
  document.documentElement.lang = lang === "tg" ? "tg" : lang;
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

type Vars = Record<string, string | number>;
const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : text);

/** Translates `text` (English) into `lang`, filling in {placeholders}. */
export function translate(lang: Lang, text: string, vars?: Vars) {
  const entry = DICTIONARIES[lang][text];
  return fill(typeof entry === "string" ? entry : text, vars);
}

/**
 * "{n} item" / "{n} items" in the right form for the number: Russian has three forms (1 товар, 2 товара,
 * 5 товаров), Tajik one. The dictionary entry is keyed "one|other" and holds the forms in Intl plural order.
 */
export function translatePlural(lang: Lang, n: number, one: string, other: string, vars?: Vars) {
  const entry = DICTIONARIES[lang][`${one}|${other}`];
  const all = { n, ...vars };
  if (lang === "en" || !entry) return fill(n === 1 ? one : other, all);
  if (typeof entry === "string") return fill(entry, all);
  const rule = new Intl.PluralRules(LOCALES[lang]).select(n); // "one" | "few" | "many" | "other"
  const [formOne, formFew, formMany] = entry;
  return fill(rule === "one" ? formOne : rule === "few" ? formFew : (formMany ?? formFew), all);
}

/** The current language and its translate functions. The page first renders in English, then switches. */
export function useT() {
  const lang = useSyncExternalStore(subscribe, readLang, () => "en" as const);
  const t = useCallback((text: string, vars?: Vars) => translate(lang, text, vars), [lang]);
  const tn = useCallback((n: number, one: string, other: string, vars?: Vars) => translatePlural(lang, n, one, other, vars), [lang]);
  return { t, tn, lang, locale: LOCALES[lang], setLang };
}
