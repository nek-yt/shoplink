"use client";

import { useEffect, useRef, useState } from "react";
import { LANGS, useT } from "@/lib/i18n";
import { Icon } from "./icons";

/** "EN ▾" button in the top bar with a small list of languages. */
export function LanguageMenu() {
  const { t, lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === lang)!;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("Language")}
        title={t("Language")}
        className="flex h-10 items-center gap-1 rounded-md px-2 text-sm font-bold hover:bg-soft"
      >
        {current.short}
        <Icon name="arrowDown" className={`size-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul role="listbox" aria-label={t("Language")} className="absolute right-0 z-40 mt-2 w-44 animate-drop rounded-xl border border-line bg-raised p-1.5 shadow-xl">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={l.code === lang}
                onClick={() => {
                  setLang(l.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  l.code === lang ? "bg-brand/10 text-brand" : "hover:bg-soft"
                }`}
              >
                <span className="w-6 font-bold">{l.short}</span>
                {l.label}
                {l.code === lang && <Icon name="check" className="ml-auto size-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** EN / RU / TJ as a segmented control (menu and Settings). */
export function LanguageSwitch({ tabIndex, large = false }: { tabIndex?: number; large?: boolean }) {
  const { t, lang, setLang } = useT();
  return (
    <div role="radiogroup" aria-label={t("Language")} className={`flex rounded-lg bg-soft p-1 ${large ? "max-w-md" : ""}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={l.code === lang}
          tabIndex={tabIndex}
          onClick={() => setLang(l.code)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md font-medium transition ${large ? "py-2.5" : "py-1.5 text-sm"} ${
            l.code === lang ? "bg-raised text-brand shadow-sm ring-1 ring-line" : "text-muted hover:text-fg"
          }`}
        >
          <span className="font-bold">{l.short}</span>
          {large && <span>{l.label}</span>}
        </button>
      ))}
    </div>
  );
}
