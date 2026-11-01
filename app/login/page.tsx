"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { nextPage } from "@/lib/validation";
import { useSavedAccounts } from "@/components/accounts";
import { GuestButton } from "@/components/auth/guest";
import { AuthLayout } from "@/components/auth/layout";
import { Field, FormMessage, readApiError, SubmitButton, SwitchLink, useFormErrors, type FieldErrors } from "@/components/auth/form";
import { Icon, type IconName } from "@/components/icons";
import { useSession } from "@/components/session";

// Backend field name → input name. The backend says which one was wrong on a failed login.
const INPUTS = { login: "login", password: "password" };
const MAX_FACES = 4;
const WAITING: { icon: IconName; label: string }[] = [
  { icon: "cart", label: "your cart" },
  { icon: "heart", label: "your wishlist" },
  { icon: "box", label: "your orders" },
];

const noSubscribe = () => () => {};
/** The address's ?query, read in the browser only (the server draws the page without it). */
const useQuery = () => new URLSearchParams(useSyncExternalStore(noSubscribe, () => window.location.search, () => ""));

/** Accounts saved on this device: one tap logs straight back in (a run-out one fills in the email instead). */
function SavedFaces({ onPick }: { onPick: (id: number) => void }) {
  const { t } = useT();
  const accounts = useSavedAccounts();
  if (accounts.length === 0) return null;
  return (
    <div className="mb-6">
      <p className="mb-2 font-hand text-xl font-bold text-black/60 dark:text-muted">{t("pick up where you left off")}</p>
      <div className="flex flex-wrap gap-2.5">
        {accounts.slice(0, MAX_FACES).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a.id)}
            className="group flex max-w-full items-center gap-2.5 rounded-full border-2 border-ink bg-field py-1 pr-4 pl-1 text-left transition hover:-translate-y-0.5 hover:bg-ink hover:text-white dark:border-line dark:bg-soft dark:hover:border-fg dark:hover:bg-raised"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={api.assetUrl(a.avatarUrl)} alt="" className={`size-9 shrink-0 rounded-full object-cover ${a.expired ? "opacity-50 grayscale" : ""}`} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">{a.username ? `@${a.username}` : a.name}</span>
              <span className="block truncate text-xs opacity-60">{t(a.expired ? "Log in again" : "Tap to continue")}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useT();
  const router = useRouter();
  const errors = useFormErrors();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { notify, switchAccount } = useSession();
  const accounts = useSavedAccounts();
  const query = useQuery();
  // ?add=1: logging in with one more account, kept next to the ones already on this device.
  const adding = query.get("add") === "1";
  // ?login=…: the switcher sends a run-out account here with its email filled in.
  const knownLogin = query.get("login") ?? "";

  useEffect(() => {
    if (api.auth.isLoggedIn() && !new URLSearchParams(window.location.search).has("add")) router.replace(nextPage(window.location.search));
  }, [router]);

  function pick(id: number) {
    const account = accounts.find((a) => a.id === id);
    if (!account) return;
    if (account.expired) {
      router.replace(`/login?login=${encodeURIComponent(account.contact ?? "")}${adding ? "&add=1" : ""}`);
      return;
    }
    switchAccount(id);
    router.replace(nextPage(window.location.search));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const login = String(form.get("login")).trim();
    const password = String(form.get("password"));

    const missing: FieldErrors = {};
    if (!login) missing.login = "Enter your email or phone number";
    if (!password) missing.password = "Enter your password";
    if (Object.keys(missing).length) return errors.show(missing);

    setLoading(true);
    try {
      const { user } = await api.auth.login(login, password);
      notify({
        title: t(adding ? "Switched to {name}" : "Welcome back, {name}!", { name: user.socialUsername ? `@${user.socialUsername}` : user.name }),
        text: adding ? "Your other accounts stay one tap away under your picture." : undefined,
        image: user.avatarUrl,
      });
      // Next.js keeps this page alive in the background, so empty it for the next visit (after logging out).
      formEl.reset();
      errors.clear();
      setShowPassword(false);
      router.replace(nextPage(window.location.search));
    } catch (err) {
      const { fields, general } = readApiError(err, INPUTS);
      errors.show(fields, general);
    }
    setLoading(false);
  }

  return (
    <AuthLayout tiles="login">
      <h1 className="font-hand text-5xl leading-none font-bold sm:text-6xl">{t(adding ? "Add an account" : "Welcome, Back!")}</h1>
      {adding ? (
        <p className="mt-2 mb-6 text-black/60 dark:text-muted">
          {t("Log in with another account. You can switch between them any time.")}{" "}
          <Link href="/" className="font-medium text-brand hover:underline">
            {t("Not now")}
          </Link>
        </p>
      ) : (
        <p className="mt-1 mb-6 flex flex-wrap items-center gap-x-2 font-hand text-xl font-bold text-black/60 dark:text-muted">
          {WAITING.map((w, i) => (
            <span key={w.label} className="inline-flex items-center gap-1">
              <Icon name={w.icon} className="size-4.5 text-brand" />
              {t(w.label)}
              {i < WAITING.length - 1 && <span className="text-tangerine">·</span>}
            </span>
          ))}
          <span>{t("are waiting for you")}</span>
        </p>
      )}

      {!adding && <SavedFaces onPick={pick} />}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          key={knownLogin}
          label="Address/email"
          placeholder="example@gmail.com"
          autoComplete="username"
          defaultValue={knownLogin}
          autoFocus={Boolean(knownLogin) || undefined}
          {...errors.field("login")}
        />
        <Field
          label="password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          autoComplete="current-password"
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={t(showPassword ? "Hide password" : "Show password")}
              aria-pressed={showPassword}
              className={`grid size-10 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10 ${showPassword ? "text-brand" : "text-black/50 dark:text-muted"}`}
            >
              <Icon name="eye" className="size-5" />
            </button>
          }
          {...errors.field("password")}
        />
        <FormMessage message={errors.general} />
        <div className="pt-2">
          <SubmitButton loading={loading}>{t("Log In")}</SubmitButton>
        </div>
      </form>

      {!adding && <GuestButton disabled={loading} />}
      <SwitchLink question="Don't have an account?" href={adding ? "/register?add=1" : "/register"} label="Regist here!" />
    </AuthLayout>
  );
}
