import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { SaleDetail } from "./sale-detail";

export default function SalePage({ params }: PageProps<"/sell/sales/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      {params.then(({ id }) => (
        <SaleDetail id={Number(id)} />
      ))}
    </Suspense>
  );
}
