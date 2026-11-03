"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatPrice, SOURCE_LABELS } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Order, Source, UserStats } from "@/lib/shoplink";
import { AdminBadge } from "@/components/admin-badge";
import { AdminGate, CountBars, DailyChart } from "@/components/admin";
import { Icon, type IconName } from "@/components/icons";
import { useSession } from "@/components/session";
import { ErrorBox, SectionTitle, Skeleton } from "@/components/ui";

const DAYS = 14; // the sales chart

/** Every order in the shop (the backend gives at most 100 per page). */
async function allOrders() {
  const all: Order[] = [];
  for (let page = 1; ; page++) {
    const res = await api.orders.all({ page, limit: 100 });
    all.push(...res.items);
    if (page >= res.pages) return all;
  }
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Sales numbers from the orders: what counts is everything that wasn't cancelled. */
function salesOf(orders: Order[]) {
  const today = dayKey(new Date());
  const live = orders.filter((o) => o.status !== "cancelled");
  const pieces = (list: Order[]) => list.reduce((n, o) => n + o.items.reduce((m, i) => m + i.quantity, 0), 0);
  const money = (list: Order[]) => list.reduce((n, o) => n + o.total, 0);
  const todays = live.filter((o) => dayKey(new Date(o.createdAt)) === today);

  // The last DAYS days, oldest first.
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (DAYS - 1 - i));
    return d;
  });
  const daily = days.map((d) => {
    const list = live.filter((o) => dayKey(new Date(o.createdAt)) === dayKey(d));
    return { date: d, pieces: pieces(list), money: money(list) };
  });

  // Best sellers: pieces sold per product.
  const byProduct = new Map<string, { name: string; productId: number | null; pieces: number; money: number }>();
  for (const o of live)
    for (const i of o.items) {
      const key = String(i.productId ?? i.productName);
      const row = byProduct.get(key) ?? { name: i.productName, productId: i.productId, pieces: 0, money: 0 };
      row.pieces += i.quantity;
      row.money += i.subtotal;
      byProduct.set(key, row);
    }

  return {
    piecesToday: pieces(todays),
    moneyToday: money(todays),
    ordersToday: todays.length,
    piecesTotal: pieces(live),
    moneyTotal: money(live),
    ordersTotal: live.length,
    inProgress: orders.filter((o) => o.status === "new" || o.status === "confirmed" || o.status === "shipped").length,
    waiting: orders.filter((o) => o.status === "new").length,
    cancelled: orders.length - live.length,
    daily,
    best: [...byProduct.values()].sort((a, b) => b.pieces - a.pieces).slice(0, 5),
  };
}

type Numbers = {
  users: UserStats;
  sales: ReturnType<typeof salesOf>;
  products: { total: number; active: number };
  openReports: number;
};

