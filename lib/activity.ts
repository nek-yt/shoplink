// How many backend requests are running right now, split by kind: "read" (GET) and "write" (anything that
// changes something: buying, adding to the cart…). Writes show the loader in the middle of the screen.

export type ActivityKind = "read" | "write";

const running: Record<ActivityKind, number> = { read: 0, write: 0 };
const listeners = new Set<() => void>();

export function trackActivity(change: 1 | -1, method = "GET") {
  const kind: ActivityKind = method.toUpperCase() === "GET" ? "read" : "write";
  running[kind] = Math.max(0, running[kind] + change);
  listeners.forEach((l) => l());
}

export const getReads = () => running.read;
export const getWrites = () => running.write;

export function subscribeActivity(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Page changes. The top bar starts the moment a link is pressed and finishes as soon as the new page has been
// drawn; its data then loads behind the page's own placeholders, so the bar doesn't wait for slow requests.
let navigating = false;
let navTimer: ReturnType<typeof setTimeout> | undefined;
const NAV_GIVE_UP_MS = 8_000; // never spin forever (e.g. a navigation that was cancelled)

export const getNavigating = () => navigating;

function setNavigating(on: boolean) {
  clearTimeout(navTimer);
  if (on) navTimer = setTimeout(() => setNavigating(false), NAV_GIVE_UP_MS);
  if (navigating === on) return;
  navigating = on;
  listeners.forEach((l) => l());
}

export const startNavigation = () => setNavigating(true);

/** The address changed: finish once the browser has drawn the new page (two frames later). */
export function finishNavigation() {
  if (!navigating) setNavigating(true); // changes made from code (router.push) get the bar too
  requestAnimationFrame(() => requestAnimationFrame(() => setNavigating(false)));
}
