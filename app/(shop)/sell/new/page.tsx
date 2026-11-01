"use client";

import Link from "next/link";
import { isGuest } from "@/lib/guest";
import { useT } from "@/lib/i18n";
import { GuestCantSell } from "@/components/guest-notice";
import { Icon } from "@/components/icons";
import { ProductForm } from "@/components/product-form";
import { useRequireLogin } from "@/components/session";
import { PageTitle, Skeleton } from "@/components/ui";

export default function NewProductPage() {
  const { t } = useT();
  const user = useRequireLogin();
  return (
    <>
      <Link href="/sell" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-brand">
        <Icon name="arrowLeft" className="size-4" /> {t("My products")}
      </Link>
      <PageTitle sub="Photos, price, stock, sizes and colors. It shows up in the shop as soon as you publish it.">Add a product</PageTitle>
      {!user ? <Skeleton className="h-96 w-full rounded-2xl" /> : isGuest(user) ? <GuestCantSell /> : <ProductForm />}
    </>
  );
}