/** One headline number. `href` makes the whole tile a link. */
function Tile({ icon, label, value, sub, href, tone }: { icon: IconName; label: string; value: string; sub?: string; href?: string; tone?: "brand" | "danger" }) {
  const { t } = useT();
  const inner = (
    <>
      <span className="flex items-center justify-between">
        <span
          className={`grid size-9 place-items-center rounded-full ${tone === "danger" ? "bg-red-500/10 text-danger" : tone === "brand" ? "bg-brand text-white" : "bg-soft text-fg"}`}
        >
          <Icon name={icon} className="size-4.5" />
        </span>
        {href && <Icon name="arrowRight" className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-fg" />}
      </span>
      <span className="mt-5 block text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{value}</span>
      <span className="mt-1 block text-sm font-medium">{t(label)}</span>
      {sub && <span className="mt-0.5 block text-xs text-muted">{sub}</span>}
    </>
  );
  const cls = "group block rounded-3xl border border-line bg-raised p-5 transition";
  return href ? (
    <Link href={href} className={`${cls} hover:border-fg`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Pieces sold per day, as plain bars with the number on top. */
function SalesChart({ daily }: { daily: Numbers["sales"]["daily"] }) {
  const { t, locale } = useT();
  const max = Math.max(1, ...daily.map((d) => d.pieces));
  return (
    <div className="rounded-3xl border border-line bg-raised p-5 sm:p-6">
      <div className="flex h-44 items-end gap-1.5 sm:gap-2.5">
        {daily.map((d, i) => {
          const today = i === daily.length - 1;
          return (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${d.date.toLocaleDateString(locale)} · ${formatPrice(d.money)}`}>
              <span className={`text-[11px] tabular-nums ${d.pieces ? "font-semibold" : "text-muted"}`}>{d.pieces || ""}</span>
              <span
                className={`w-full rounded-t-lg ${today ? "bg-brand" : d.pieces ? "bg-fg" : "bg-line"}`}
                style={{ height: `${Math.max(3, (d.pieces / max) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2.5">
        {daily.map((d, i) => (
          <span key={i} className={`flex-1 text-center text-[10px] tabular-nums ${i === daily.length - 1 ? "font-semibold text-brand" : "text-muted"}`}>
            {i === daily.length - 1 ? t("Today") : d.date.getDate()}
          </span>
        ))}
      </div>
    </div>
  );
}

function Overview() {
  const { t, tn } = useT();
  const [numbers, setNumbers] = useState<Numbers | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.users.stats(30),
      allOrders(),
      api.products.list({ limit: 1 }),
      api.products.list({ limit: 1, inStock: true }),
      api.reports.list({ status: "open", limit: 1 }),
    ]).then(
      ([users, orders, all, active, reports]) =>
        setNumbers({ users, sales: salesOf(orders), products: { total: all.total, active: active.total }, openReports: reports.counts.open }),
      (err) => setError(errorMessage(err)),
    );
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!numbers) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-3xl" />
        ))}
      </div>
    );
  }

  const { users, sales, products, openReports } = numbers;
  const n = (v: number) => v.toLocaleString("ru-RU");

  return (
    <div className="space-y-14">
      {openReports > 0 && (
        <Link href="/admin/reports" className="flex animate-rise items-center gap-4 rounded-3xl bg-danger px-6 py-5 text-white transition hover:opacity-90">
          <Icon name="flag" className="size-6 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-2xl font-semibold">{tn(openReports, "{n} report is waiting", "{n} reports are waiting")}</span>
            <span className="text-sm opacity-85">{t("People flagged products. Look at them and decide what to do.")}</span>
          </span>
          <Icon name="arrowRight" className="size-5 shrink-0" />
        </Link>
      )}

      <section>
        <SectionTitle title="Today in the" accent="shop" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile icon="cart" tone="brand" label="Sold today" value={n(sales.piecesToday)} sub={`${tn(sales.ordersToday, "{n} order", "{n} orders")} · ${formatPrice(sales.moneyToday)}`} />
          <Tile icon="users" label="Active today" value={n(users.activeUsers.today)} sub={t("{week} in 7 days · {month} in 30", { week: users.activeUsers.last7Days, month: users.activeUsers.last30Days })} />
          <Tile icon="user" label="New users today" value={n(users.registered.today)} sub={t("{n} in total", { n: users.totalUsers })} href="/admin/users" />
          <Tile icon="truck" label="Orders in progress" value={n(sales.inProgress)} sub={tn(sales.waiting, "{n} waiting to be confirmed", "{n} waiting to be confirmed")} href="/admin/orders" />
        </div>
      </section>

      <section>
        <SectionTitle title="All" accent="time" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile icon="check" label="Sold in total" value={n(sales.piecesTotal)} sub={`${tn(sales.ordersTotal, "{n} order", "{n} orders")} · ${t("{n} cancelled", { n: sales.cancelled })}`} />
          <Tile icon="chart" label="Revenue" value={formatPrice(sales.moneyTotal)} sub={t("Orders that weren't cancelled")} />
          <Tile
            icon="tag"
            label="Products on sale"
            value={`${n(products.active)} / ${n(products.total)}`}
            sub={t("{n} sold out", { n: products.total - products.active })}
            href="/products"
          />
          <Tile icon="flag" tone={openReports ? "danger" : undefined} label="Open reports" value={n(openReports)} sub={t("Flagged by shoppers")} href="/admin/reports" />
        </div>
      </section>

      <section>
        <SectionTitle title={`Pieces sold, last ${DAYS}`} accent="days" />
        <SalesChart daily={sales.daily} />
      </section>

      {sales.best.length > 0 && (
        <section>
          <SectionTitle title="Best" accent="sellers" />
          <ol className="divide-y divide-line">
            {sales.best.map((b, i) => (
              <li key={b.name + i} className="flex items-center gap-4 py-3.5">
                <span className="w-6 font-display text-2xl font-semibold text-muted">{i + 1}</span>
                {b.productId ? (
                  <Link href={`/products/${b.productId}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand">
                    {b.name}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate font-medium">{b.name}</span>
                )}
                <span className="text-sm text-muted tabular-nums">{tn(b.pieces, "{n} sold", "{n} sold")}</span>
                <span className="w-32 text-right font-semibold tabular-nums">{formatPrice(b.money)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <SectionTitle title="People" accent="coming in" />
        <div className="space-y-6">
          <DailyChart daily={users.daily} />
          <div className="grid gap-6 md:grid-cols-2">
            <CountBars
              title="Where users came from"
              counts={(Object.keys(SOURCE_LABELS) as Source[]).map((s) => ({ label: SOURCE_LABELS[s], value: users.bySource[s] }))}
            />
            <CountBars
              title="How people log in"
              counts={[
                { label: "Registered", value: users.loginsByMethod.register },
                { label: "Password", value: users.loginsByMethod.password },
                { label: "Telegram", value: users.loginsByMethod.telegram },
                { label: "TikTok", value: users.loginsByMethod.tiktok },
                { label: "Instagram", value: users.loginsByMethod.instagram },
              ]}
            />
          </div>
          <p className="text-sm text-muted">{t("Days are counted in {zone}.", { zone: users.timeZone })}</p>
        </div>
      </section>
    </div>
  );
}

export default function AdminPage() {
  const { t } = useT();
  const { user } = useSession();
  return (
    <>
      <header className="mb-8 border-b border-line pb-8">
        <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-muted uppercase">
          <span className="h-px w-10 bg-fg/40" />
          {t("Behind the counter")}
        </p>
        <h1 className="mt-4 flex items-center gap-3 font-display text-5xl leading-none font-semibold sm:text-6xl">
          {t("Admin")} <span className="marker">{t("panel")}</span>
          <AdminBadge className="size-9" />
        </h1>
        {user && <p className="mt-3 text-muted">{t("Signed in as {name}", { name: user.name })}</p>}
      </header>
      <AdminGate>
        <Overview />
      </AdminGate>
    </>
  );
}
