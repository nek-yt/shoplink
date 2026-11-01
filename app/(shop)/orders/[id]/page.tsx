import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { OrderDetail } from "./order-detail";

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      {params.then(({ id }) => (
        <OrderDetail id={Number(id)} />
      ))}
    </Suspense>
  );
}
