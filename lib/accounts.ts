// Accounts saved on this device, for switching without logging in again. Each keeps its own login token,
// exactly like the single "shoplink_token" did before, plus what the switcher shows (name, picture…).

import type { User } from "./shoplink";

const KEY = "shoplink_accounts";
const EVENT = "shoplink-accounts";
/** How many accounts one device keeps; the least recently used one makes room for a new one. */
export const MAX_ACCOUNTS = 9;

export interface SavedAccount {
  id: number;
  token: string;
  name: string;
  username: string | null;
  /** Email or phone, to fill in the login form when the saved login has run out. */
  contact: string | null;
  avatarUrl: string;
  lastUsed: number;
  /** The backend no longer accepts its token: it needs the password again. */
  expired?: boolean;
}

const EMPTY: SavedAccount[] = [];
let cache: { raw: string | null; list: SavedAccount[] } = { raw: null, list: EMPTY };

function read(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cache.raw) cache = { raw, list: raw ? (JSON.parse(raw) as SavedAccount[]) : EMPTY };
    return cache.list;
  } catch {
    return EMPTY;
  }
}

function write(list: SavedAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage blocked: switching just isn't remembered
  }
  window.dispatchEvent(new Event(EVENT));
}

/** In the order they were added, so Alt+1, Alt+2… always mean the same account. Stable between changes. */
export const listAccounts = () => read();
export const noAccounts = () => EMPTY;

export function subscribeAccounts(listener: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && listener(); // other tabs
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Remembers (or refreshes) the account that is logged in now. A new one goes to the end of the list. */
export function rememberAccount(user: User, token: string) {
  const entry: SavedAccount = {
    id: user.id,
    token,
    name: user.name,
    username: user.socialUsername,
    contact: user.email ?? user.phone,
    avatarUrl: user.avatarUrl,
    lastUsed: Date.now(),
  };
  const list = read();
  const same = list.find((a) => a.id === user.id);
  if (same) {
    const changed = same.token !== token || same.name !== entry.name || same.username !== entry.username || same.avatarUrl !== entry.avatarUrl || same.expired;
    if (changed || Date.now() - same.lastUsed > 60_000) write(list.map((a) => (a.id === user.id ? entry : a)));
    return;
  }
  let next = [...list, entry];
  if (next.length > MAX_ACCOUNTS) {
    // Full: the account unused for the longest makes room.
    const oldest = next.slice(0, -1).reduce((o, a) => (a.lastUsed < o.lastUsed ? a : o));
    next = next.filter((a) => a !== oldest);
  }
  write(next);
}

export function forgetAccount(id: number) {
  write(read().filter((a) => a.id !== id));
}

/** Its token stopped working: keep it in the list so one tap leads to the login form, filled in. */
export function markExpired(token: string) {
  const list = read();
  if (!list.some((a) => a.token === token && !a.expired)) return;
  write(list.map((a) => (a.token === token ? { ...a, expired: true } : a)));
}

