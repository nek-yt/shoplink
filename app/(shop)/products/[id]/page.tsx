import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { ProductDetail } from "./product-detail";

export default function ProductPage({ params }: PageProps<"/products/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-3/4 w-full" />
          <div className="space-y-4">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-7 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      }
    >
      {params.then(({ id }) => (
        <ProductDetail id={Number(id)} />
      ))}
    </Suspense>
  );
}
