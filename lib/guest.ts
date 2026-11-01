// Guest accounts: one tap on the register page makes a real account with a name like "user48213907561"
// (like YouTube and TikTok do). The backend needs an email and a password, so the guest gets a made-up email
// and a random password. Both are kept on this device so the guest can see them and log in again elsewhere.

const GUEST_DOMAIN = "guest.shoplink";
const KEY = "shoplink_guest";

export interface GuestLogin {
  userId: number;
  email: string;
  password: string;
}

function randomDigits(count: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(count));
  // The first digit is never 0, so the number always has its full length.
  return Array.from(bytes, (b, i) => (i === 0 ? 1 + (b % 9) : b % 10)).join("");
}

/** A fresh guest: "user" + 11 digits, its email and a 16-character password. */
export function newGuest() {
  const username = `user${randomDigits(11)}`;
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return { username, email: `${username}@${GUEST_DOMAIN}`, password };
}

export const isGuestEmail = (email: string | null | undefined) => Boolean(email?.toLowerCase().endsWith(`@${GUEST_DOMAIN}`));

export function saveGuestLogin(login: GuestLogin) {
  try {
    localStorage.setItem(KEY, JSON.stringify(login));
  } catch {
    // storage blocked: the account still works for this visit
  }
}

/** The guest login saved on this device for this user, if it's theirs. */
export function readGuestLogin(userId: number): GuestLogin | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as GuestLogin | null;
    return saved?.userId === userId ? saved : null;
  } catch {
    return null;
  }
}

/** Guest accounts last this long, unless the guest adds a real email (then it's a normal account). */
export const GUEST_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const isGuest = (user: { email: string | null } | null | undefined) => Boolean(user && isGuestEmail(user.email));

/** Days left before a guest account runs out, rounded up (1 = under a day left; 0 or less = over). */
export function guestDaysLeft(user: { createdAt: string }, now = Date.now()) {
  return Math.ceil((new Date(user.createdAt).getTime() + GUEST_DAYS * DAY_MS - now) / DAY_MS);
}

export const isExpiredGuest = (user: { email: string | null; createdAt: string }, now = Date.now()) =>
  isGuest(user) && guestDaysLeft(user, now) <= 0;

export function forgetGuestLogin() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage blocked: nothing saved anyway
  }
}
