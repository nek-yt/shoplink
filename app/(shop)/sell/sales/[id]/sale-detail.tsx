"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import type { Order } from "@/lib/shoplink";
import { Icon } from "@/components/icons";
import { OrderSummary, StatusSteps } from "@/components/orders";
import { useRequireLogin } from "@/components/session";
import { ErrorBox, PageTitle, Skeleton, StatusBadge } from "@/components/ui";

export function SaleDetail({ id }: { id: number }) {
  const { t } = useT();
  const user = useRequireLogin();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.orders.sale(id).then(setOrder, (err) => setError(errorMessage(err)));
  }, [user, id]);

  if (error) return <ErrorBox message={error} />;
  if (!order) return <Skeleton className="h-96 w-full" />;

  return (
    <>
      <Link href="/sell/sales" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-brand">
        <Icon name="arrowLeft" className="size-4" /> {t("My sales")}
      </Link>
      <PageTitle sub="Only your items are shown. The shop's admin moves the order through its steps.">
        {t("Sale {number}", { number: order.orderNumber })} <StatusBadge status={order.status} />
      </PageTitle>
      <div className="mb-10">
        <StatusSteps status={order.status} />
      </div>
      <OrderSummary order={order} />
    </>
  );
}
