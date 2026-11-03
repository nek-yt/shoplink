"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isGuest } from "@/lib/guest";
import { useT } from "@/lib/i18n";
import { Icon, Logo, LogoFull, type IconName } from "./icons";
import { AccountList, AccountMenu, Face, useAccountShortcuts } from "./accounts";
import { LanguageMenu, LanguageSwitch } from "./language";
import { NotificationBell } from "./notifications";
import { TopLoader } from "./loader";
import { SearchBar } from "./search";
import { useSession } from "./session";
import { useTheme, type ThemeChoice } from "./theme";
import { Motif } from "./ui";

type NavItem = { href: string; label: string; icon: IconName; adminOnly?: boolean };

// Labels are English; they're translated where they're shown. Help lives in Settings.
const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/products", label: "Products", icon: "grid" },
  { href: "/orders", label: "My orders", icon: "box" },
  { href: "/sell", label: "Sell", icon: "tag" },
  { href: "/admin", label: "Admin", icon: "shield", adminOnly: true },
];

/** Dispatched on window to slide up the phone menu sheet from anywhere (the profile page's ☰). */
export const OPEN_MENU_EVENT = "shoplink:open-menu";

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" },
];

/** Light / Dark / System, as a small segmented control. */
function ThemeSwitch({ tabIndex }: { tabIndex: number }) {
  const { t } = useT();
  const { choice, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label={t("Theme")} className="flex rounded-lg bg-soft p-1">
      {THEME_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          tabIndex={tabIndex}
          onClick={() => setTheme(o.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition ${
            choice === o.value ? "bg-raised text-brand shadow-sm ring-1 ring-line" : "text-muted hover:text-fg"
          }`}
        >
          <Icon name={o.icon} className="size-4" />
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}

const sideLink = (active: boolean) =>
  `grid size-10 place-items-center rounded-md border-2 transition ${
    active ? "rounded-xl border-transparent bg-fg text-surface" : "rounded-xl border-transparent text-muted hover:bg-soft hover:text-fg"
  }`;

/** The narrow icon bar on the left of the mockup. */
export function Sidebar() {
  const { t } = useT();
  const pathname = usePathname();
  const { user } = useSession();
  return (
    <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col items-center gap-3 border-r border-line bg-surface py-3 md:flex print:hidden">
      <Link href="/" aria-label={t("ShopLink home")} className="mb-3">
        <Logo />
      </Link>
      {NAV.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={t(item.label)}
            aria-label={t(item.label)}
            aria-current={active ? "page" : undefined}
            className={sideLink(active)}
          >
            <Icon name={item.icon} />
          </Link>
        );
      })}
      <Link href="/settings" title={t("Settings")} aria-label={t("Settings")} className={`${sideLink(isActive(pathname, "/settings"))} mt-auto`}>
        <Icon name="settings" />
      </Link>
    </aside>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    // key: a new number remounts the badge, which replays the "pop".
    <span
      key={count}
      className="absolute -top-1 -right-1.5 grid h-4.5 min-w-4.5 animate-pop place-items-center rounded-full bg-tangerine px-1 text-[11px] font-bold text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Phones: everything that isn't in the tab bar, sliding up from the bottom (opened by the "You" tab). */
function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const { user, unseen } = useSession();
  const pathname = usePathname();

  // Close when the page changes or on Escape.
  useEffect(() => onClose(), [pathname, onClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const links: (NavItem & { badge?: number })[] = [
    { href: "/orders", label: "My orders", icon: "box" },
    { href: "/wishlist", label: "Wishlist", icon: "heart", badge: unseen.wishlist },
    // Guests can't sell, so they don't get the seller pages.
    ...(isGuest(user)
      ? []
      : [
          { href: "/sell", label: "My products", icon: "tag" as const },
          { href: "/sell/sales", label: "My sales", icon: "chart" as const },
        ]),
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin", icon: "shield" as const }] : []),
    { href: "/settings", label: "Settings", icon: "settings" },
  ];
  const tab = open ? 0 : -1; // links in the closed sheet are skipped by Tab

  return (
    <div className={`fixed inset-0 z-40 overflow-hidden md:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <nav
        aria-label={t("Menu")}
        className={`absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[2rem] border-t border-line bg-raised pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* The grab handle; tapping it closes the sheet too */}
        <button type="button" onClick={onClose} tabIndex={tab} aria-label={t("Close menu")} className="flex shrink-0 justify-center pt-3 pb-2">
          <span className="h-1.5 w-12 rounded-full bg-line" />
        </button>

        <div className="overflow-y-auto px-4 pb-4">
          {/* Who you are, other saved accounts (one tap to switch), add one, log out */}
          <div className="rounded-2xl bg-soft p-1.5">
            <AccountList tabIndex={tab} onDone={onClose} />
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-2">
            {links.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    tabIndex={tab}
                    className={`relative flex h-full flex-col gap-3 rounded-2xl border p-4 font-medium transition active:scale-[0.98] ${
                      active ? "border-fg bg-fg text-surface" : "border-line hover:bg-soft"
                    }`}
                  >
                    <Icon name={item.icon} className="size-6" />
                    {t(item.label)}
                    {!!item.badge && <span className="absolute top-3 right-3 size-2.5 rounded-full bg-tangerine" />}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 space-y-2 border-t border-line pt-4">
            <LanguageSwitch tabIndex={tab} />
            <ThemeSwitch tabIndex={tab} />
          </div>
        </div>
      </nav>
    </div>
  );
}

/** Phones: the app-style tab bar along the bottom. */
function TabBar({ menuOpen }: { menuOpen: boolean }) {
  const { t } = useT();
  const pathname = usePathname();
  const { user, unseen } = useSession();
  const tab = (active: boolean) =>
    `relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition active:scale-90 ${active ? "text-fg" : "text-muted"}`;
  const here = (href: string) => !menuOpen && isActive(pathname, href);
  // Guests can't sell, so the middle button is their orders instead.
  const middle = isGuest(user) ? { href: "/orders", label: "My orders", icon: "box" as const } : { href: "/sell/new", label: "Add product", icon: "plus" as const };

  return (
    <nav
      aria-label={t("Main")}
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden dark:bg-surface"
    >
      <Link href="/" aria-current={here("/") ? "page" : undefined} className={tab(here("/"))}>
        <Icon name="home" className="size-6" />
        {t("Home")}
      </Link>
      <Link href="/products" aria-current={here("/products") ? "page" : undefined} className={tab(here("/products"))}>
        <Icon name="grid" className="size-6" />
        {t("Products")}
      </Link>
      <Link href={middle.href} aria-label={t(middle.label)} title={t(middle.label)} className="flex flex-1 items-center justify-center">
        <span
          className={`grid h-10 w-14 place-items-center rounded-2xl transition active:scale-90 ${here(middle.href) ? "bg-brand text-white" : "bg-fg text-surface"}`}
        >
          <Icon name={middle.icon} className="size-6" />
        </span>
      </Link>
      <Link href="/cart" aria-current={here("/cart") ? "page" : undefined} className={tab(here("/cart"))}>
        <span className="relative">
          <Icon name="cart" className="size-6" />
          <CountBadge count={pathname === "/cart" ? 0 : unseen.cart} />
        </span>
        {t("Cart")}
      </Link>
      {/* Your page, TikTok style: your products, saved pieces and orders (its ☰ opens the menu sheet) */}
      <Link href="/profile" aria-current={here("/profile") ? "page" : undefined} className={tab(here("/profile"))}>
        {user ? (
          <Face src={user.avatarUrl} alt="" className={`size-6.5 ${here("/profile") ? "ring-2 ring-fg ring-offset-2 ring-offset-surface" : ""}`} />
        ) : (
          <Icon name="user" className="size-6" />
        )}
        {t("Profile")}
      </Link>
    </nav>
  );
}

/** The bar across the top of the mockup. */
export function Topbar() {
  const { t } = useT();
  const pathname = usePathname();
  // The badges count what was added since the cart / wishlist was last opened, and hide on that page.
  const { unseen } = useSession();
  useAccountShortcuts();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  // The ☰ on the profile page asks for the sheet.
  useEffect(() => {
    const open = () => setMenuOpen(true);
    window.addEventListener(OPEN_MENU_EVENT, open);
    return () => window.removeEventListener(OPEN_MENU_EVENT, open);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur dark:bg-surface sm:gap-3 sm:px-4 print:hidden">
        <TopLoader />
        <Link href="/" aria-label={t("ShopLink home")} className="shrink-0 md:hidden">
          <Logo className="size-8" />
        </Link>
        {/* On the home page it jumps down to the products; elsewhere it opens the catalog. */}
        <Link
          href={pathname === "/" ? "#products" : "/products"}
          className="hidden h-11 shrink-0 items-center gap-3 rounded-lg bg-soft px-4 font-medium hover:bg-fg/5 lg:flex"
        >
          <Icon name="arrowDown" className="size-5" />
          {t("Go to Products")}
        </Link>
        <SearchBar />
        <div className="flex items-center gap-0.5 sm:gap-2 md:ml-4">
          <span className="hidden md:block">
            <LanguageMenu />
          </span>
          <NotificationBell />
          <Link href="/wishlist" aria-label={t("Wishlist")} className="relative rounded-md p-2 hover:bg-soft">
            <Icon name="heart" className="size-7" />
            <CountBadge count={pathname === "/wishlist" ? 0 : unseen.wishlist} />
          </Link>
          {/* Phones have the cart and the account in the tab bar */}
          <Link href="/cart" aria-label={t("Cart")} className="relative hidden rounded-md p-2 hover:bg-soft md:block">
            <Icon name="cart" className="size-7" />
            <CountBadge count={pathname === "/cart" ? 0 : unseen.cart} />
          </Link>
          <span className="hidden md:block">
            <AccountMenu />
          </span>
        </div>
      </header>
      {/* Outside the header: its backdrop-blur would trap these fixed panels inside the header's height. */}
      <TabBar menuOpen={menuOpen} />
      <MenuSheet open={menuOpen} onClose={closeMenu} />
    </>
  );
}

export function Footer() {
  const { t } = useT();
  return (
    <footer className="mt-16 flex flex-col items-center gap-4 border-t border-line px-6 pt-10 pb-12 text-center text-sm text-muted print:hidden">
      <Motif />
      <LogoFull />
      <p className="font-display text-xl text-fg italic">{t("made by people, for people")}</p>
      <p>
        {t("Your shop, one link.")} · {t("Shop from Instagram, TikTok and Telegram")} ·{" "}
        <Link href="/settings?tab=help" className="underline hover:text-brand">
          {t("Help")}
        </Link>
      </p>
    </footer>
  );
}

/** Round "back to top" button in the bottom-right corner, shown once the page is scrolled. */
export function ScrollTop() {
  const { t } = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0 })}
      aria-label={t("Back to top")}
      className={`fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 md:right-6 md:bottom-6 grid size-11 place-items-center rounded-full border border-line bg-surface shadow-md transition hover:text-brand print:hidden ${
        show ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <Icon name="arrowUp" className="size-5" />
    </button>
  );
}
