"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { ShoplinkError } from "@/lib/shoplink";
import { BagIcon } from "./illustrations";

/** Error message per input name. An input with a message is red. */
export type FieldErrors = Partial<Record<string, string>>;

// Backend messages rewritten for customers. Anything else is shown as the backend wrote it.
const FRIENDLY: Record<string, string> = {
  "login is not registered": "No account with this email or phone",
  "password is incorrect": "Wrong password",
  "email is already registered": "This email is already registered",
  "phone is already registered": "This phone number is already registered",
  "email or phone is required": "Enter your email or phone number",
  "email must be a valid email": "Enter a valid email",
};

/**
 * Splits a failed request into errors for the inputs and a general message for the box under them.
 * The backend starts each error with the field it is about ("email must be a valid email"); `inputs` maps
 * those field names to this form's input names. Errors about anything else go to the general message.
 */
export function readApiError(err: unknown, inputs: Record<string, string>) {
  if (!(err instanceof ShoplinkError)) return { fields: {}, general: "Something went wrong, please try again" };
  const fields: FieldErrors = {};
  const other: string[] = [];
  for (const message of err.errors) {
    const input = inputs[message.split(" ")[0]];
    const text = FRIENDLY[message] ?? message.charAt(0).toUpperCase() + message.slice(1);
    if (input) fields[input] ??= text;
    else other.push(text);
  }
  const general = Object.keys(fields).length === 0 || other.length ? [err.message, ...other].join(". ") : null;
  return { fields, general };
}

/**
 * Form errors. Every wrong input is red, and it stays red until the user changes it: the backend stops at the
 * first problem it finds, so an untouched wrong value must keep its mark when a later try reports another one.
 */
export function useFormErrors() {
  const [fields, setFields] = useState<FieldErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  // Goes up on every failed try so an input that is already red shakes again.
  const [attempt, setAttempt] = useState(0);

  return {
    general,
    show(newFields: FieldErrors, newGeneral: string | null = null) {
      setFields((current) => ({ ...current, ...newFields }));
      setGeneral(newGeneral);
      setAttempt((a) => a + 1);
    },
    clear() {
      setFields({});
      setGeneral(null);
    },
    /** Props for <Field>: its name, its error, and dropping that error once the user types in it. */
    field: (name: string) => ({
      name,
      error: fields[name],
      attempt,
      onInput: () =>
        setFields((current) => {
          const rest = { ...current };
          delete rest[name];
          return rest;
        }),
    }),
  };
}

const SHAKE: Keyframe[] = [0, -8, 8, -6, 6, -3, 3, 0].map((x) => ({ transform: `translateX(${x}px)` }));

type FieldProps = {
  label: string;
  error?: string;
  attempt?: number;
  /** A small button inside the input on the right, e.g. show/hide the password. */
  trailing?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function Field({ label, error, attempt, trailing, ...input }: FieldProps) {
  const { t } = useT();
  const ref = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    if (!error || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ref.current?.animate(SHAKE, { duration: 400, easing: "ease-in-out" });
  }, [error, attempt]);

  return (
    <label className="block">
      <span className={`mb-1 block text-lg leading-tight font-medium ${error ? "text-red-600 dark:text-danger" : ""}`}>{t(label)}</span>
      <span className="relative block">
      <input
        {...input}
        ref={ref}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`h-14 w-full rounded-lg border-2 px-5 text-lg transition-colors outline-none placeholder:text-black/40 dark:placeholder:text-muted ${trailing ? "pr-14" : ""} ${
          error
            ? "border-red-500 bg-red-50 text-red-700 dark:border-danger dark:bg-red-500/10 dark:text-danger"
            : "border-ink bg-field focus:border-brand dark:border-line dark:bg-soft dark:text-fg dark:hover:border-muted dark:focus:border-brand dark:focus:bg-raised"
        }`}
      />
      {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
      </span>
      {error && (
        <span id={errorId} className="mt-1 block text-sm font-medium text-red-600 dark:text-danger">
          {t(error)}
        </span>
      )}
    </label>
  );
}

/** For problems that are not about one input: server down, too many attempts... */
export function FormMessage({ message }: { message: string | null }) {
  const { t } = useT();
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border-2 border-red-500 bg-red-50 px-4 py-3 font-medium text-red-700 dark:border-danger/60 dark:bg-red-500/10 dark:text-danger">
      {t(message)}
    </p>
  );
}

export function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="h-14 w-full rounded-lg bg-brand text-2xl font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
    >
      {loading ? "…" : children}
    </button>
  );
}

export function SwitchLink({ question, href, label }: { question: string; href: string; label: string }) {
  const { t } = useT();
  return (
    <p className="mt-5 flex items-center justify-center gap-2 font-hand text-lg">
      {t(question)}
      <Link href={href} className="inline-flex items-center gap-1 font-bold text-brand hover:underline">
        {t(label)}
        <BagIcon />
      </Link>
    </p>
  );
}
