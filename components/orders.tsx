"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatDateTime, formatPrice, STATUS_LABELS } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Order, OrderItem, OrderStatus, Product } from "@/lib/shoplink";
import { Icon } from "./icons";
import { useConfirm } from "./dialog";
import { useSession } from "./session";
import { BUTTON, BUTTON_SECONDARY, ProductImage, StatusBadge } from "./ui";

const FLOW: OrderStatus[] = ["new", "confirmed", "shipped", "delivered"];

/** What each status means for the buyer (English; shown through t()). */
export const STATUS_HELP: Record<OrderStatus, string> = {
  new: "The shop has your order and will confirm it soon. You can still cancel it.",
  confirmed: "The shop confirmed your order and is getting it ready.",
  shipped: "Your order is on its way.",
  delivered: "Delivered. Enjoy!",
  cancelled: "This order was cancelled. Its items went back to the shop.",
};

/** The status as one plain sentence, for the buyer. */
export const STATUS_LINE: Record<OrderStatus, string> = {
  new: "Waiting for the seller to confirm",
  confirmed: "The seller is packing it",
  shipped: "On the way to you",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** The steps' names on the tracker. */
const STEP_LABELS: Record<OrderStatus, string> = {
  new: "Placed",
  confirmed: "Confirmed",
  shipped: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const isActive = (o: Order) => o.status !== "delivered" && o.status !== "cancelled";

// Order items only carry the product's id; pictures come from the product itself. Loaded once per product.
const productCache = new Map<number, Promise<Product | null>>();
const loadProduct = (id: number) => {
  if (!productCache.has(id)) productCache.set(id, api.products.get(id).catch(() => null)); // deleted products: null
  return productCache.get(id)!;
};

/** The current products behind some order items (for pictures and "Buy again"). */
export function useOrderProducts(orders: Order[] | null | undefined) {
  const [products, setProducts] = useState<Map<number, Product | null>>(new Map());
  const ids = [...new Set((orders ?? []).flatMap((o) => o.items.map((i) => i.productId)).filter((id): id is number => id !== null))];
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    let current = true;
    Promise.all(key.split(",").map(async (id) => [Number(id), await loadProduct(Number(id))] as const)).then(
      (pairs) => current && setProducts(new Map(pairs)),
    );
    return () => {
      current = false;
    };
  }, [key]);
  return products;
}

function ItemThumb({ item, product, className }: { item: OrderItem; product: Product | null | undefined; className: string }) {
  return product ? (
    <ProductImage product={product} className={`rounded-xl ${className}`} />
  ) : (
    <span className={`grid place-items-center rounded-xl bg-soft text-muted ${className}`} title={item.productName}>
      <Icon name="box" className="size-5" />
    </span>
  );
}

/** Up to four overlapping pictures of an order's items, then "+N". */
function Thumbs({ order, products, size = "h-20 w-16" }: { order: Order; products: Map<number, Product | null>; size?: string }) {
  const shown = order.items.slice(0, 4);
  const more = order.items.length - shown.length;
  return (
    <div className="flex shrink-0 -space-x-4">
      {shown.map((item) => (
        <ItemThumb key={item.id} item={item} product={item.productId ? products.get(item.productId) : null} className={`${size} border-2 border-raised`} />
      ))}
      {more > 0 && <span className={`grid place-items-center rounded-xl border-2 border-raised bg-soft text-sm font-semibold ${size}`}>+{more}</span>}
    </div>
  );
}

export function CopyNumber({ number }: { number: string }) {
  const { t } = useT();
  const { notify } = useSession();
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(number);
          notify({ title: t("Order number copied"), text: number, kind: "info" });
        } catch {
          notify({ title: t("Couldn't copy"), text: number }, "error");
        }
      }}
      title={t("Copy order number")}
      aria-label={t("Copy order number {number}", { number })}
      className="rounded p-1 text-muted transition hover:bg-soft hover:text-fg"
    >
      <Icon name="copy" className="size-4" />
    </button>
  );
}

