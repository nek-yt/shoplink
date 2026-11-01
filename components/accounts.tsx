"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { forgetAccount, listAccounts, MAX_ACCOUNTS, noAccounts, subscribeAccounts, type SavedAccount } from "@/lib/accounts";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useConfirm } from "./dialog";
import { Icon, type IconName } from "./icons";
import { useSession } from "./session";

const handle = (a: Pick<SavedAccount, "username" | "name">) => (a.username ? `@${a.username}` : a.name);
const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function useSavedAccounts() {
  return useSyncExternalStore(subscribeAccounts, listAccounts, noAccounts);
}

/** Alt+1 … Alt+9 jump straight to the saved account in that place (not while typing in a field). */
export function useAccountShortcuts() {
  const { switchAccount } = useSession();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || !/^Digit[1-9]$/.test(e.code)) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      const account = listAccounts()[Number(e.code.slice(5)) - 1];
      if (!account) return;
      e.preventDefault();
      switchAccount(account.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [switchAccount]);
}

export function Face({ src, alt, className }: { src: string; alt: string; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={api.assetUrl(src)} alt={alt} className={`shrink-0 rounded-full object-cover ${className}`} />;
}

/**
 * Who you are and who else is saved on this device: one tap switches (no password, the page stays where it is),
 * Alt+number does it from the keyboard, a run-out login asks for the password with the email filled in.
 */
export function AccountList({ onDone, tabIndex }: { onDone?: () => void; tabIndex?: number }) {
  const { t } = useT();
  const { user, switchAccount, logout, logoutAll, notify } = useSession();
  const confirm = useConfirm();
  const accounts = useSavedAccounts();
  const others = accounts.filter((a) => a.id !== user?.id);
  const keys = isMac() ? "⌥" : "Alt+";
  const done = () => onDone?.();

  async function remove(a: SavedAccount) {
    const yes = await confirm({
      title: t("Remove {name} from this device?", { name: handle(a) }),
      text: "The account itself stays. To use it here again, you'll need to log in with its password.",
      confirmLabel: "Remove",
      danger: true,
      icon: "user",
    });
    if (!yes) return;
    forgetAccount(a.id);
    notify({ title: t("{name} removed from this device", { name: handle(a) }), image: a.avatarUrl, kind: "info" });
  }

  return (
    <div className="text-sm">
      {user && (
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <span className="relative">
            <Face src={user.avatarUrl} alt="" className="size-9" />
            <span className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full bg-brand text-white ring-2 ring-raised">
              <Icon name="check" className="size-2.5" />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{user.name}</span>
            <span className="block truncate text-xs text-muted">{user.socialUsername ? `@${user.socialUsername}` : (user.email ?? user.phone)}</span>
          </span>
          <span className="text-xs font-medium text-brand">{t("Current")}</span>
        </div>
      )}

      {others.length > 0 && (
        <ul>
          {others.map((a) => {
            const place = accounts.indexOf(a) + 1;
            return (
              <li key={a.id} className="group relative">
                <button
                  type="button"
                  tabIndex={tabIndex}
                  onClick={() => {
                    switchAccount(a.id);
                    done();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 pr-11 text-left transition hover:bg-soft"
                >
                  <Face src={a.avatarUrl} alt="" className={`size-9 ${a.expired ? "opacity-50 grayscale" : ""}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {a.expired ? <span className="text-amber-600 dark:text-amber-300">{t("Log in again")}</span> : handle(a)}
                    </span>
                  </span>
                  {!a.expired && (
                    <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-[11px] text-muted sm:inline">
                      {keys}
                      {place}
                    </kbd>
                  )}
                </button>
                <button
                  type="button"
                  tabIndex={tabIndex}
                  onClick={() => remove(a)}
                  aria-label={t("Remove {name} from this device", { name: handle(a) })}
                  title={t("Remove from this device")}
                  className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted transition hover:bg-line hover:text-fg"
                >
                  <Icon name="trash" className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-1 border-t border-line pt-1">
        {accounts.length < MAX_ACCOUNTS && (
          <Link href="/login?add=1" onClick={done} tabIndex={tabIndex} className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition hover:bg-soft">
            <span className="grid size-9 place-items-center rounded-full border-2 border-dashed border-line text-muted">
              <Icon name="plus" className="size-4" />
            </span>
            {t(user ? "Add another account" : "Log in")}
          </Link>
        )}
        {user && (
          <button
            type="button"
            tabIndex={tabIndex}
            onClick={() => {
              done();
              logout();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-medium text-danger transition hover:bg-red-500/10"
          >
            <span className="grid size-9 place-items-center">
              <Icon name="logout" className="size-5" />
            </span>
            {t("Log out of {name}", { name: user.socialUsername ? `@${user.socialUsername}` : user.name })}
          </button>
        )}
        {user && others.length > 0 && (
          <button
            type="button"
            tabIndex={tabIndex}
            onClick={() => {
              done();
              logoutAll();
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted transition hover:bg-soft hover:text-fg"
          >
            {t("Log out of all accounts")}
          </button>
        )}
      </div>
    </div>
  );
}

type MenuLink = { href: string; label: string; icon: IconName; adminOnly?: boolean };
// The account menu, in groups (like GitHub's): your shopping, your selling, the shop's settings.
const MENU: MenuLink[][] = [
  [
    { href: "/profile", label: "Profile", icon: "user" },
    { href: "/orders", label: "My orders", icon: "box" },
    { href: "/wishlist", label: "Wishlist", icon: "heart" },
    { href: "/cart", label: "Cart", icon: "cart" },
  ],
  [
    { href: "/sell", label: "My products", icon: "tag" },
    { href: "/sell/sales", label: "My sales", icon: "chart" },
    { href: "/admin", label: "Admin", icon: "shield", adminOnly: true },
  ],
  [
    { href: "/settings", label: "Settings", icon: "settings" },
    { href: "/settings?tab=appearance", label: "Appearance", icon: "sun" },
    { href: "/settings?tab=help", label: "Help", icon: "chat" },
  ],
];

/**
 * Top right of the top bar: your picture opens the account menu, a full-height panel from the right edge (like
 * GitHub's). Its header shows who you are, with the account switcher (⇄) beside it; the switcher slides in over
 * the menu and back.
 */
export function AccountMenu() {
  const { t } = useT();
  const { user, logout, cart, wishlist } = useSession();
  const accounts = useSavedAccounts();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "accounts">("menu");
  const others = accounts.filter((a) => a.id !== user?.id).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // A dialog opened from the panel (e.g. "Remove from this device?") handles its own Escape.
      if (e.key !== "Escape" || document.querySelector("[role=alertdialog]")) return;
      if (view === "accounts" && user) setView("menu");
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, view, user]);

  if (user === undefined) return <span className="mx-1 size-9 animate-pulse rounded-full bg-soft" aria-hidden />;
  if (!user && accounts.length === 0) {
    return (
      <Link href="/login" aria-label={t("Log in")} title={t("Log in")} className="rounded-md p-2 hover:bg-soft">
        <Icon name="user" className="size-7" />
      </Link>
    );
  }

  const close = () => setOpen(false);
  // Logged out with saved accounts there is no menu, only the accounts to continue with.
  const shown = user ? view : "accounts";
  const pills: Record<string, number> = { "/cart": cart?.totalQuantity ?? 0, "/wishlist": wishlist.size };

  const panel = (
    <div className="fixed inset-0 z-50 print:hidden">
      <div className="absolute inset-0 animate-fade bg-black/50" onClick={close} aria-hidden />
      <aside
        role="dialog"
        aria-modal
        aria-label={t("Accounts")}
        className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] animate-slide-in flex-col rounded-l-2xl border-l border-line bg-raised text-sm shadow-2xl"
      >
        {shown === "menu" && user ? (
          <>
            {/* Who you are, and the switcher */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <Face src={user.avatarUrl} alt="" className="size-10" />
              <Link href="/profile" onClick={close} className="min-w-0 flex-1 leading-tight hover:underline">
                <span className="block truncate text-[15px] font-semibold">{user.socialUsername ?? user.name}</span>
                <span className="block truncate text-muted">{user.socialUsername ? user.name : (user.email ?? user.phone)}</span>
              </Link>
              <span className="group/switch relative">
                <button
                  type="button"
                  onClick={() => setView("accounts")}
                  aria-label={t("Account switcher")}
                  className="relative grid size-9 place-items-center rounded-lg bg-soft text-muted transition hover:bg-line hover:text-fg"
                >
                  <Icon name="switch" className="size-4.5" />
                  {others > 0 && (
                    <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                      {others}
                    </span>
                  )}
                </button>
                <span className="pointer-events-none absolute top-full right-0 z-10 mt-2 rounded-md bg-fg px-2 py-1 text-xs font-medium whitespace-nowrap text-surface opacity-0 shadow-md transition group-hover/switch:opacity-100">
                  {t("Account switcher")}
                </span>
              </span>
            </div>
            <Link href="/settings?tab=account" onClick={close} className="mx-2 mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-soft">
              <Icon name="edit" className="size-5 text-muted" />
              {t("Edit profile")}
            </Link>

            <nav aria-label={t("Accounts")} className="min-h-0 flex-1 overflow-y-auto px-2">
              {MENU.map((group, i) => (
                <ul key={i} className="border-t border-line py-2">
                  {group
                    .filter((item) => !item.adminOnly || user.role === "admin")
                    .map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-soft">
                          <Icon name={item.icon} className="size-5 text-muted" />
                          <span className="flex-1">{t(item.label)}</span>
                          {pills[item.href] > 0 && (
                            <span className="rounded-full border border-brand/50 px-2 text-xs leading-5 font-medium text-brand tabular-nums">
                              {pills[item.href]}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                </ul>
              ))}
            </nav>

            <div className="border-t border-line p-2">
              <button
                type="button"
                onClick={() => {
                  close();
                  logout();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-red-500/10 hover:text-danger"
              >
                <Icon name="logout" className="size-5 text-muted" />
                {t("Log out")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 pt-4 pb-2">
              {user && (
                <button
                  type="button"
                  onClick={() => setView("menu")}
                  aria-label={t("Back")}
                  className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-soft hover:text-fg"
                >
                  <Icon name="arrowLeft" className="size-4" />
                </button>
              )}
              <p className="flex-1 px-1 text-[15px] font-semibold">{t(user ? "Switch account" : "Continue as")}</p>
              <button
                type="button"
                onClick={close}
                aria-label={t("Close")}
                className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-soft hover:text-fg"
              >
                <Icon name="close" className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <AccountList onDone={close} />
            </div>
          </>
        )}
      </aside>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setView("menu");
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("Accounts")}
        title={t("Accounts")}
        className={`block rounded-full p-0.5 transition hover:ring-2 hover:ring-brand/40 ${open ? "ring-2 ring-brand/60" : ""}`}
      >
        {user ? (
          <Face src={user.avatarUrl} alt={user.name} className="size-9" />
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-soft text-muted">
            <Icon name="user" className="size-5" />
          </span>
        )}
      </button>
      {/* On <body>: inside the top bar, its backdrop blur would trap a full-screen panel in the bar's height. */}
      {open && createPortal(panel, document.body)}
    </>
  );
}
