"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Source } from "@/lib/shoplink";
import { useT } from "@/lib/i18n";
import { isEmail, isPhone, nextPage, passwordProblem } from "@/lib/validation";
import { GuestButton } from "@/components/auth/guest";
import { AuthLayout } from "@/components/auth/layout";
import { Field, FormMessage, readApiError, SubmitButton, SwitchLink, useFormErrors, type FieldErrors } from "@/components/auth/form";
import { SOCIALS } from "@/components/auth/socials";

// Backend field name → input name. One input takes either an email or a phone number.
const INPUTS = { name: "name", email: "contact", phone: "contact", password: "password" };

export default function RegisterPage() {
  const { t } = useT();
  const router = useRouter();
  const errors = useFormErrors();
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // ?add=1 (from the account switcher): make one more account on this device instead of leaving.
    if (api.auth.isLoggedIn() && !new URLSearchParams(window.location.search).has("add")) router.replace(nextPage(window.location.search));
  }, [router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const name = String(form.get("name")).trim();
    const contact = String(form.get("contact")).trim();
    const password = String(form.get("password"));
    const repeat = String(form.get("repeat"));
    const byEmail = contact.includes("@");

    // Check everything first, with the backend's rules, so every wrong input turns red at once.
    const invalid: FieldErrors = {};
    if (!name) invalid.name = "Enter your name";
    else if (name.length > 100) invalid.name = "Name must be at most 100 characters";
    if (!contact) invalid.contact = "Enter your email or phone number";
    else if (byEmail ? !isEmail(contact) : !isPhone(contact))
      invalid.contact = byEmail ? "Enter a valid email" : "Enter a valid phone number, e.g. +998901234567";
    const problem = passwordProblem(password);
    if (problem) invalid.password = problem;
    if (!repeat) invalid.repeat = "Repeat your password";
    else if (repeat !== password) invalid.repeat = "Passwords don't match";
    if (Object.keys(invalid).length) return errors.show(invalid);

    setLoading(true);
    try {
      await api.auth.register({
        name,
        password,
        ...(byEmail ? { email: contact } : { phone: contact }),
        source: source ?? "other",
      });
      // Next.js keeps this page alive in the background, so empty it for the next visit (after logging out).
      formEl.reset();
      errors.clear();
      setSource(null);
      router.replace(nextPage(window.location.search));
    } catch (err) {
      const { fields, general } = readApiError(err, INPUTS);
      errors.show(fields, general);
    }
    setLoading(false);
  }

  return (
    <AuthLayout tiles="register">
      <h1 className="font-hand text-5xl leading-none font-bold sm:text-6xl">{t("Registration")}</h1>
      <p className="mb-4 font-hand text-xl font-bold text-black/60 dark:text-muted">{t("fill your info here")}</p>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Full Name" placeholder={t("Name")} autoComplete="name" {...errors.field("name")} />
        <Field label="email/phone num" placeholder="exampl@gmail.com" autoComplete="email" {...errors.field("contact")} />
        <Field label="password" type="password" placeholder="••••••••" autoComplete="new-password" {...errors.field("password")} />
        <Field label="repeat password" type="password" placeholder="••••••••" autoComplete="new-password" {...errors.field("repeat")} />

        {/* Where the customer found the shop (the backend's `source`). Not picking one sends "other". */}
        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label={t("Where did you find us?")}>
          {SOCIALS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={source === s.value}
              onClick={() => setSource(source === s.value ? null : s.value)}
              className={`flex h-16 flex-col items-center justify-center gap-1 rounded-lg text-sm font-medium text-white transition [&_svg]:size-6 ${
                source === s.value
                  ? "bg-brand ring-4 ring-brand ring-offset-2 dark:ring-offset-surface"
                  : "bg-ink hover:bg-black dark:bg-soft dark:ring-1 dark:ring-line dark:hover:bg-raised"
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        <FormMessage message={errors.general} />
        <SubmitButton loading={loading}>{t("Regist")}</SubmitButton>
      </form>

      <GuestButton source={source} disabled={loading} onDone={() => setSource(null)} />
      <SwitchLink question="Already have an account?" href="/login" label="Log In!" />
    </AuthLayout>
  );
}
