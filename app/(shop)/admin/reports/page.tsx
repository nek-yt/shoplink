"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatPrice, timeAgo } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Product, Report, ReportStatus } from "@/lib/shoplink";
import { AdminBadge } from "@/components/admin-badge";
import { AdminGate } from "@/components/admin";
import { useConfirm } from "@/components/dialog";
import { Icon } from "@/components/icons";
import { REPORT_REASON_LABELS } from "@/components/report";
import { useSession } from "@/components/session";
import { BUTTON_DANGER_SOLID, BUTTON_SECONDARY, ErrorBox, ProductImage, Skeleton } from "@/components/ui";

const TABS: { id: ReportStatus; label: string }[] = [
  { id: "open", label: "Waiting" },
  { id: "resolved", label: "Handled" },
  { id: "dismissed", label: "Dismissed" },
];

/** Reports on the same product, together: the admin decides once per product. */
type Group = { product: Product; reports: Report[] };
function byProduct(reports: Report[]): Group[] {
  const groups = new Map<number, Group>();
  for (const r of reports) {
    const g = groups.get(r.productId) ?? { product: r.product, reports: [] };
    g.reports.push(r);
    groups.set(r.productId, g);
  }
  return [...groups.values()].sort((a, b) => b.reports.length - a.reports.length);
}

