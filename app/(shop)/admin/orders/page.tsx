"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatPrice, NEXT_STATUSES, STATUS_LABELS } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Order, OrderStatus, Page } from "@/lib/shoplink";
import { AdminGate } from "@/components/admin";
import { OrderSummary, StatusTabs } from "@/components/orders";
import { useConfirm } from "@/components/dialog";
import { useSession } from "@/components/session";
import { EmptyState, ErrorBox, PageTitle, Pagination, Skeleton, StatusBadge } from "@/components/ui";

function AdminOrder({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const { t, locale } = useT();
  const { notify } = useSession();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function setStatus(status: OrderStatus) {
    if (
      status === "cancelled" &&
      !(await confirm({
        title: t("Cancel order {number}?", { number: order.orderNumber }),
        text: "Its stock goes back to the shop. This can't be undone.",
        confirmLabel: "Cancel order",
        cancelLabel: "Keep it",
        danger: true,
        icon: "box",
      }))
    )
      return;
    setBusy(true);
    try {
      onChange(await api.orders.setStatus(order.id, status));
      notify(`${order.orderNumber}: ${t(STATUS_LABELS[status])}`);
    } catch (err) {
      notify(errorMessage(err), "error");
    }
    setBusy(false);
  }

  return (
    <li className="rounded-lg border border-line bg-raised">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-w-40 text-left" aria-expanded={open}>
          <p className="font-semibold hover:text-brand">{order.orderNumber}</p>
          <p className="text-sm text-muted">{formatDateTime(order.createdAt, locale)}</p>
        </button>
        <p className="min-w-0 flex-1 truncate text-sm">
          {order.customerName} · <span className="text-muted">{order.phone}</span>
        </p>
        <StatusBadge status={order.status} />
        <p className="w-32 text-right font-semibold">{formatPrice(order.total)}</p>
        <div className="flex gap-2">
          {NEXT_STATUSES[order.status].map((next) => (
            <button
              key={next}
              type="button"
              disabled={busy}
              onClick={() => setStatus(next)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                next === "cancelled" ? "text-danger hover:bg-red-50 dark:hover:bg-red-500/10" : "bg-brand text-white hover:bg-brand-dark"
              }`}
            >
              {next === "cancelled" ? t("Cancel") : t("Mark {status}", { status: t(STATUS_LABELS[next]).toLowerCase() })}
            </button>
          ))}
        </div>
      </div>
      {open && (
        <div className="border-t border-line p-5">
          <OrderSummary order={order} />
        </div>
      )}
    </li>
  );
}

function Orders() {
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<Order> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.orders.all({ status, page, limit: 20 }).then(setResult, (err) => setError(errorMessage(err)));
  }, [status, page]);

  return (
    <>
      <StatusTabs
        value={status}
        onChange={(s) => {
          setStatus(s);
          setPage(1);
          setResult(null);
        }}
      />
      <ErrorBox message={error} />
      {!result ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : result.items.length === 0 ? (
        <EmptyState icon="box" title="No orders here" />
      ) : (
        <ul className="space-y-3">
          {result.items.map((order) => (
            <AdminOrder
              key={order.id}
              order={order}
              onChange={(updated) => setResult((r) => r && { ...r, items: r.items.map((o) => (o.id === updated.id ? updated : o)) })}
            />
          ))}
        </ul>
      )}
      {result && <Pagination page={result.page} pages={result.pages} onPage={setPage} />}
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <>
      <PageTitle sub="Move orders from New to Delivered, or cancel them">Admin</PageTitle>
      <AdminGate>
        <Orders />
      </AdminGate>
    </>
  );
}
