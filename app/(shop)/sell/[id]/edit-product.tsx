"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import type { Product } from "@/lib/shoplink";
import { ProductForm } from "@/components/product-form";
import { useRequireLogin } from "@/components/session";
import { BUTTON, EmptyState, ErrorBox, PageTitle, Skeleton } from "@/components/ui";

export function EditProduct({ id }: { id: number }) {
  const { t } = useT();
  const user = useRequireLogin();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.products.get(id).then(setProduct, (err) => setError(errorMessage(err)));
  }, [user, id]);

  if (error) return <ErrorBox message={error} />;
  if (!user || !product) return <Skeleton className="h-96 w-full" />;

  // The backend refuses changes from anyone else; this just explains it up front.
  if (product.sellerId !== user.id && user.role !== "admin") {
    return (
      <EmptyState
        icon="shield"
        title="This isn't your product"
        text="Only its seller can change it."
        action={
          <Link href={`/products/${product.id}`} className={BUTTON}>
            {t("View product")}
          </Link>
        }
      />
    );
  }

  return (
    <>
      <PageTitle>{t("Edit “{name}”", { name: product.name })}</PageTitle>
      <ProductForm product={product} />
    </>
  );
}
