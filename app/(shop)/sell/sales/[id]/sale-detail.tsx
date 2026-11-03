"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatPrice, timeAgo } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Order, OrderStatus } from "@/lib/shoplink";
import { useConfirm } from "@/components/dialog";
import { Icon, type IconName } from "@/components/icons";
import { CopyNumber, StatusSteps, useOrderProducts } from "@/components/orders";
import { useRequireLogin, useSession } from "@/components/session";
import { BUTTON, BUTTON_SECONDARY, ErrorBox, ProductImage, Skeleton } from "@/components/ui";

/** What the seller sees and does at each step (English; shown through t()). */
const STEP: Record<OrderStatus, { headline: string; text: string; next?: { status: OrderStatus; label: string; icon: IconName }; todo: string[] }> = {
  new: {
    headline: "New order — confirm it",
    text: "Check you have everything, then confirm so the buyer knows you're on it.",
    next: { status: "confirmed", label: "Confirm order", icon: "check" },
    todo: ["Check the size, color and how many", "Call the buyer if something is unclear", "Confirm the order"],
  },
  confirmed: {
    headline: "Pack it and send it",
    text: "Pack the items and hand them to the courier, then mark the order as shipped.",
    next: { status: "shipped", label: "Mark as shipped", icon: "truck" },
    todo: ["Pack the items carefully", "Write the order number on the package", "Send it to the address below"],
  },
  shipped: {
    headline: "On its way to the buyer",
    text: "When the buyer has it and has paid, mark the order as delivered.",
    next: { status: "delivered", label: "Mark as delivered", icon: "box" },
    todo: ["Keep your phone close for the courier", "Take the payment when it arrives", "Mark it as delivered"],
  },
  delivered: { headline: "Delivered — well done", text: "This sale is complete. The buyer can now rate the product.", todo: [] },
  cancelled: { headline: "Cancelled", text: "This order was cancelled. Its items went back into your stock.", todo: [] },
};

/** A copy button for one detail (phone, address...). */
function CopyButton({ value, what }: { value: string; what: string }) {
  const { t } = useT();
  const { notify } = useSession();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          notify({ title: t("{what} copied", { what: t(what) }), text: value, kind: "info" });
        } catch {
          notify({ title: "Couldn't copy", text: value }, "error");
        }
      }}
      aria-label={t("Copy {what}", { what: t(what) })}
      title={t("Copy")}
      className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-fg hover:text-fg"
    >
      <Icon name="copy" className="size-4" />
    </button>
  );
}

