import { trackActivity } from "./activity";
import { createShoplinkClient } from "./shoplink";

const TOKEN_KEY = "shoplink_token";
/** Fired on window when someone logs in or out, so the header, cart badge etc. can refresh. */
export const AUTH_EVENT = "shoplink-auth";

function storage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined; // storage blocked (private mode etc.)
  }
}

/** The login token in use right now (null when logged out). */
export const currentToken = () => storage()?.getItem(TOKEN_KEY) ?? null;

/** Switches to another saved login (or logs out with null). Everything listening to AUTH_EVENT reloads. */
export function setLoginToken(token: string | null) {
  if (token) storage()?.setItem(TOKEN_KEY, token);
  else storage()?.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

// The backend address comes from .env.local, so moving the backend online only means changing that file.
export const api = createShoplinkClient({
  baseUrl: process.env.NEXT_PUBLIC_SHOPLINK_API_URL ?? "http://localhost:4000",
  getToken: () => storage()?.getItem(TOKEN_KEY),
  setToken: setLoginToken,
  onActivity: trackActivity,
});
