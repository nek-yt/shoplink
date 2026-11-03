"use client";

import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { forgetAccount, listAccounts, markExpired, rememberAccount } from "@/lib/accounts";
import { api, AUTH_EVENT, currentToken, setLoginToken } from "@/lib/api";
import { forgetGuestLogin, isExpiredGuest } from "@/lib/guest";
import { useT } from "@/lib/i18n";
import { ShoplinkError, type Cart, type Product, type User } from "@/lib/shoplink";
import { TOAST_MS, Toasts, type Toast, type ToastInput, type ToastKind } from "./toasts";

/** What the pop-up message shows about a product (not sent to the backend). */
type ProductInfo = Pick<Product, "name" | "imageUrl">;
type CartAdd = { productId: number; quantity?: number; size?: string; color?: string; product?: ProductInfo & { sellerId?: number | null } };
/** Things added since the user last opened the cart / wishlist: what the red badges count. */
type Unseen = { cart: number; wishlist: number };

interface Session {
  /** undefined while loading, null when logged out. */
  user: User | null | undefined;
  setUser: (user: User) => void;
  cart: Cart | null;
  refreshCart: () => Promise<void>;
  addToCart: (item: CartAdd) => Promise<boolean>;
  /** Adds several items with one message at the end: "Buy again" on an order, or a choice from the wishlist. */
  addManyToCart: (items: Omit<CartAdd, "product">[], from?: "order" | "wishlist") => Promise<{ added: number; failed: number }>;
  /** Ids of the products in my wishlist. */
  wishlist: ReadonlySet<number>;
  toggleWishlist: (productId: number, product?: ProductInfo) => Promise<void>;
  unseen: Unseen;
  /** Call on the cart / wishlist page: clears its badge. */
  markSeen: (what: keyof Unseen) => void;
  /** Logs out of this account; if other accounts are saved on this device, carries on with the last used one. */
  logout: () => void;
  logoutAll: () => void;
  /** Switches to a saved account right away (no password); one whose login ran out opens the login form. */
  switchAccount: (id: number) => void;
  /** Goes up by one every time the account changes, so pages can start over with the new account's data. */
  accountEpoch: number;
  /** Tells the user what happened: a plain message, or a title with text, picture and a link. */
  notify: (message: string | ToastInput, kind?: ToastKind) => void;
}

const SessionContext = createContext<Session | null>(null);

const noSubscribe = () => () => {};
const EMPTY_IDS: ReadonlySet<number> = new Set();

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  // Parts of a page inside <Suspense> are taken over by the browser a moment later, and by then the account
  // may have loaded. While a part is being taken over it must show what the server drew (no account yet),
  // or React reports a mismatch; right after, it re-renders with the real values.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  return hydrated ? session : { ...session, user: undefined, cart: null, wishlist: EMPTY_IDS, unseen: NOTHING_NEW };
}

/** /login?next=... so the login page can send the user back where they were. */
export const loginHref = (next: string) => `/login?next=${encodeURIComponent(next)}`;

/** For pages that need an account: sends guests to the login page. Returns the user once known. */
export function useRequireLogin() {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (user === null) router.replace(loginHref(pathname));
  }, [user, router, pathname]);
  return user;
}

async function loadWishlistIds() {
  const ids = new Set<number>();
  for (let page = 1; ; page++) {
    const result = await api.wishlist.list({ page, limit: 100 });
    result.items.forEach((item) => ids.add(item.productId));
    if (page >= result.pages) return ids;
  }
}

// The badge counts are kept per account on this device, so they survive a reload.
const NOTHING_NEW: Unseen = { cart: 0, wishlist: 0 };
const unseenKey = (userId: number) => `shoplink_unseen_${userId}`;

function readUnseen(userId: number): Unseen {
  try {
    const saved = JSON.parse(localStorage.getItem(unseenKey(userId)) ?? "null");
    return { cart: Number(saved?.cart) || 0, wishlist: Number(saved?.wishlist) || 0 };
  } catch {
    return NOTHING_NEW;
  }
}

function saveUnseen(userId: number, unseen: Unseen) {
  try {
    localStorage.setItem(unseenKey(userId), JSON.stringify(unseen));
  } catch {
    // storage blocked: the badges just won't survive a reload
  }
}


