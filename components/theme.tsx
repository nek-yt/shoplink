"use client";

import { useEffect, useSyncExternalStore } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const KEY = "shoplink_theme";
const CHANGE = "shoplink-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before the page paints, so a dark-mode visitor never sees a white flash.
 * Same logic as applyTheme() below, kept tiny because it is inlined into every page.
 */
export const THEME_SCRIPT = `try{var c=localStorage.getItem("${KEY}")||"system";document.documentElement.dataset.theme=c==="dark"||(c==="system"&&matchMedia("${DARK_QUERY}").matches)?"dark":"light"}catch(e){}`;

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system"; // storage blocked
  }
}

function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // storage blocked: still switch for this visit
  }
  applyTheme(choice);
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onChange);
  };
}

/** The saved choice (light / dark / system) and whether the page is dark right now. */
export function useTheme() {
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as const);
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme === "dark",
    () => false,
  );
  return { choice, dark, setTheme };
}

/** Keeps "System" in step when the device switches between light and dark. */
export function ThemeSync() {
  useEffect(
    () =>
      subscribe(() => {
        applyTheme(readChoice());
      }),
    [],
  );
  return null;
}