/** Buy again / Cancel for one of my orders. `onChange` gets the order after cancelling. */
export function OrderActions({ order, onChange, compact = false }: { order: Order; onChange: (o: Order) => void; compact?: boolean }) {
  const { t } = useT();
  const { addManyToCart, notify } = useSession();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<"again" | "cancel" | null>(null);
  const items = order.items.filter((i) => i.productId !== null);
  const size = compact ? "h-10 px-4 text-sm" : "h-11 px-5";

  async function buyAgain() {
    setBusy("again");
    await addManyToCart(items.map((i) => ({ productId: i.productId!, quantity: i.quantity, size: i.size ?? undefined, color: i.color ?? undefined })));
    setBusy(null);
  }

  async function cancel() {
    const yes = await confirm({
      title: t("Cancel order {number}?", { number: order.orderNumber }),
      text: "Its items go back to the shop. This can't be undone.",
      confirmLabel: "Cancel order",
      cancelLabel: "Keep it",
      danger: true,
      icon: "box",
    });
    if (!yes) return;
    setBusy("cancel");
    try {
      onChange(await api.orders.cancel(order.id));
      notify({ title: t("Order cancelled"), text: t("{number} · its items went back to the shop", { number: order.orderNumber }), kind: "info" });
    } catch (err) {
      notify({ title: t("Couldn't cancel the order"), text: t(errorMessage(err)) }, "error");
    }
    setBusy(null);
  }

  return (
    <>
      {items.length > 0 && (
        <button type="button" onClick={buyAgain} disabled={busy !== null} className={`${isActive(order) ? BUTTON_SECONDARY : BUTTON} ${size}`}>
          <Icon name="cart" className="size-4" /> {busy === "again" ? t("Adding…") : t("Buy again")}
        </button>
      )}
      {order.status === "new" && (
        <button
          type="button"
          onClick={cancel}
          disabled={busy !== null}
          className="px-2 text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline disabled:opacity-50"
        >
          {busy === "cancel" ? t("Cancelling…") : t("Cancel order")}
        </button>
      )}
    </>
  );
}

/** Placed → confirmed → on the way → delivered, as a line with dots. */
export function StatusSteps({ status, compact = false }: { status: OrderStatus; compact?: boolean }) {
  const { t } = useT();
  if (status === "cancelled") {
    return <p className="rounded-2xl bg-soft px-4 py-3 text-sm font-medium text-muted">{t(STATUS_HELP.cancelled)}</p>;
  }
  const current = FLOW.indexOf(status);
  return (
    <ol className="grid grid-cols-4" aria-label={t("Step {step} of 4: {status}", { step: current + 1, status: t(STEP_LABELS[status]) })}>
      {FLOW.map((step, i) => (
        <li key={step} className="relative flex flex-col">
          <div className="flex items-center">
            <span
              className={`relative z-10 grid shrink-0 place-items-center rounded-full ${compact ? "size-3" : "size-5"} ${
                i < current ? "bg-fg" : i === current ? "bg-brand ring-4 ring-brand/20" : "border-2 border-line bg-raised"
              }`}
            >
              {!compact && i < current && <Icon name="check" className="size-3 text-surface" />}
            </span>
            {i < FLOW.length - 1 && <span className={`h-0.5 flex-1 ${i < current ? "bg-fg" : "bg-line"}`} />}
          </div>
          <span className={`mt-2 pr-2 text-xs ${i === current ? "font-semibold text-fg" : i < current ? "text-fg" : "text-muted"}`}>{t(STEP_LABELS[step])}</span>
        </li>
      ))}
    </ol>
  );
}

/** An order that's still moving: big, with what's happening in words and the tracker. */
export function ActiveOrderCard({ order, products, onChange }: { order: Order; products: Map<number, Product | null>; onChange: (o: Order) => void }) {
  const { t, tn, locale } = useT();
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <li className="animate-rise rounded-3xl border border-line bg-raised p-6 sm:p-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Link href={`/orders/${order.id}`} className="shrink-0">
          <Thumbs order={order} products={products} size="h-24 w-20" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-brand uppercase">
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand/60" />
              <span className="relative size-2 rounded-full bg-brand" />
            </span>
            {t("In progress")}
          </p>
          <Link href={`/orders/${order.id}`} className="mt-2 block font-display text-3xl leading-tight font-semibold hover:text-brand">
            {t(STATUS_LINE[order.status])}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {order.items.map((i) => i.productName).join(", ")}
          </p>
        </div>
        <p className="shrink-0 text-xl font-semibold tabular-nums sm:text-right">{formatPrice(order.total)}</p>
      </div>

      <div className="mt-7">
        <StatusSteps status={order.status} />
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <p className="text-sm text-muted">
          {order.orderNumber} · {formatDate(order.createdAt, locale)} · {tn(count, "{n} item", "{n} items")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <OrderActions order={order} onChange={onChange} compact />
          <Link href={`/orders/${order.id}`} className={`${BUTTON} h-10 px-4 text-sm`}>
            {t("Details")} <Icon name="arrowRight" className="size-4" />
          </Link>
        </div>
      </div>
    </li>
  );
}

/** A finished (delivered or cancelled) order as one line. */
export function PastOrderRow({ order, products, onChange }: { order: Order; products: Map<number, Product | null>; onChange: (o: Order) => void }) {
  const { t, locale } = useT();
  const cancelled = order.status === "cancelled";
  return (
    <li className="flex animate-rise flex-wrap items-center gap-x-5 gap-y-3 py-5">
      <Link href={`/orders/${order.id}`} className="flex min-w-0 basis-full items-center gap-4 sm:basis-0 sm:flex-1 sm:gap-5">
        <span className={`shrink-0 ${cancelled ? "opacity-50 grayscale" : ""}`}>
          <Thumbs order={order} products={products} size="h-16 w-13" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium hover:text-brand">{order.items.map((i) => i.productName).join(", ")}</span>
          <span className="mt-0.5 flex items-center gap-2 text-sm text-muted">
            <span className={`size-1.5 rounded-full ${cancelled ? "bg-muted" : "bg-emerald-500"}`} />
            {t(STATUS_LINE[order.status])} · {formatDate(order.updatedAt, locale)}
          </span>
        </span>
      </Link>
      <p className={`font-semibold tabular-nums sm:w-28 sm:text-right ${cancelled ? "text-muted line-through" : ""}`}>{formatPrice(order.total)}</p>
      <div className="ml-auto flex items-center gap-2">
        <OrderActions order={order} onChange={onChange} compact />
      </div>
    </li>
  );
}

