"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { ShoplinkError, type Order } from "@/lib/shoplink";
import { Icon } from "@/components/icons";
import { CopyNumber, isActive, OrderActions, OrderSummary, STATUS_HELP, STATUS_LINE, StatusSteps, useOrderProducts } from "@/components/orders";
import { useRequireLogin } from "@/components/session";
import { BUTTON, EmptyState, ErrorBox, Skeleton } from "@/components/ui";

export function OrderDetail({ id }: { id: number }) {
  const { t, locale } = useT();
  const user = useRequireLogin();
  const [order, setOrder] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ?placed=1 when we come straight from checkout (this component is inside the page's <Suspense>).
  const justPlaced = useSearchParams().has("placed");
  const validId = Number.isInteger(id) && id > 0;
  const products = useOrderProducts(order ? [order] : null);

  useEffect(() => {
    if (!user || !validId) return;
    api.orders.get(id).then(setOrder, (err) =>
      err instanceof ShoplinkError && err.status === 404 ? setMissing(true) : setError(errorMessage(err)),
    );
  }, [user, id, validId]);

  if (!validId || missing) {
    return (
      <EmptyState
        icon="box"
        title="Order not found"
        action={
          <Link href="/orders" className={BUTTON}>
            {t("My orders")}
          </Link>
        }
      />
    );
  }
  if (error) return <ErrorBox message={error} />;
  if (!order) return <Skeleton className="h-96 w-full rounded-3xl" />;

  const cancelled = order.status === "cancelled";

  return (
    <>
      <Link href="/orders" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg">
        <Icon name="arrowLeft" className="size-4" /> {t("All orders")}
      </Link>

      {justPlaced && (
        <section className="mb-10 flex animate-rise flex-col items-start gap-5 rounded-3xl bg-fg p-7 text-surface sm:flex-row sm:items-center sm:p-9">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand text-white">
            <Icon name="check" className="size-7" />
          </span>
          <div>
            <h2 className="font-display text-3xl leading-tight font-semibold sm:text-4xl">{t("Thank you — your order is placed")}</h2>
            <p className="mt-1 opacity-75">{t("The seller will confirm it soon. You pay when it arrives.")}</p>
          </div>
        </section>
      )}

      <header className="mb-10 border-b border-line pb-8">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold tracking-[0.2em] text-muted uppercase">
          <span className="flex items-center gap-1">
            {t("Order {number}", { number: order.orderNumber })}
            <CopyNumber number={order.orderNumber} />
          </span>
          <span>· {t("Placed {date}", { date: formatDate(order.createdAt, locale) })}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className={`font-display text-5xl leading-none font-semibold sm:text-6xl ${cancelled ? "text-muted" : ""}`}>
              {isActive(order) ? <span className="marker">{t(STATUS_LINE[order.status])}</span> : t(STATUS_LINE[order.status])}
            </h1>
            <p className="mt-3 max-w-xl text-muted">{t(STATUS_HELP[order.status])}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderActions order={order} onChange={setOrder} />
          </div>
        </div>
        {!cancelled && (
          <div className="mt-10 max-w-3xl">
            <StatusSteps status={order.status} />
          </div>
        )}
      </header>

      <OrderSummary order={order} products={products} />

      <p className="mt-12 border-t border-line pt-6 text-sm text-muted">
        {t("Something wrong with this order?")}{" "}
        <Link href="/settings?tab=help" className="font-medium text-fg underline underline-offset-4 hover:text-brand">
          {t("See Help")}
        </Link>
        {order.status === "new" && <> — {t("you can cancel it yourself while it is still waiting for the seller.")}</>}
      </p>
    </>
  );
}
