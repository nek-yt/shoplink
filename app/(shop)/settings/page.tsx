import { Suspense } from "react";
import { PageTitle, Skeleton } from "@/components/ui";
import { Settings } from "./settings";

// The open tab is in the address (?tab=add), which a page can only read inside <Suspense>.
export default function SettingsPage() {
  return (
    <>
      <PageTitle sub="Your account and how the shop looks">Settings</PageTitle>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Settings />
      </Suspense>
    </>
  );
}