export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { t, tn } = useT();
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [cart, setCart] = useState<Cart | null>(null);
  const [wishlist, setWishlist] = useState<ReadonlySet<number>>(new Set());
  const [unseen, setUnseen] = useState<Unseen>(NOTHING_NEW);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [accountEpoch, setAccountEpoch] = useState(0);
  const loadedId = useRef<number | null | undefined>(undefined);

  const closeToast = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (message: string | ToastInput, kind?: ToastKind) => {
      const raw = typeof message === "string" ? { title: message } : message;
      // Fixed English messages (also known backend ones) are translated here; messages with names or numbers
      // in them are translated where they are made.
      const input = {
        ...raw,
        title: t(raw.title),
        text: raw.text && t(raw.text),
        action: raw.action && { ...raw.action, label: t(raw.action.label) },
      };
      const id = Date.now() + Math.random();
      // At most 3 on screen; the oldest goes first.
      setToasts((all) => [...all.slice(-2), { ...input, kind: kind ?? input.kind ?? "ok", id }]);
      setTimeout(() => closeToast(id), TOAST_MS);
    },
    [closeToast, t],
  );

  /** Changes the badge counts and remembers them for this account. */
  const bump = useCallback(
    (change: (u: Unseen) => Unseen) => {
      setUnseen((current) => {
        const next = change(current);
        if (user) saveUnseen(user.id, next);
        return next;
      });
    },
    [user],
  );

  const markSeen = useCallback(
    (what: keyof Unseen) => bump((u) => (u[what] === 0 ? u : { ...u, [what]: 0 })),
    [bump],
  );

  const refreshCart = useCallback(async () => {
    if (!api.auth.isLoggedIn()) return setCart(null);
    setCart(await api.cart.get());
  }, []);

  // The account loader below reads this, so switching the language doesn't reload the whole account.
  const notifyRef = useRef(notify);
  const routerRef = useRef(router);
  useEffect(() => {
    notifyRef.current = notify;
    routerRef.current = router;
  }, [notify, router]);

  // Loads (or clears) everything that belongs to the account. Runs on start and on every login/logout.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      // A different account than before (switched, logged out, logged in): pages start over with fresh data.
      const settle = (id: number | null) => {
        if (loadedId.current !== undefined && loadedId.current !== id) setAccountEpoch((n) => n + 1);
        loadedId.current = id;
      };
      if (!api.auth.isLoggedIn()) {
        settle(null);
        setUser(null);
        setCart(null);
        setWishlist(new Set());
        setUnseen(NOTHING_NEW);
        return;
      }
      try {
        const [me, myCart, ids] = await Promise.all([api.auth.me(), api.cart.get(), loadWishlistIds()]);
        if (cancelled) return;
        // Guest accounts run out after a week: log out and forget the saved login (the shop can't delete
        // accounts, so this is where a guest's week ends).
        if (isExpiredGuest(me)) {
          forgetGuestLogin();
          notifyRef.current({ title: "Your guest account has expired", text: "Guest accounts last 7 days. Register to keep shopping." }, "info");
          api.auth.logout();
          return;
        }
        rememberAccount(me, currentToken()!);
        settle(me.id);
        setUser(me);
        setCart(myCart);
        setWishlist(ids);
        setUnseen(readUnseen(me.id));
      } catch (err) {
        if (cancelled) return;
        // Expired or invalid token: treat as logged out (this fires the event again, which clears the rest).
        if (err instanceof ShoplinkError && err.status === 401) {
          // The login ran out: it stays in the switcher, asking for the password again.
          const token = currentToken() ?? "";
          markExpired(token);
          const ranOut = listAccounts().find((a) => a.token === token);
          const fallback = listAccounts()
            .filter((a) => !a.expired)
            .sort((a, b) => b.lastUsed - a.lastUsed)[0];
          if (ranOut && fallback) {
            // Just switched to it: go back to the account that works and offer its login form, filled in.
            setLoginToken(fallback.token);
            notifyRef.current({ title: "That login has run out", text: "Enter the password once more to use this account again.", kind: "info" });
            routerRef.current.push(`/login?add=1${ranOut.contact ? `&login=${encodeURIComponent(ranOut.contact)}` : ""}`);
          } else api.auth.logout();
        }
        else setUser(null);
      }
    }
    load();
    window.addEventListener(AUTH_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EVENT, load);
    };
  }, []);

  const requireLogin = useCallback(() => {
    if (api.auth.isLoggedIn()) return true;
    router.push(loginHref(window.location.pathname + window.location.search));
    return false;
  }, [router]);

  const addToCart = useCallback(
    async ({ product, ...item }: CartAdd) => {
      if (!requireLogin()) return false;
      // Sellers can't buy their own products (they can still keep them in the wishlist).
      if (product?.sellerId != null && product.sellerId === user?.id) {
        notify({ title: "This is your product", text: "You can't buy your own product, but you can save it to your wishlist." }, "info");
        return false;
      }
      try {
        await api.cart.add(item);
        await refreshCart();
        const quantity = item.quantity ?? 1;
        bump((u) => ({ ...u, cart: u.cart + quantity }));
        const options = [item.size, item.color && t(item.color)].filter(Boolean).join(" · ");
        notify({
          title: "Added to cart",
          text: [product?.name, options, quantity > 1 ? `× ${quantity}` : ""].filter(Boolean).join(" · ") || undefined,
          image: product?.imageUrl,
          action: { label: "View cart", href: "/cart" },
        });
        return true;
      } catch (err) {
        notify({ title: "Couldn't add to cart", text: err instanceof Error ? err.message : undefined }, "error");
        return false;
      }
    },
    [requireLogin, refreshCart, bump, notify, t, user],
  );

  // "Buy again": adds every item it can, then one message saying how it went.
  const addManyToCart = useCallback(
    async (items: Omit<CartAdd, "product">[], from: "order" | "wishlist" = "order") => {
      if (!requireLogin()) return { added: 0, failed: items.length };
      let added = 0;
      const problems: string[] = [];
      for (const item of items) {
        try {
          await api.cart.add(item);
          added += item.quantity ?? 1;
        } catch (err) {
          problems.push(err instanceof Error ? err.message : "not available");
        }
      }
      await refreshCart();
      if (added) bump((u) => ({ ...u, cart: u.cart + added }));
      if (added && !problems.length) {
        notify({
          title: from === "order" ? "Added to cart again" : "Added to cart",
          text: from === "order" ? tn(added, "{n} item from this order", "{n} items from this order") : tn(added, "{n} item", "{n} items"),
          action: { label: "View cart", href: "/cart" },
        });
      } else if (added) {
        notify({ title: t("{added} added, {failed} not available", { added, failed: problems.length }), text: problems[0], action: { label: "View cart", href: "/cart" } }, "info");
      } else {
        notify({ title: "Nothing could be added", text: problems[0] ?? "These products aren't available any more." }, "error");
      }
      return { added, failed: problems.length };
    },
    [requireLogin, refreshCart, bump, notify, t, tn],
  );

  const toggleWishlist = useCallback(
    async (productId: number, product?: ProductInfo) => {
      if (!requireLogin()) return;
      const had = wishlist.has(productId);
      // Update the heart right away, then undo it if the backend says no.
      const flip = (add: boolean) =>
        setWishlist((ids) => {
          const next = new Set(ids);
          if (add) next.add(productId);
          else next.delete(productId);
          return next;
        });
      flip(!had);
      try {
        if (had) await api.wishlist.remove(productId);
        else await api.wishlist.add(productId);
        bump((u) => ({ ...u, wishlist: had ? Math.max(0, u.wishlist - 1) : u.wishlist + 1 }));
        notify({
          title: had ? "Removed from wishlist" : "Saved to wishlist",
          text: product?.name,
          image: product?.imageUrl,
          kind: had ? "info" : "ok",
          action: had ? undefined : { label: "View wishlist", href: "/wishlist" },
        });
      } catch (err) {
        flip(had);
        notify({ title: "Couldn't update the wishlist", text: err instanceof Error ? err.message : undefined }, "error");
      }
    },
    [wishlist, requireLogin, bump, notify],
  );

  // Always ends on the login page. Other accounts saved on this device wait there, one tap away;
  // switching to one is the account switcher's job, not logout's.
  const logout = useCallback(() => {
    if (user) forgetAccount(user.id);
    api.auth.logout();
    notify({ title: "Logged out", text: "See you soon!", kind: "info" });
    router.push("/login");
  }, [router, notify, user]);

  const logoutAll = useCallback(() => {
    for (const a of listAccounts()) forgetAccount(a.id);
    api.auth.logout();
    notify({ title: "Logged out of all accounts", text: "They're no longer saved on this device.", kind: "info" });
    router.push("/login");
  }, [router, notify]);

  const switchAccount = useCallback(
    (id: number) => {
      const account = listAccounts().find((a) => a.id === id);
      if (!account || account.id === user?.id) return;
      if (account.expired) {
        router.push(`/login?add=1${account.contact ? `&login=${encodeURIComponent(account.contact)}` : ""}`);
        return;
      }
      setLoginToken(account.token);
      notify({ title: t("Switched to {name}", { name: account.username ? `@${account.username}` : account.name }), image: account.avatarUrl });
    },
    [router, notify, t, user],
  );

  const value = useMemo<Session>(
    () => ({
      user,
      setUser,
      cart,
      refreshCart,
      addToCart,
      addManyToCart,
      wishlist,
      toggleWishlist,
      unseen,
      markSeen,
      logout,
      logoutAll,
      switchAccount,
      accountEpoch,
      notify,
    }),
    [user, cart, refreshCart, addToCart, addManyToCart, wishlist, toggleWishlist, unseen, markSeen, logout, logoutAll, switchAccount, accountEpoch, notify],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      <Toasts toasts={toasts} onClose={closeToast} />
    </SessionContext.Provider>
  );
}

/**
 * Wraps the shop's pages: when the account changes (switched, logged out), they start over, so nothing the
 * previous account loaded (orders, sales, the open form) is left on screen.
 */
export function AccountScope({ children }: { children: React.ReactNode }) {
  const { accountEpoch } = useSession();
  return <Fragment key={accountEpoch}>{children}</Fragment>;
}