/** One order in a list (for sales); links to `href`. */
export function OrderRow({ order, href, extra }: { order: Order; href: string; extra?: React.ReactNode }) {
  const { tn, locale } = useT();
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <li>
      <Link href={href} className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-line bg-raised px-5 py-4 transition hover:border-fg">
        <div className="min-w-40">
          <p className="font-semibold">{order.orderNumber}</p>
          <p className="text-sm text-muted">{formatDate(order.createdAt, locale)}</p>
        </div>
        <p className="min-w-0 flex-1 truncate text-sm text-muted">
          {tn(count, "{n} item", "{n} items")} · {order.items.map((i) => i.productName).join(", ")}
        </p>
        {extra}
        <StatusBadge status={order.status} />
        <p className="w-32 text-right font-semibold">{formatPrice(order.total)}</p>
      </Link>
    </li>
  );
}

/** Items (with pictures), delivery details and total of an order. */
export function OrderSummary({ order, products }: { order: Order; products?: Map<number, Product | null> }) {
  const { t, locale } = useT();
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
      <section>
        <h2 className="border-b border-line pb-3 font-display text-2xl font-semibold">{t("What's inside")}</h2>
        <ul className="divide-y divide-line">
          {order.items.map((item) => {
            const product = item.productId ? products?.get(item.productId) : null;
            const color = item.color && t(item.color);
            const options = [item.size, color && color[0].toUpperCase() + color.slice(1)].filter(Boolean).join(" · ");
            return (
              <li key={item.id} className="flex items-center gap-4 py-4">
                {products && <ItemThumb item={item} product={product} className="h-20 w-16 shrink-0" />}
                <div className="min-w-0 flex-1">
                  {item.productId && product !== null ? (
                    <Link href={`/products/${item.productId}`} className="font-medium hover:text-brand">
                      {item.productName}
                    </Link>
                  ) : (
                    <span className="font-medium">
                      {item.productName} {products && <span className="text-sm font-normal text-muted">({t("no longer sold")})</span>}
                    </span>
                  )}
                  <p className="text-sm text-muted">
                    {options}
                    {options && " · "}
                    {item.quantity} × {formatPrice(item.price)}
                  </p>
                </div>
                <p className="font-semibold whitespace-nowrap tabular-nums">{formatPrice(item.subtotal)}</p>
              </li>
            );
          })}
        </ul>
        <div className="flex items-baseline justify-between border-t border-fg pt-4">
          <span className="font-medium">{t("Total")}</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatPrice(order.total)}</span>
        </div>
      </section>
      <section>
        <h2 className="border-b border-line pb-3 font-display text-2xl font-semibold">{t("Delivery")}</h2>
        <dl className="space-y-4 pt-4 text-sm">
          {[
            ["Name", order.customerName],
            ["Phone", order.phone],
            ["Address", order.address],
            ["Comment", order.comment],
            ["Placed", formatDateTime(order.createdAt, locale)],
            ["Last update", formatDateTime(order.updatedAt, locale)],
          ].map(
            ([label, value]) =>
              value && (
                <div key={label}>
                  <dt className="text-xs font-semibold tracking-[0.15em] text-muted uppercase">{t(label!)}</dt>
                  <dd className="mt-0.5 font-medium break-words">{value}</dd>
                </div>
              ),
          )}
        </dl>
      </section>
    </div>
  );
}

/** "All", "New", "Confirmed"... tabs for filtering a list of orders, with counts when known. */
export function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: OrderStatus | undefined;
  onChange: (s: OrderStatus | undefined) => void;
  counts?: Partial<Record<OrderStatus | "all", number>>;
}) {
  const { t } = useT();
  const tabs: (OrderStatus | undefined)[] = [undefined, "new", "confirmed", "shipped", "delivered", "cancelled"];
  return (
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const n = counts?.[tab ?? "all"];
        return (
          <button
            key={tab ?? "all"}
            type="button"
            onClick={() => onChange(tab)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              value === tab ? "bg-fg text-surface" : "bg-soft hover:bg-fg/5"
            }`}
          >
            {t(tab ? STATUS_LABELS[tab] : "All")}
            {n !== undefined && <span className={`text-xs ${value === tab ? "opacity-70" : "text-muted"}`}>{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
