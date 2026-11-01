"use client";

import { Fragment, useEffect, useState, useSyncExternalStore } from "react";
import { finishNavigation, getNavigating, getWrites, startNavigation, subscribeActivity } from "@/lib/activity";
import { useT } from "@/lib/i18n";
import { Logo } from "./icons";

const STEPS = 10;
// How the squares still ahead of the bag are tilted; fixed so the row doesn't jump between renders.
const TILTS = [14, -10, 32, 6, -20, 26, -4, 40, 10, -16];

const CHECK = (
  <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
    <path d="M2.5 6.2 5 8.6l4.6-5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * The ShopLink loader: the bag walks along a row of squares and dots; every square it passes becomes a
 * checkbox, and a bubble above it shows the percentage. `value` is 0 to 100.
 */
export function BagProgress({ value, label, className = "" }: { value: number; label?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  // The bag stands in the row, so whatever is right under it steps aside (where along the row: 0 to 1).
  const underBag = (at: number) => Math.abs(at - pct / 100) < 0.035;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={`relative pt-12 ${className}`}
    >
      {/* The row; the side padding keeps the bag inside at 0% and 100%. */}
      <div className="flex items-center justify-between px-5">
        {Array.from({ length: STEPS }, (_, i) => {
          const done = pct >= ((i + 1) / STEPS) * 100 - 0.01;
          return (
            <Fragment key={i}>
              <span
                className={`block shrink-0 transition duration-500 ease-out ${underBag(i / (STEPS - 1)) ? "opacity-0" : ""}`}
                style={{ transform: done ? "rotate(0deg) scale(1)" : `rotate(${TILTS[i]}deg) scale(0.92)` }}
              >
                {/* Squares still ahead wiggle a little, each a beat after the one before. */}
                <span
                  className={`grid size-4 place-items-center rounded-[4px] bg-brand ${done ? "shadow-sm" : "animate-wiggle opacity-90"}`}
                  style={done ? undefined : { animationDelay: `${i * 110}ms` }}
                >
                  {done && <span className="animate-pop">{CHECK}</span>}
                </span>
              </span>
              {i < STEPS - 1 && (
                <span className={`size-2 shrink-0 rounded-full bg-tangerine transition-opacity duration-300 ${underBag((i + 0.5) / (STEPS - 1)) ? "opacity-0" : ""}`} />
              )}
            </Fragment>
          );
        })}
      </div>
      {/* The bag and its bubble ride on top of the row. */}
      <div
        className="absolute bottom-[-10px] flex -translate-x-1/2 flex-col items-center transition-[left] duration-500 ease-out"
        style={{ left: `calc(20px + (100% - 40px) * ${pct / 100})` }}
      >
        <span className="relative mb-1.5 rounded-md bg-soft px-2.5 py-1 text-xs font-semibold tabular-nums shadow-sm ring-1 ring-line">
          {Math.round(pct)}%
          <span className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-soft ring-1 ring-line [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
        </span>
        <Logo className={`size-9 drop-shadow-[0_2px_4px_rgb(0_0_0/0.25)] ${pct < 100 ? "animate-bob" : ""}`} />
      </div>
    </div>
  );
}

const SHOW_AFTER_MS = 400; // quick answers don't flash anything
const LINE_MS = 1700;
const WORD = [..."shoplink"];
// What the bag is busy with. A little silly on purpose, never more than a few words.
const LINES = ["Packing your bag…", "Folding the hoodies…", "Waking up the warehouse…", "Counting the socks…", "Almost there…"];

/**
 * Progress for work of unknown length: shows after a moment, creeps towards 90% while waiting, runs to 100% when
 * it's done, fades out, and only then rewinds (so the bar never visibly shrinks).
 */
function useProgress(busy: boolean, delay = SHOW_AFTER_MS) {
  const [shown, setShown] = useState(false);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (busy) {
      const start = setTimeout(() => {
        setShown(true);
        setValue((v) => Math.max(v, 8));
      }, delay);
      const creep = setInterval(() => setValue((v) => (v < 8 ? v : v + (90 - v) * 0.1)), 300);
      return () => {
        clearTimeout(start);
        clearInterval(creep);
      };
    }
    const finish = setTimeout(() => setValue((v) => (v > 0 ? 100 : 0)), 0);
    const hide = setTimeout(() => setShown(false), 650);
    const rewind = setTimeout(() => setValue(0), 1000);
    return () => {
      clearTimeout(finish);
      clearTimeout(hide);
      clearTimeout(rewind);
    };
  }, [busy, delay]);

  return { shown, value };
}

