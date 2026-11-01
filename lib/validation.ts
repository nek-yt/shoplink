// The same rules the ShopLink backend checks (src/common/validation.ts there), so a form can mark every
// wrong input at once instead of waiting for the backend to report them.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{7,15}$/;

export const isEmail = (s: string) => s.length <= 254 && EMAIL_RE.test(s.toLowerCase());
export const isPhone = (s: string) => PHONE_RE.test(s.replace(/[\s\-()]/g, ""));

// Usernames work like TikTok / YouTube handles: lowercase letters, numbers and - _ . only, no spaces.
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** What the username field keeps while typing: lowercase, no "@", no spaces, only a-z 0-9 - _ . */
export const cleanUsername = (s: string) =>
  s
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, USERNAME_MAX);

/** English message (translate it with t()) or null when the username is fine. Empty is fine: it's optional. */
export function usernameProblem(username: string): string | null {
  if (!username) return null;
  if (username.length < USERNAME_MIN) return "Username must be at least 3 characters";
  if (!/^[a-z0-9]/.test(username) || !/[a-z0-9]$/.test(username)) return "Username must start and end with a letter or number";
  if (/[._-]{2}/.test(username)) return "Username can't have two symbols in a row";
  return null;
}

/** Where to go after logging in: `?next=/cart`, only if it is a page of this site (not "//evil.com"). */
export function nextPage(search: string) {
  const next = new URLSearchParams(search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** bcrypt ignores everything after 72 bytes, so the backend refuses longer passwords. */
export const passwordProblem = (password: string) =>
  password.length < 8
    ? "Password must be at least 8 characters"
    : new TextEncoder().encode(password).length > 72
      ? "Password is too long"
      : null;
