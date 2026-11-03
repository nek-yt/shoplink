"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { Icon, type IconName } from "./icons";
import { BUTTON, BUTTON_DANGER_SOLID, BUTTON_SECONDARY } from "./ui";

export interface ConfirmOptions {
  /** Plain English (translated here) or already translated text with names in it. */
  title: string;
  text?: string;
  /** Label of the yes button, e.g. "Delete". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red yes button and icon, for things that can't be undone. */
  danger?: boolean;
  icon?: IconName;
}

type Ask = (options: ConfirmOptions) => Promise<boolean>;


const ConfirmContext = createContext<Ask | null>(null);

/** `const confirm = useConfirm(); if (!(await confirm({ title: "Delete it?" }))) return;` */
export function useConfirm() {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ask;
}

/** The shop's own "Are you sure?" box, instead of the browser's confirm(). One at a time. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<(ConfirmOptions & { resolve: (yes: boolean) => void }) | null>(null);
  const ask = useCallback<Ask>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setOpen((current) => {
          current?.resolve(false); // a new question replaces an unanswered one
          return { ...options, resolve };
        });
      }),
    [],
  );

  const answer = useCallback((yes: boolean) => {
    setOpen((current) => {
      current?.resolve(yes);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {open && <ConfirmDialog options={open} onAnswer={answer} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (yes: boolean) => void }) {
  const { t } = useT();
  const titleId = useId();
  const textId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const { danger = false } = options;

  useEffect(() => {
    // Risky questions start on "Cancel", so a quick Enter doesn't delete anything.
    (danger ? cancelRef : confirmRef).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAnswer(false);
      // Keep Tab between the two buttons.
      if (e.key === "Tab") {
        e.preventDefault();
        (document.activeElement === cancelRef.current ? confirmRef : cancelRef).current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [danger, onAnswer]);

  return (
    <div className="fixed inset-0 z-70 grid place-items-center p-4">
      <div className="absolute inset-0 animate-fade bg-black/60 backdrop-blur-[2px]" onClick={() => onAnswer(false)} aria-hidden />
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby={titleId}
        aria-describedby={options.text ? textId : undefined}
        className="relative w-full max-w-sm animate-dialog rounded-2xl border border-line bg-raised p-6 shadow-2xl"
      >
        <span
          className={`grid size-12 place-items-center rounded-full ${danger ? "bg-red-500/10 text-danger" : "bg-brand-soft text-brand"}`}
          aria-hidden
        >
          <Icon name={options.icon ?? (danger ? "trash" : "chat")} className="size-6" />
        </span>
        <h2 id={titleId} className="mt-4 text-lg font-semibold">
          {t(options.title)}
        </h2>
        {options.text && (
          <p id={textId} className="mt-1 text-sm text-muted">
            {t(options.text)}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={() => onAnswer(false)} className={`${BUTTON_SECONDARY} sm:min-w-24`}>
            {t(options.cancelLabel ?? "Cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onAnswer(true)}
            className={`${danger ? BUTTON_DANGER_SOLID : BUTTON} sm:min-w-24`}
          >
            {t(options.confirmLabel ?? "OK")}
          </button>
        </div>
      </div>
    </div>
  );
}
