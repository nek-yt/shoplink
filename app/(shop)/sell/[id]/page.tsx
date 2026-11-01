import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { EditProduct } from "./edit-product";

export default function EditProductPage({ params }: PageProps<"/sell/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      {params.then(({ id }) => (
        <EditProduct id={Number(id)} />
      ))}
    </Suspense>
  );
}
