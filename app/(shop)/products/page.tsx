import { Suspense } from "react";
import { CardSkeletons, PageTitle } from "@/components/ui";
import { Catalog } from "./catalog";

// The filters live in the URL (?search=…&sort=…), which a page can only read inside <Suspense>.
export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageTitle>Products</PageTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <CardSkeletons count={8} />
          </div>
        </>
      }
    >
      <Catalog />
    </Suspense>
  );
}
