"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { guestDaysLeft, isGuestEmail, readGuestLogin } from "@/lib/guest";
import { useT } from "@/lib/i18n";
import type { Order, Product, User } from "@/lib/shoplink";
import { Icon, type IconName } from "@/components/icons";
import { PastOrderRow, useOrderProducts } from "@/components/orders";
import { useRequireLogin, useSession } from "@/components/session";
import { OPEN_MENU_EVENT } from "@/components/shell";
import { BUTTON, BUTTON_SECONDARY, ProductImage, Skeleton } from "@/components/ui";
import { AdminBadge } from "@/components/admin-badge";

const EDIT_HREF = "/settings?tab=account";
// The profile buttons share the row, so they are tighter than the shop-wide BUTTON.
const PILL = "inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap transition active:scale-[0.98]";
const SHOWN = 60; // products / saved pieces on the profile; the rest are one link away

type Tab = "products" | "saved" | "orders";
type List<T> = { items: T[]; total: number } | null;

/** For guest accounts: the made-up email and password, the only way back in after logging out. */
function GuestLoginCard({ user }: { user: User }) {
  const { t, tn } = useT();
  const daysLeft = Math.max(1, guestDaysLeft(user));
  const { notify } = useSession();
  const [shown, setShown] = useState(false);
  const login = readGuestLogin(user.id);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(t("{what} copied", { what: t(what) }));
    } catch {
      notify("Couldn't copy", "error");
    }
  }

  return (
    <section className="rounded-3xl border border-amber-400/40 bg-amber-400/[0.07] p-5 text-left">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-300">
          <Icon name="shield" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold">
            {t("This is a guest account")}
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-700 tabular-nums dark:text-amber-300">
              {tn(daysLeft, "Expires in {n} day", "Expires in {n} days")}
            </span>
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {t(
              login
                ? "Guest accounts can't sell and last 7 days. Save this login to get back in after logging out, or put your real email in Edit profile to keep the account."
                : "Guest accounts can't sell and last 7 days. Its login was saved on the device you made it on. Put your real email in Edit profile to keep this account.",
            )}
          </p>
          {login && (
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {[
                { label: "Email", value: login.email, display: login.email },
                { label: "Password", value: login.password, display: shown ? login.password : "•".repeat(12) },
              ].map((row) => (
                <div key={row.label} className="flex min-w-0 items-center gap-2 rounded-xl bg-surface/70 px-3 py-2 ring-1 ring-line">
                  <dt className="shrink-0 text-muted">{t(row.label)}</dt>
                  <dd className="min-w-0 flex-1 truncate font-mono text-[13px]">{row.display}</dd>
                  {row.label === "Password" && (
                    <button
                      type="button"
                      onClick={() => setShown((s) => !s)}
                      aria-label={t(shown ? "Hide password" : "Show password")}
                      className="rounded p-1 text-muted hover:bg-soft hover:text-fg"
                    >
                      <Icon name="eye" className="size-4" />
                    </button>
                  )}
                  <button type="button" onClick={() => copy(row.value, row.label)} aria-label={t("Copy")} className="rounded p-1 text-muted hover:bg-soft hover:text-fg">
                    <Icon name="copy" className="size-4" />
                  </button>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

/** One of the profile's numbers: "12 Products". Tapping it opens that tab or page. */
function Count({ value, label, onClick, href }: { value: number | null; label: string; onClick?: () => void; href?: string }) {
  const { t } = useT();
  const inner = (
    <>
      {value === null ? <Skeleton className="mx-auto h-7 w-8 rounded-md" /> : <span className="block text-2xl font-semibold tabular-nums">{value.toLocaleString("ru-RU")}</span>}
      <span className="text-sm text-muted">{t(label)}</span>
    </>
  );
  const cls = "flex-1 rounded-2xl px-2 py-2 text-center transition hover:bg-soft";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** A product as a photo tile, TikTok-grid style: price on the picture. */
function Tile({ product }: { product: Product }) {
  const { t } = useT();
  return (
    <Link href={`/products/${product.id}`} className="group relative block overflow-hidden rounded-xl bg-photo sm:rounded-2xl">
      <ProductImage product={product} className={`aspect-3/4 w-full transition duration-700 group-hover:scale-[1.04] ${product.inStock ? "" : "opacity-50 grayscale"}`} />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2.5 pt-8 pb-2 text-white">
        <span className="block truncate text-xs opacity-80 sm:text-sm">{product.name}</span>
        <span className="block text-sm font-semibold tabular-nums sm:text-base">{formatPrice(product.price)}</span>
      </span>
      {!product.inStock && <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">{t("Sold out")}</span>}
    </Link>
  );
}

function TileGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-1 sm:gap-3 lg:grid-cols-5 2xl:grid-cols-6">{children}</div>;
}

function TileSkeletons() {
  return (
    <TileGrid>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="aspect-3/4 w-full rounded-xl sm:rounded-2xl" />
      ))}
    </TileGrid>
  );
}

function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-soft text-muted">
        <Icon name={icon} className="size-7" />
      </span>
      <h3 className="mt-4 font-display text-2xl font-semibold">{t(title)}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted">{t(text)}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function SeeAll({ href, label }: { href: string; label: string }) {
  const { t } = useT();
  return (
    <div className="mt-6 flex justify-center">
      <Link href={href} className={`${BUTTON_SECONDARY} h-11 px-6`}>
        {t(label)} <Icon name="arrowRight" className="size-4" />
      </Link>
    </div>
  );
}

export function Profile() {
  const { t, locale } = useT();
  const user = useRequireLogin();
  const { wishlist, notify } = useSession();
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<List<Product>>(null);
  const [saved, setSaved] = useState<List<Product>>(null);
  const [orders, setOrders] = useState<List<Order>>(null);
  const [sales, setSales] = useState<number | null>(null);
  const orderProducts = useOrderProducts(orders?.items);
  const userId = user?.id;
  const guest = user ? isGuestEmail(user.email) : false;

  useEffect(() => {
    if (!userId) return;
    const none = { items: [], total: 0 };
    api.products.mine({ limit: SHOWN, sort: "newest" }).then(setProducts, () => setProducts(none));
    api.orders.list({ limit: 10 }).then(setOrders, () => setOrders(none));
    api.orders.sales({ limit: 1 }).then((p) => setSales(p.total), () => setSales(0));
  }, [userId]);

  // Saved follows the hearts: it reloads when one is toggled anywhere.
  useEffect(() => {
    if (!userId) return;
    api.wishlist.list({ limit: SHOWN }).then(
      (p) => setSaved({ items: p.items.map((w) => w.product), total: p.total }),
      () => setSaved({ items: [], total: 0 }),
    );
  }, [userId, wishlist]);

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 pt-6">
        <Skeleton className="size-24 rounded-full" />
        <Skeleton className="h-7 w-40 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-full" />
      </div>
    );
  }

  async function share() {
    const link = `${location.origin}/products?sellerId=${user!.id}`;
    try {
      if (navigator.share) await navigator.share({ title: user!.name, url: link });
      else {
        await navigator.clipboard.writeText(link);
        notify({ title: "Link to your shop copied", text: link });
      }
    } catch {
      // closing the share sheet isn't an error
    }
  }

  const TABS: { id: Tab; label: string; icon: IconName }[] = [
    { id: "products", label: "Products", icon: "grid" },
    { id: "saved", label: "Saved", icon: "heart" },
    { id: "orders", label: "Orders", icon: "box" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Phones: the menu (accounts, settings, language, theme), where TikTok keeps it */}
      <div className="-mt-2 mb-2 flex justify-end md:hidden">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_MENU_EVENT))}
          aria-label={t("Open menu")}
          className="rounded-full p-2 hover:bg-soft"
        >
          <Icon name="menu" className="size-7" />
        </button>
      </div>

      {/* Who you are */}
      <header className="flex flex-col items-center text-center">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={api.assetUrl(user.avatarUrl)} alt="" className="size-24 rounded-full object-cover ring-1 ring-line sm:size-28" />
        </div>
        <h1 className="mt-4 flex items-center justify-center gap-2 font-display text-4xl leading-tight font-semibold">
          {user.name}
          {user.role === "admin" && <AdminBadge className="size-7" />}
        </h1>
        <p className="mt-1 flex flex-wrap items-center justify-center gap-2 text-muted">
          {user.socialUsername && <span className="font-medium text-fg">@{user.socialUsername}</span>}
          {guest && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">{t("Guest")}</span>}
          <span className="text-sm">{user.socialUsername && "· "}{t("since {date}", { date: formatDate(user.createdAt, locale) })}</span>
        </p>

        <div className="mt-6 flex w-full max-w-md items-stretch">
          <Count value={products?.total ?? null} label="Products" onClick={() => setTab("products")} />
          {!guest && <Count value={sales} label="Sales" href="/sell/sales" />}
          <Count value={saved?.total ?? null} label="Saved" onClick={() => setTab("saved")} />
          <Count value={orders?.total ?? null} label="Orders" onClick={() => setTab("orders")} />
        </div>

        <div className="mt-6 flex w-full max-w-md gap-2">
          <Link href={EDIT_HREF} className={`${PILL} bg-fg text-surface hover:bg-brand hover:text-white`}>
            <Icon name="edit" className="size-4" /> {t("Edit profile")}
          </Link>
          <button type="button" onClick={share} className={`${PILL} border border-line bg-raised hover:border-fg`}>
            <Icon name="share" className="size-4" /> {t("Share shop")}
          </button>
          {!guest && (
            <Link href="/sell/new" aria-label={t("Add product")} title={t("Add product")} className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-raised transition hover:border-fg active:scale-95">
              <Icon name="plus" className="size-5" />
            </Link>
          )}
        </div>
      </header>

      {guest && (
        <div className="mx-auto mt-8 max-w-2xl">
          <GuestLoginCard user={user} />
        </div>
      )}

      {/* Products / Saved / Orders, like the tabs on a TikTok profile */}
      <div className="sticky top-15 z-20 mt-10 flex border-b border-line bg-surface" role="tablist">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`relative flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-medium transition ${tab === x.id ? "text-fg" : "text-muted hover:text-fg"}`}
          >
            <Icon name={x.icon} className="size-5" filled={x.id === "saved" && tab === x.id} />
            <span className="hidden sm:inline">{t(x.label)}</span>
            {tab === x.id && <span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-fg sm:inset-x-10" />}
          </button>
        ))}
      </div>

      <div className="pt-4 sm:pt-6">
        {tab === "products" &&
          (!products ? (
            <TileSkeletons />
          ) : products.items.length === 0 ? (
            <Empty
              icon="tag"
              title="Nothing on sale yet"
              text={guest ? "Guest accounts can't sell. Put your email in Edit profile to start." : "Add a product and it shows up in the shop right away."}
              action={
                !guest && (
                  <Link href="/sell/new" className={`${BUTTON} h-11 px-6`}>
                    <Icon name="plus" className="size-4" /> {t("Add product")}
                  </Link>
                )
              }
            />
          ) : (
            <>
              <TileGrid>
                {products.items.map((p) => (
                  <Tile key={p.id} product={p} />
                ))}
              </TileGrid>
              <SeeAll href="/sell" label="Manage my products" />
            </>
          ))}

        {tab === "saved" &&
          (!saved ? (
            <TileSkeletons />
          ) : saved.items.length === 0 ? (
            <Empty
              icon="heart"
              title="Nothing saved yet"
              text="Tap the heart on any product to keep it here — and come back when you're ready."
              action={
                <Link href="/products" className={`${BUTTON} h-11 px-6`}>
                  {t("Browse products")}
                </Link>
              }
            />
          ) : (
            <>
              <TileGrid>
                {saved.items.map((p) => (
                  <Tile key={p.id} product={p} />
                ))}
              </TileGrid>
              <SeeAll href="/wishlist" label="Open wishlist" />
            </>
          ))}

        {tab === "orders" &&
          (!orders ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : orders.items.length === 0 ? (
            <Empty
              icon="box"
              title="No orders yet"
              text="When you buy something, you'll see here where it is — and you can buy it again in one tap."
              action={
                <Link href="/products" className={`${BUTTON} h-11 px-6`}>
                  {t("Start shopping")}
                </Link>
              }
            />
          ) : (
            <>
              <ul className="divide-y divide-line">
                {orders.items.map((o) => (
                  <PastOrderRow
                    key={o.id}
                    order={o}
                    products={orderProducts}
                    onChange={(u) => setOrders((all) => all && { ...all, items: all.items.map((x) => (x.id === u.id ? u : x)) })}
                  />
                ))}
              </ul>
              <SeeAll href="/orders" label="All orders" />
            </>
          ))}
      </div>
    </div>
  );
}