function ReportedProduct({ group, status, onDone }: { group: Group; status: ReportStatus; onDone: () => void }) {
  const { t, tn, locale } = useT();
  const { notify } = useSession();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const p = group.product;

  async function act(run: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await run();
      notify({ title: done, text: p.name, image: p.imageUrl, kind: "info" });
      onDone();
    } catch (err) {
      notify({ title: "Couldn't do that", text: t(errorMessage(err)) }, "error");
      setBusy(false);
    }
  }

  const takeOff = () =>
    act(async () => {
      await api.products.update(p.id, { stock: 0 });
      await api.reports.closeProduct(p.id, "resolved");
    }, "Taken off sale");

  async function remove() {
    const yes = await confirm({
      title: t("Delete “{name}”?", { name: p.name }),
      text: "It disappears from the shop for everyone, with its reports. Past orders keep their copy. This can't be undone.",
      confirmLabel: "Delete product",
      danger: true,
      icon: "trash",
    });
    if (yes) act(() => api.products.remove(p.id), "Product deleted");
  }

  // Counted reasons, most common first: "Fake or copy ×3".
  const reasons = Object.entries(
    group.reports.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <li className={`animate-rise rounded-3xl border bg-raised p-5 sm:p-6 ${status === "open" ? "border-danger/30" : "border-line"} ${busy ? "pointer-events-none opacity-60" : ""}`}>
      <div className="flex flex-col gap-5 sm:flex-row">
        <Link href={`/products/${p.id}`} className="shrink-0 self-start overflow-hidden rounded-2xl bg-photo">
          <ProductImage product={p} className="aspect-4/5 w-28 sm:w-32" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/products/${p.id}`} className="block font-display text-2xl leading-tight font-semibold hover:text-brand">
                {p.name}
              </Link>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                {p.seller ? (
                  <Link href={`/products?sellerId=${p.seller.id}`} className="inline-flex items-center gap-1 font-medium text-fg hover:text-brand">
                    {p.seller.socialUsername ? `@${p.seller.socialUsername}` : p.seller.name}
                    {p.seller.isAdmin && <AdminBadge className="size-3.5" />}
                  </Link>
                ) : (
                  t("No seller")
                )}
                <span>·</span>
                <span className="font-semibold text-fg tabular-nums">{formatPrice(p.price)}</span>
                <span>·</span>
                <span className={p.inStock ? "" : "text-danger"}>{p.inStock ? tn(p.stock, "{n} in stock", "{n} in stock") : t("Sold out")}</span>
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${status === "open" ? "bg-red-500/10 text-danger" : "bg-soft text-muted"}`}>
              {tn(group.reports.length, "{n} report", "{n} reports")}
            </span>
          </div>

          <p className="mt-3 flex flex-wrap gap-2">
            {reasons.map(([reason, count]) => (
              <span key={reason} className="rounded-full border border-line px-3 py-1 text-sm font-medium">
                {t(REPORT_REASON_LABELS[reason as keyof typeof REPORT_REASON_LABELS]?.label ?? reason)}
                {count > 1 && <span className="ml-1 text-muted">×{count}</span>}
              </span>
            ))}
          </p>

          {/* Who said what */}
          <ul className="mt-4 space-y-2.5">
            {group.reports.map((r) => (
              <li key={r.id} className="flex gap-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={api.assetUrl(r.reporterAvatarUrl)} alt="" className="size-7 shrink-0 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-semibold">{r.reporterUsername ? `@${r.reporterUsername}` : r.reporterName}</span>{" "}
                    <span className="text-muted">
                      · {t(REPORT_REASON_LABELS[r.reason]?.label ?? r.reason)} · {timeAgo(r.createdAt, locale)}
                    </span>
                  </p>
                  {r.note && <p className="mt-0.5 rounded-xl bg-soft px-3 py-2 whitespace-pre-line">{r.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* What the admin can do with it */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
        {status === "open" ? (
          <>
            <button type="button" onClick={() => act(() => api.reports.closeProduct(p.id, "dismissed"), "Reports dismissed")} className={`${BUTTON_SECONDARY} h-10 px-4 text-sm`}>
              <Icon name="check" className="size-4" /> {t("It's fine")}
            </button>
            {p.inStock && (
              <button type="button" onClick={takeOff} className={`${BUTTON_SECONDARY} h-10 px-4 text-sm`}>
                <Icon name="eye" className="size-4" /> {t("Take off sale")}
              </button>
            )}
            <Link href={`/sell/${p.id}`} className={`${BUTTON_SECONDARY} h-10 px-4 text-sm`}>
              <Icon name="edit" className="size-4" /> {t("Edit")}
            </Link>
            <button type="button" onClick={remove} className={`${BUTTON_DANGER_SOLID} h-10 px-4 text-sm`}>
              <Icon name="trash" className="size-4" /> {t("Delete product")}
            </button>
            <button
              type="button"
              onClick={() => act(() => api.reports.closeProduct(p.id, "resolved"), "Marked as handled")}
              className="ml-auto text-sm font-medium text-muted underline-offset-4 hover:text-fg hover:underline"
            >
              {t("Mark as handled")}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => act(() => Promise.all(group.reports.map((r) => api.reports.update(r.id, "open"))), "Opened again")}
              className={`${BUTTON_SECONDARY} h-10 px-4 text-sm`}
            >
              {t("Open again")}
            </button>
            <Link href={`/sell/${p.id}`} className={`${BUTTON_SECONDARY} h-10 px-4 text-sm`}>
              <Icon name="edit" className="size-4" /> {t("Edit")}
            </Link>
            <button type="button" onClick={remove} className="ml-auto text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline">
              {t("Delete product")}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function Reports() {
  const { t } = useT();
  const [status, setStatus] = useState<ReportStatus>("open");
  const [reports, setReports] = useState<Report[] | null>(null);
  const [counts, setCounts] = useState<Record<ReportStatus, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bumped after the admin acts on a product, to load the list again.
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let current = true;
    (async () => {
      const all: Report[] = [];
      for (let page = 1; ; page++) {
        const res = await api.reports.list({ status, page, limit: 100 });
        all.push(...res.items);
        if (page >= res.pages) return { all, counts: res.counts };
      }
    })().then(
      ({ all, counts }) => {
        if (!current) return;
        setReports(all);
        setCounts(counts);
      },
      (err) => current && setError(errorMessage(err)),
    );
    return () => {
      current = false;
    };
  }, [status, version]);

  const groups = reports ? byProduct(reports) : null;

  return (
    <>
      <div className="mb-8 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={status === x.id}
            onClick={() => {
              setStatus(x.id);
              setReports(null);
            }}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${status === x.id ? "bg-fg text-surface" : "bg-soft text-muted hover:text-fg"}`}
          >
            {t(x.label)}
            {counts && <span className={`text-xs tabular-nums ${status === x.id ? "opacity-70" : ""}`}>{counts[x.id]}</span>}
          </button>
        ))}
      </div>

      <ErrorBox message={error} />
      {!groups ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-soft text-muted">
            <Icon name="flag" className="size-7" />
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold">{t(status === "open" ? "Nothing to look at" : "Nothing here yet")}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted">
            {t(status === "open" ? "When someone reports a product, it shows up here for you to decide." : "Reports you deal with end up here.")}
          </p>
        </div>
      ) : (
        <ul className="space-y-5">
          {groups.map((g) => (
            <ReportedProduct key={g.product.id} group={g} status={status} onDone={reload} />
          ))}
        </ul>
      )}
    </>
  );
}

export default function AdminReportsPage() {
  const { t } = useT();
  return (
    <>
      <header className="mb-8 border-b border-line pb-8">
        <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-muted uppercase">
          <span className="h-px w-10 bg-fg/40" />
          {t("Flagged by shoppers")}
        </p>
        <h1 className="mt-4 font-display text-5xl leading-none font-semibold sm:text-6xl">
          <span className="marker">{t("Reports")}</span>
        </h1>
      </header>
      <AdminGate>
        <Reports />
      </AdminGate>
    </>
  );
}
