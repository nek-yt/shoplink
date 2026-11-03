"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import type { UserStats } from "@/lib/shoplink";
import { useRequireLogin } from "./session";
import { EmptyState, Skeleton } from "./ui";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/reports", label: "Reports" },
];

/** Shows its children only to admins, with the admin tabs on top. */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const user = useRequireLogin();
  const pathname = usePathname();
  if (!user) return <Skeleton className="h-96 w-full" />;
  if (user.role !== "admin") return <EmptyState icon="shield" title="Admins only" text="This part of the shop is for the shop's admins." />;
  return (
    <>
      <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((tab) => {
          const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 font-medium ${active ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"}`}
            >
              {t(tab.label)}
            </Link>
          );
        })}
      </nav>
      {children}
    </>
  );
}

/** A headline number (no chart needed for a single value). */
/** `label` is translated here; pass `sub` already translated (it has numbers in it). */
export function StatTile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const { t } = useT();
  return (
    <div className="rounded-lg border border-line bg-raised p-5">
      <p className="text-sm text-muted">{t(label)}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value.toLocaleString("ru-RU")}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

type Metric = "registered" | "activeUsers" | "logins";
const METRICS: { key: Metric; label: string }[] = [
  { key: "logins", label: "Logins" },
  { key: "activeUsers", label: "Active users" },
  { key: "registered", label: "New users" },
];

const shortDate = (d: string, locale: string) => new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short" });

/** One metric per day as thin bars (one series, so no legend), with a hover tooltip and a table view. */
export function DailyChart({ daily }: { daily: UserStats["daily"] }) {
  const { t, locale } = useT();
  const [metric, setMetric] = useState<Metric>("logins");
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...daily.map((d) => d[metric]));
  const label = t(METRICS.find((m) => m.key === metric)!.label);
  const hovered = hover === null ? null : daily[hover];

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{t("{what} per day", { what: label })}</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-soft p-1">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                className={`rounded-md px-3 py-1 text-sm font-medium ${metric === m.key ? "bg-surface shadow-sm" : "text-muted"}`}
              >
                {t(m.label)}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setAsTable((t) => !t)} className="text-sm font-medium text-brand hover:underline">
            {t(asTable ? "Show chart" : "Show as table")}
          </button>
        </div>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-muted">
              <tr>
                <th className="py-1.5 font-medium">{t("Day")}</th>
                {METRICS.map((m) => (
                  <th key={m.key} className="py-1.5 text-right font-medium">
                    {t(m.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {[...daily].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="py-1.5">{shortDate(d.date, locale)}</td>
                  {METRICS.map((m) => (
                    <td key={m.key} className="py-1.5 text-right">
                      {d[m.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <p className="mb-2 h-5 text-sm tabular-nums">
            {hovered ? (
              <>
                <span className="text-muted">{shortDate(hovered.date, locale)}:</span> <b>{hovered[metric]}</b> {label.toLowerCase()}
              </>
            ) : (
              <span className="text-muted">{t("Highest day: {n}", { n: max })}</span>
            )}
          </p>
          <div className="flex h-44 items-end gap-0.5 border-b border-line" onMouseLeave={() => setHover(null)}>
            {daily.map((d, i) => (
              // The whole column is the hover target, not just the (maybe tiny) bar.
              <div
                key={d.date}
                onMouseEnter={() => setHover(i)}
                className={`flex h-full flex-1 items-end ${hover === i ? "bg-soft" : ""}`}
                aria-label={`${shortDate(d.date, locale)}: ${d[metric]}`}
              >
                <div
                  className={`w-full rounded-t-[4px] ${hover === null || hover === i ? "bg-brand" : "bg-brand/40"}`}
                  style={{ height: `${(d[metric] / max) * 100}%`, minHeight: d[metric] ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted">
            <span>{daily[0] && shortDate(daily[0].date, locale)}</span>
            <span>{daily.at(-1) && shortDate(daily.at(-1)!.date, locale)}</span>
          </div>
        </div>
      )}
    </section>
  );
}

/** Labeled bars for a handful of named counts (e.g. users per platform). */
export function CountBars({ title, counts }: { title: string; counts: { label: string; value: number }[] }) {
  const { t } = useT();
  const max = Math.max(1, ...counts.map((c) => c.value));
  return (
    <section>
      <h2 className="mb-4 font-semibold">{t(title)}</h2>
      <ul className="space-y-3">
        {counts.map((c) => (
          <li key={c.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{t(c.label)}</span>
              <span className="font-semibold tabular-nums">{c.value}</span>
            </div>
            <div className="h-2 rounded-full bg-soft">
              <div className="h-2 rounded-full bg-brand" style={{ width: `${(c.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
