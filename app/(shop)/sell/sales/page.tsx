"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import type { Order, OrderStatus, Page } from "@/lib/shoplink";
import { Icon } from "@/components/icons";
import { OrderRow, StatusTabs } from "@/components/orders";
import { useRequireLogin } from "@/components/session";
import { BUTTON, EmptyState, ErrorBox, PageTitle, Pagination, Skeleton } from "@/components/ui";

export default function SalesPage() {
  const { t } = useT();
  const user = useRequireLogin();
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<Order> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.orders.sales({ status, page, limit: 20 }).then(setResult, (err) => setError(errorMessage(err)));
  }, [user, status, page]);

  return (
    <>
      <Link href="/sell" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-brand">
        <Icon name="arrowLeft" className="size-4" /> {t("My products")}
      </Link>
      <PageTitle sub="Orders that include your products. Totals count only your items.">My sales</PageTitle>
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
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : result.items.length === 0 ? (
        <EmptyState
          icon="chart"
          title="No sales yet"
          text="When someone orders one of your products, it shows up here."
          action={
            <Link href="/sell" className={BUTTON}>
              {t("My products")}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {result.items.map((order) => (
            <OrderRow key={order.id} order={order} href={`/sell/sales/${order.id}`} />
          ))}
        </ul>
      )}
      {result && <Pagination page={result.page} pages={result.pages} onPage={setPage} />}
    </>
  );
}