export function SaleDetail({ id }: { id: number }) {
  const { t, tn, locale } = useT();
  const user = useRequireLogin();
  const { notify } = useSession();
  const confirm = useConfirm();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const products = useOrderProducts(order ? [order] : null);

  useEffect(() => {
    if (!user) return;
    api.orders.sale(id).then(setOrder, (err) => setError(errorMessage(err)));
  }, [user, id]);

  if (error) return <ErrorBox message={error} />;
  if (!order) return <Skeleton className="h-96 w-full rounded-3xl" />;

  const step = STEP[order.status];
  const pieces = order.items.reduce((n, i) => n + i.quantity, 0);
  const canManage = order.sellerCanManage === true;
  const digits = order.phone.replace(/[^\d+]/g, "");

  async function move(status: OrderStatus) {
    if (!order) return;
    if (status === "cancelled") {
      const yes = await confirm({
        title: t("Cancel order {number}?", { number: order.orderNumber }),
        text: "The buyer is told right away and the items go back into your stock. This can't be undone.",
        confirmLabel: "Cancel order",
        cancelLabel: "Keep it",
        danger: true,
        icon: "box",
      });
      if (!yes) return;
    }
    setBusy(true);
    try {
      setOrder(await api.orders.setSaleStatus(order.id, status));
      notify({
        title: status === "cancelled" ? "Order cancelled" : "Order updated",
        text: t("The buyer was notified."),
        kind: status === "cancelled" ? "info" : "ok",
      });
    } catch (err) {
      notify({ title: "Couldn't update the order", text: t(errorMessage(err)) }, "error");
    }
    setBusy(false);
  }

  return (
    <>
      <Link href="/sell/sales" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg">
        <Icon name="arrowLeft" className="size-4" /> {t("My sales")}
      </Link>

      {/* What's happening, and the one thing to do now */}
      <header className="border-b border-line pb-10">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold tracking-[0.2em] text-muted uppercase">
          <span className="flex items-center gap-1">
            {t("Sale {number}", { number: order.orderNumber })}
            <CopyNumber number={order.orderNumber} />
          </span>
          <span>· {timeAgo(order.createdAt, locale)}</span>
        </p>
        <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <h1 className={`font-display text-5xl leading-[1.05] font-semibold sm:text-6xl ${order.status === "cancelled" ? "text-muted" : ""}`}>
              {step.next ? <span className="marker">{t(step.headline)}</span> : t(step.headline)}
            </h1>
            <p className="mt-3 max-w-xl text-muted">{t(step.text)}</p>
          </div>

          {step.next && canManage && (
            <div className="space-y-2">
              <button type="button" disabled={busy} onClick={() => move(step.next!.status)} className={`${BUTTON} h-14 w-full text-base`}>
                <Icon name={step.next.icon} className="size-5" /> {t(busy ? "Saving…" : step.next.label)}
              </button>
              {(order.status === "new" || order.status === "confirmed") && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => move("cancelled")}
                  className="w-full py-2 text-center text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline"
                >
                  {t("Cancel this order")}
                </button>
              )}
            </div>
          )}
          {step.next && !canManage && (
            <p className="rounded-2xl bg-soft px-5 py-4 text-sm text-muted">
              {t("This order also has other sellers' items, so the shop's admin moves it through its steps.")}
            </p>
          )}
        </div>

        {order.status !== "cancelled" && (
          <div className="mt-10 max-w-3xl">
            <StatusSteps status={order.status} />
          </div>
        )}
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <div className="space-y-10">
          {/* What to pack */}
          <section>
            <h2 className="flex items-baseline justify-between border-b border-line pb-3">
              <span className="font-display text-2xl font-semibold">{t("What to pack")}</span>
              <span className="text-sm text-muted">{tn(pieces, "{n} item", "{n} items")}</span>
            </h2>
            <ul className="divide-y divide-line">
              {order.items.map((item) => {
                const product = item.productId ? products.get(item.productId) : null;
                return (
                  <li key={item.id} className="flex items-center gap-4 py-4">
                    {product ? (
                      <Link href={`/products/${product.id}`} className="shrink-0 overflow-hidden rounded-xl bg-photo">
                        <ProductImage product={product} className="h-20 w-16" />
                      </Link>
                    ) : (
                      <span className="grid h-20 w-16 shrink-0 place-items-center rounded-xl bg-soft text-muted">
                        <Icon name="box" className="size-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="mt-1 flex flex-wrap gap-1.5 text-sm">
                        {item.size && <span className="rounded-full border border-line px-2.5 py-0.5">{t("Size")} {item.size}</span>}
                        {item.color && <span className="rounded-full border border-line px-2.5 py-0.5 capitalize">{t(item.color)}</span>}
                        <span className="rounded-full bg-fg px-2.5 py-0.5 font-semibold text-surface">× {item.quantity}</span>
                      </p>
                    </div>
                    <p className="font-semibold whitespace-nowrap tabular-nums">{formatPrice(item.subtotal)}</p>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-baseline justify-between border-t border-fg pt-4">
              <span className="font-medium">{t("You get")}</span>
              <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatPrice(order.total)}</span>
            </div>
            <p className="mt-2 text-xs text-muted">{t("The buyer pays when the order arrives.")}</p>
          </section>

          {/* What to do now */}
          {step.todo.length > 0 && (
            <section>
              <h2 className="border-b border-line pb-3 font-display text-2xl font-semibold">{t("To do")}</h2>
              <ol className="mt-4 space-y-3">
                {step.todo.map((todo, i) => (
                  <li key={todo} className="flex items-center gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-sm font-semibold tabular-nums">{i + 1}</span>
                    <span>{t(todo)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* The buyer, with what's needed to reach them */}
        <aside className="h-fit space-y-6 rounded-3xl border border-line bg-raised p-6 lg:sticky lg:top-24">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">{t("Buyer")}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{order.customerName}</p>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-[0.15em] text-muted uppercase">{t("Phone")}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium tabular-nums">{order.phone}</span>
              <CopyButton value={order.phone} what="Phone" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={`tel:${digits}`} className={`${BUTTON} h-11 px-3 text-sm`}>
                <Icon name="chat" className="size-4" /> {t("Call")}
              </a>
              <a href={`https://wa.me/${digits.replace("+", "")}`} target="_blank" rel="noreferrer" className={`${BUTTON_SECONDARY} h-11 px-3 text-sm`}>
                WhatsApp
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-[0.15em] text-muted uppercase">{t("Deliver to")}</p>
            <div className="mt-1.5 flex items-start gap-2">
              <span className="min-w-0 flex-1 font-medium break-words">{order.address}</span>
              <CopyButton value={order.address} what="Address" />
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
            >
              {t("Open in maps")} <Icon name="arrowRight" className="size-3.5" />
            </a>
          </div>

          {order.comment && (
            <div className="rounded-2xl bg-tangerine/10 p-4">
              <p className="text-xs font-semibold tracking-[0.15em] text-tangerine uppercase">{t("Buyer's note")}</p>
              <p className="mt-1 font-medium whitespace-pre-line">{order.comment}</p>
            </div>
          )}

          <dl className="space-y-2 border-t border-line pt-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("Placed")}</dt>
              <dd className="text-right">{formatDateTime(order.createdAt, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("Last update")}</dt>
              <dd className="text-right">{formatDateTime(order.updatedAt, locale)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
