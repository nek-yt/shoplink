"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import type { Order } from "@/lib/shoplink";
import { Icon } from "@/components/icons";
import { ActiveOrderCard, isActive, PastOrderRow, useOrderProducts } from "@/components/orders";
import { useRequireLogin } from "@/components/session";
import { BUTTON, BUTTON_SECONDARY, ErrorBox, SectionTitle, Skeleton } from "@/components/ui";

type Tab = "all" | "active" | "delivered" | "cancelled";
const TABS: { id: Tab; label: string; test: (o: Order) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "active", label: "In progress", test: isActive },
  { id: "delivered", label: "Delivered", test: (o) => o.status === "delivered" },
  { id: "cancelled", label: "Cancelled", test: (o) => o.status === "cancelled" },
];
const PAST_PAGE = 10;

/** Every order of mine (the backend gives at most 100 per page). */
async function loadAll() {
  const all: Order[] = [];
  for (let page = 1; ; page++) {
    const res = await api.orders.list({ page, limit: 100 });
    all.push(...res.items);
    if (page >= res.pages) return all;
  }
}

export default function OrdersPage() {
  const { t, tn } = useT();
  const user = useRequireLogin();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [pastShown, setPastShown] = useState(PAST_PAGE);
  const products = useOrderProducts(orders);

  useEffect(() => {
    if (!user) return;
    loadAll().then(setOrders, (err) => setError(errorMessage(err)));
  }, [user]);

  const replace = (updated: Order) => setOrders((all) => all && all.map((o) => (o.id === updated.id ? updated : o)));

  // One box finds an order by its number or by what's in it.
  const q = query.trim().toLowerCase();
  const matches = (o: Order) => !q || o.orderNumber.toLowerCase().includes(q) || o.items.some((i) => i.productName.toLowerCase().includes(q));
  const filtered = (orders ?? []).filter((o) => TABS.find((x) => x.id === tab)!.test(o) && matches(o));
  const active = filtered.filter(isActive);
  const past = filtered.filter((o) => !isActive(o));
  const count = (id: Tab) => (orders ?? []).filter(TABS.find((x) => x.id === id)!.test).length;
  const activeCount = count("active");

  return (
    <>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
        <div>
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-muted uppercase">
            <span className="h-px w-10 bg-fg/40" />
            {t("Everything you bought")}
          </p>
          <h1 className="mt-4 font-display text-5xl leading-none font-semibold sm:text-6xl">
            {t("My")} <span className="marker">{t("orders")}</span>
          </h1>
          {orders && orders.length > 0 && (
            <p className="mt-3 text-muted">
              {activeCount > 0 ? tn(activeCount, "{n} order is on its way", "{n} orders are on their way") : t("Nothing on the way right now")}
            </p>
          )}
        </div>
        {orders && orders.length > 0 && (
          <label className="relative w-full max-w-xs">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder={t("Search a product or order number")}
              aria-label={t("Search orders")}
              className="h-11 w-full rounded-full border border-line bg-raised pr-4 pl-10 text-sm outline-none focus:border-fg"
            />
          </label>
        )}
      </header>

      <ErrorBox message={error} />

      {!orders ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : orders.length === 0 ? (
        <section className="flex flex-col items-center py-12 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-soft text-brand">
            <Icon name="box" className="size-9" />
          </span>
          <h2 className="mt-6 font-display text-4xl font-semibold">{t("No orders yet")}</h2>
          <p className="mt-2 max-w-sm text-muted">{t("When you buy something, you'll see here where it is — and you can buy it again in one tap.")}</p>
          <Link href="/products" className={`${BUTTON} mt-8 h-12 px-8`}>
            {t("Start shopping")} <Icon name="arrowRight" className="size-4" />
          </Link>
        </section>
      ) : (
        <>
          <div className="mb-8 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t("Show")}>
            {TABS.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={tab === x.id}
                onClick={() => {
                  setTab(x.id);
                  setPastShown(PAST_PAGE);
                }}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${tab === x.id ? "bg-fg text-surface" : "bg-soft text-muted hover:text-fg"}`}
              >
                {t(x.label)}
                <span className={`text-xs tabular-nums ${tab === x.id ? "opacity-70" : ""}`}>{count(x.id)}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line px-6 py-14 text-center text-muted">
              {q ? t("No orders match “{q}”.", { q: query.trim() }) : t("No orders here.")}
            </p>
          ) : (
            <div className="space-y-14">
              {active.length > 0 && (
                <section>
                  {tab === "all" && <SectionTitle title="On the" accent="way" />}
                  <ul className="space-y-5">
                    {active.map((o) => (
                      <ActiveOrderCard key={o.id} order={o} products={products} onChange={replace} />
                    ))}
                  </ul>
                </section>
              )}
              {past.length > 0 && (
                <section>
                  {tab === "all" && <SectionTitle title="Past" accent="purchases" />}
                  <ul className="divide-y divide-line">
                    {past.slice(0, pastShown).map((o) => (
                      <PastOrderRow key={o.id} order={o} products={products} onChange={replace} />
                    ))}
                  </ul>
                  {past.length > pastShown && (
                    <div className="mt-6 flex justify-center">
                      <button type="button" onClick={() => setPastShown((n) => n + PAST_PAGE)} className={`${BUTTON_SECONDARY} h-11 px-6`}>
                        {t("Show more")} · {past.length - pastShown}
                      </button>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
