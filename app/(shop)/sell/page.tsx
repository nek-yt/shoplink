"use client";

import Link from "next/link";
import { isGuest } from "@/lib/guest";
import { useT } from "@/lib/i18n";
import { GuestCantSell } from "@/components/guest-notice";
import { Icon } from "@/components/icons";
import { useRequireLogin } from "@/components/session";
import { MyProducts } from "@/components/my-products";
import { BUTTON, BUTTON_SECONDARY, PageTitle, Skeleton } from "@/components/ui";

export default function SellPage() {
  const { t } = useT();
  const user = useRequireLogin();
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle sub="Anyone can sell on ShopLink. Your products appear in the shop right away.">My products</PageTitle>
        <div className="flex gap-2">
          <Link href="/sell/sales" className={BUTTON_SECONDARY}>
            <Icon name="chart" className="size-5" /> {t("My sales")}
          </Link>
          {!isGuest(user) && (
            <Link href="/sell/new" className={BUTTON}>
              <Icon name="plus" className="size-5" /> {t("Add product")}
            </Link>
          )}
        </div>
      </div>
      {!user ? <Skeleton className="h-64 w-full rounded-lg" /> : isGuest(user) ? <GuestCantSell /> : <MyProducts addHref="/sell/new" />}
    </>
  );
}
