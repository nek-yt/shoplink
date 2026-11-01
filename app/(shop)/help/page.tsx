import { redirect } from "next/navigation";

// Help lives in Settings now; old links still work.
export default function HelpPage() {
  redirect("/settings?tab=help");
}
