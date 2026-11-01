"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { newGuest, saveGuestLogin } from "@/lib/guest";
import { useT } from "@/lib/i18n";
import type { Source } from "@/lib/shoplink";
import { nextPage } from "@/lib/validation";
import { Icon } from "../icons";
import { useSession } from "../session";

/**
 * "or — Continue as guest": one tap makes a real account named like "user48213907561", with a made-up email and a
 * random password (kept on this device, shown on the profile). Used on the login and the register page.
 */
export function GuestButton({ source, disabled, onDone }: { source?: Source | null; disabled?: boolean; onDone?: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const { notify } = useSession();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const guest = newGuest();
      const { user } = await api.auth.register({
        name: guest.username,
        password: guest.password,
        email: guest.email,
        socialUsername: guest.username,
        source: source ?? "other",
      });
      saveGuestLogin({ userId: user.id, email: guest.email, password: guest.password });
      onDone?.();
      notify({
        title: t("Welcome, @{name}!", { name: guest.username }),
        text: "Your guest account is ready. Its login is on your profile.",
        image: user.avatarUrl,
        action: { label: "Profile", href: "/profile" },
      });
      router.replace(nextPage(window.location.search));
    } catch (err) {
      notify({ title: "Couldn't make a guest account", text: t(errorMessage(err)) }, "error");
    }
    setBusy(false);
  }

  return (
    <>
      <div className="my-4 flex items-center gap-3 text-sm text-black/40 dark:text-muted">
        <span className="h-px flex-1 bg-black/10 dark:bg-line" />
        {t("or")}
        <span className="h-px flex-1 bg-black/10 dark:bg-line" />
      </div>
      <button
        type="button"
        onClick={go}
        disabled={busy || disabled}
        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-lg border-2 border-black/80 text-lg font-medium transition-colors hover:bg-black hover:text-white disabled:opacity-60 dark:border-line dark:hover:bg-soft dark:hover:text-fg"
      >
        <Icon name="user" className="size-5" />
        {busy ? "…" : t("Continue as guest")}
      </button>
      <p className="mt-2 text-center text-xs text-black/50 dark:text-muted">{t("No email needed. You get a name like @user48213907561 and can change it later.")}</p>
    </>
  );
}
