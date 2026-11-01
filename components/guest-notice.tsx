"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Icon } from "./icons";
import { BUTTON, BUTTON_SECONDARY } from "./ui";

/** Shown to guest accounts where products are added: selling needs a real account. */
export function GuestCantSell() {
  const { t } = useT();
  const router = useRouter();
  return (
    <section className="flex flex-col items-center rounded-2xl border border-line bg-raised px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-amber-400/15 text-amber-600 dark:text-amber-300">
        <Icon name="tag" className="size-7" />
      </span>
      <h2 className="mt-4 text-xl font-semibold">{t("Guests can't sell")}</h2>
      <p className="mt-1 max-w-md text-muted">
        {t("Selling needs a real account. Put your email in Edit profile and you can add products right away.")}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/settings?tab=account" className={BUTTON}>
          <Icon name="edit" className="size-4" /> {t("Edit profile")}
        </Link>
        <button
          type="button"
          onClick={() => {
            api.auth.logout(); // straight to Register, not the usual Log in page
            router.push("/register");
          }}
          className={BUTTON_SECONDARY}
        >
          {t("Register instead")}
        </button>
      </div>
    </section>
  );
}