/** Starts the top bar on the press of any link to another page, and finishes it once the address has changed. */
function useNavigationEvents() {
  useEffect(() => {
    const here = () => location.pathname + location.search;
    let last = here();
    // Next.js changes the address from inside React's own work (an insertion effect), where nothing may update;
    // so look a moment later, once React is done.
    const changed = () =>
      queueMicrotask(() => {
        if (here() === last) return;
        last = here();
        finishNavigation();
      });
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin && url.pathname + url.search !== here()) startNavigation();
    };
    // Next.js changes the address with pushState/replaceState; listen in on both.
    const { pushState, replaceState } = history;
    history.pushState = function (...args: Parameters<History["pushState"]>) {
      pushState.apply(this, args);
      changed();
    };
    history.replaceState = function (...args: Parameters<History["replaceState"]>) {
      replaceState.apply(this, args);
      changed();
    };
    window.addEventListener("popstate", changed);
    document.addEventListener("click", onClick, true); // before the link itself handles it
    return () => {
      history.pushState = pushState;
      history.replaceState = replaceState;
      window.removeEventListener("popstate", changed);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
}

/**
 * Lives on the bottom edge of the top bar while another page opens: the edge fills with violet from left to
 * right and the bag walks along under it. It starts on the press itself and finishes as soon as the new page is
 * drawn. Put it inside the (positioned) header.
 */
export function TopLoader() {
  const { t } = useT();
  useNavigationEvents();
  const navigating = useSyncExternalStore(subscribeActivity, getNavigating, () => false);
  const { shown, value } = useProgress(navigating, 0);

  return (
    <div
      role="progressbar"
      aria-label={t("Loading…")}
      aria-hidden={!shown}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={`pointer-events-none absolute inset-x-0 -bottom-px h-0.5 transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
    >
      <div className={`relative h-full rounded-r-full bg-brand ease-out ${value ? "transition-[width] duration-300" : ""}`} style={{ width: `${value}%` }}>
        <span className="absolute top-1/2 right-0 size-2 translate-x-1/2 -translate-y-1/2 rounded-full bg-tangerine ring-2 ring-surface" />
        <span className="absolute top-full right-0 mt-1 translate-x-1/2">
          <Logo className="size-6 animate-bob drop-shadow-[0_2px_3px_rgb(0_0_0/0.2)]" />
        </span>
      </div>
    </div>
  );
}

/**
 * In the middle of a dimmed screen while something is being done (buying, adding to the cart, saving…):
 * "shoplink" hops letter by letter, the bag walks its row of squares and a short line says what's going on.
 * It never blocks clicks.
 */
export function ActionLoader() {
  const { t } = useT();
  const writes = useSyncExternalStore(subscribeActivity, getWrites, () => 0);
  const { shown, value } = useProgress(writes > 0);
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!shown) return;
    const first = setTimeout(() => setLine(0), 0); // every time it opens, start from the first line
    const lines = setInterval(() => setLine((l) => (l + 1) % LINES.length), LINE_MS);
    return () => {
      clearTimeout(first);
      clearInterval(lines);
    };
  }, [shown]);

  const done = value >= 100;
  return (
    <div
      aria-hidden={!shown}
      className={`pointer-events-none fixed inset-0 z-60 grid place-items-center bg-black/70 backdrop-blur-[3px] transition-opacity duration-300 print:hidden ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`flex flex-col items-center transition duration-300 ${shown ? "scale-100" : "scale-95"}`}
      >
        {/* "shoplink", every letter hopping a beat after the one before */}
        <p aria-hidden className="font-logo text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
          {WORD.map((letter, i) => (
            <span
              key={i}
              className={`inline-block ${i >= 4 ? "text-tangerine" : ""} ${done ? "" : "animate-letter"}`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {letter}
            </span>
          ))}
        </p>

        {/* The bag walks the row; squares it passes turn into checkboxes */}
        <BagProgress value={value} label={t("Loading…")} className="mt-6 w-[min(34rem,88vw)]" />

        <p className="mt-5 text-sm font-medium text-white">
          <span key={done ? "done" : line} className="animate-word">
            {t(done ? "Done!" : LINES[line])}
          </span>
        </p>
      </div>
    </div>
  );
}
