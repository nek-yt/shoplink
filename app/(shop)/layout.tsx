import { Suspense } from "react";
import { AccountScope } from "@/components/session";
import { Footer, ScrollTop, Sidebar, Topbar } from "@/components/shell";

// Every shop page: icon sidebar on the left, search bar on top (the home mockup's frame).
// Both read the current address, which on pages like /orders/[id] is only known in the browser, hence the
// <Suspense> with an empty frame of the same size.
export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="shop-ui flex min-h-screen flex-1 bg-surface text-fg">
      <Suspense fallback={<div className="hidden w-16 shrink-0 border-r border-line md:block" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-15 border-b border-line" />}>
          <Topbar />
        </Suspense>
        {/* md:px-12 leaves room for the carousel arrows beside the cards. */}
        <main className="mx-auto w-full max-w-375 flex-1 px-4 py-6 md:px-12">
          <AccountScope>{children}</AccountScope>
        </main>
        <Footer />
        {/* Phones: room for the tab bar fixed at the bottom */}
        <div className="h-[calc(4rem+env(safe-area-inset-bottom))] shrink-0 md:hidden" />
      </div>
      <ScrollTop />
    </div>
  );
}
