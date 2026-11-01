"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Icon, type IconName } from "@/components/icons";
import { loginHref, useSession } from "@/components/session";
import { AccountSettings, AppearanceSettings, HelpSettings, SettingsCard } from "@/components/settings";
import { BUTTON, BUTTON_DANGER, Skeleton } from "@/components/ui";

type Tab = { id: string; label: string; icon: IconName; needsLogin?: boolean; adminOnly?: boolean };

const TABS: Tab[] = [
  { id: "account", label: "Edit profile", icon: "edit", needsLogin: true },
  { id: "appearance", label: "Appearance", icon: "sun" },
  { id: "activity", label: "Shortcuts", icon: "box", needsLogin: true },
  { id: "help", label: "Help", icon: "chat" },
  { id: "admin", label: "Admin", icon: "shield", needsLogin: true, adminOnly: true },
];

const SHORTCUTS: { href: string; label: string; text: string; icon: IconName }[] = [
  { href: "/orders", label: "My orders", text: "Follow and cancel your orders", icon: "box" },
  { href: "/cart", label: "Cart", text: "What you're about to order", icon: "cart" },
  { href: "/wishlist", label: "Wishlist", text: "Products you saved with the ♥", icon: "heart" },
  { href: "/sell/sales", label: "My sales", text: "Orders for the products you sell", icon: "chart" },
  { href: "/sell", label: "My products", text: "Everything you sell, and editing it", icon: "tag" },
  { href: "/sell/new", label: "Add product", text: "Put something new on sale (its own page)", icon: "plus" },
];

const ADMIN_LINKS: { href: string; label: string; text: string; icon: IconName }[] = [
  { href: "/admin", label: "Overview", text: "Users, logins and where they came from", icon: "chart" },
  { href: "/admin/orders", label: "All orders", text: "Confirm, ship, deliver or cancel", icon: "truck" },
  { href: "/admin/users", label: "Users", text: "Everyone with an account", icon: "users" },
];

function LinkCards({ links }: { links: typeof SHORTCUTS }) {
  const { t } = useT();
  return (
    <div className="grid gap-x-6 sm:grid-cols-2">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="group -mx-3 flex items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-soft">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
            <Icon name={l.icon} className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t(l.label)}</span>
            <span className="block text-sm text-muted">{t(l.text)}</span>
          </span>
          <Icon name="arrowRight" className="size-4 text-muted transition group-hover:translate-x-1 group-hover:text-brand" />
        </Link>
      ))}
    </div>
  );
}

export function Settings() {
  const { t } = useT();
  const { user, logout } = useSession();
  const params = useSearchParams();
  const tabs = TABS.filter((tab) => !tab.adminOnly || user?.role === "admin");
  // Guests can still change the theme; account tabs ask them to log in.
  const fallback = user ? "account" : "appearance";
  const current = tabs.find((tab) => tab.id === params.get("tab")) ?? tabs.find((tab) => tab.id === fallback)!;
  const locked = current.needsLogin && !user;

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <nav aria-label={t("Settings")} className="lg:w-60 lg:shrink-0">
        <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col">
          {tabs.map((tab) => {
            const active = tab.id === current.id;
            return (
              <li key={tab.id} className="shrink-0">
                <Link
                  href={`/settings?tab=${tab.id}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 font-medium transition ${
                    active ? "bg-brand text-white shadow-sm" : "hover:bg-soft"
                  }`}
                >
                  <Icon name={tab.icon} className="size-5" />
                  {t(tab.label)}
                </Link>
              </li>
            );
          })}
        </ul>
        {user && (
          <button type="button" onClick={logout} className={`${BUTTON_DANGER} mt-4 hidden w-full lg:flex`}>
            <Icon name="logout" className="size-5" /> {t("Log out")}
          </button>
        )}
      </nav>

      <div key={current.id} className="min-w-0 flex-1 animate-rise">
        {user === undefined && current.needsLogin ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : locked ? (
          <SettingsCard title="Log in to continue" text="Your account, products and orders are here once you're logged in.">
            <Link href={loginHref(`/settings?tab=${current.id}`)} className={BUTTON}>
              {t("Log in / Register")}
            </Link>
          </SettingsCard>
        ) : current.id === "account" && user ? (
          <AccountSettings user={user} />
        ) : current.id === "appearance" ? (
          <AppearanceSettings />
        ) : current.id === "help" ? (
          <HelpSettings />
        ) : current.id === "activity" ? (
          <SettingsCard title="Shortcuts" text="Your orders, saved products and selling, one tap away.">
            <LinkCards links={SHORTCUTS} />
          </SettingsCard>
        ) : (
          <SettingsCard title="Admin" text="Only admins see this.">
            <LinkCards links={ADMIN_LINKS} />
          </SettingsCard>
        )}

        {user && (
          <button type="button" onClick={logout} className={`${BUTTON_DANGER} mt-6 w-full lg:hidden`}>
            <Icon name="logout" className="size-5" /> {t("Log out")}
          </button>
        )}
      </div>
    </div>
  );
}
