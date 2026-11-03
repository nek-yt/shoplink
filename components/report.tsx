"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import type { Product, ReportReason } from "@/lib/shoplink";
import { Icon, type IconName } from "./icons";
import { loginHref, useSession } from "./session";
import { BUTTON, BUTTON_DANGER_SOLID } from "./ui";

/** What each reason means, for the reporter and the admins (English; shown through t()). */
export const REPORT_REASON_LABELS: Record<ReportReason, { label: string; text: string }> = {
  scam: { label: "Scam or fraud", text: "Tries to take money without a fair deal" },
  fake: { label: "Fake or counterfeit", text: "Not the real thing, or copied from someone else" },
  wrong_info: { label: "Wrong information", text: "The listing doesn't match the product" },
  prohibited: { label: "Prohibited item", text: "Something that isn't allowed to be sold" },
  offensive: { label: "Offensive content", text: "Hateful, violent or adult content" },
  other: { label: "Something else", text: "Tell us in your own words" },
};

/** The sections of the report menu, TikTok style: a reason, then what exactly is wrong. */
const SECTIONS: { reason: ReportReason; icon: IconName; details: string[] }[] = [
  { reason: "scam", icon: "shield", details: ["Asks to pay outside the shop", "The price is too good to be true", "The seller doesn't deliver", "Asks for personal or card details"] },
  { reason: "fake", icon: "tag", details: ["Not the real brand", "Photos stolen from another shop", "A copy of someone else's design"] },
  { reason: "wrong_info", icon: "edit", details: ["Wrong price", "Wrong size or color", "The photos don't match the product", "Misleading description"] },
  { reason: "prohibited", icon: "close", details: ["Weapons", "Drugs or medicines", "Alcohol or tobacco", "Live animals", "Something else illegal"] },
  { reason: "offensive", icon: "eye", details: ["Hate or harassment", "Nudity or sexual content", "Violence", "Rude or vulgar words"] },
  { reason: "other", icon: "chat", details: [] },
];

type Step = { at: "reasons" } | { at: "details"; reason: ReportReason } | { at: "note"; reason: ReportReason; detail: string | null } | { at: "done" };

function ReportSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const { t } = useT();
  const titleId = useId();
  const [step, setStep] = useState<Step>({ at: "reasons" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (reason: ReportReason) => {
    const section = SECTIONS.find((s) => s.reason === reason)!;
    setError(null);
    setStep(section.details.length ? { at: "details", reason } : { at: "note", reason, detail: null });
  };

  const back = () => {
    setError(null);
    if (step.at === "details") setStep({ at: "reasons" });
    else if (step.at === "note") setStep(SECTIONS.find((s) => s.reason === step.reason)!.details.length ? { at: "details", reason: step.reason } : { at: "reasons" });
  };

  async function submit() {
    if (step.at !== "note") return;
    if (!step.detail && !note.trim()) return setError("Say in a few words what's wrong");
    setBusy(true);
    setError(null);
    try {
      // The admins read the exact detail first, then the reporter's own words.
      const text = [step.detail, note.trim()].filter(Boolean).join(" — ");
      await api.reports.create({ productId: product.id, reason: step.reason, note: text || undefined });
      setStep({ at: "done" });
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(false);
  }

  const heading =
    step.at === "reasons" ? "Why are you reporting this?" : step.at === "done" ? "Thanks for letting us know" : t(REPORT_REASON_LABELS[step.reason].label);

  return createPortal(
    <div className="fixed inset-0 z-70 grid place-items-end sm:place-items-center sm:p-4">
      <div className="absolute inset-0 animate-fade bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[90dvh] w-full max-w-md animate-dialog flex-col rounded-t-3xl border border-line bg-raised shadow-2xl sm:rounded-3xl"
      >
        {/* Top bar: back, title, close */}
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-line px-3 py-3">
          {step.at === "details" || step.at === "note" ? (
            <button type="button" onClick={back} aria-label={t("Back")} className="grid size-10 place-items-center rounded-full hover:bg-soft">
              <Icon name="arrowLeft" className="size-5" />
            </button>
          ) : (
            <span />
          )}
          <h2 id={titleId} className="truncate text-center font-semibold">
            {t(step.at === "done" ? "Report sent" : "Report")}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("Close")} className="grid size-10 place-items-center rounded-full text-muted hover:bg-soft hover:text-fg">
            <Icon name="close" className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {step.at !== "done" && (
            <div className="px-5 pt-5 pb-2">
              <p className="font-display text-2xl leading-tight font-semibold">{t(heading)}</p>
              <p className="mt-1 truncate text-sm text-muted">{product.name}</p>
            </div>
          )}

          {/* Step 1: the sections */}
          {step.at === "reasons" && (
            <ul className="py-2">
              {SECTIONS.map((s) => (
                <li key={s.reason}>
                  <button type="button" onClick={() => pick(s.reason)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-soft">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-soft">
                      <Icon name={s.icon} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{t(REPORT_REASON_LABELS[s.reason].label)}</span>
                      <span className="block text-sm text-muted">{t(REPORT_REASON_LABELS[s.reason].text)}</span>
                    </span>
                    <Icon name="arrowRight" className="size-4 shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Step 2: what exactly */}
          {step.at === "details" && (
            <ul className="py-2">
              {SECTIONS.find((s) => s.reason === step.reason)!.details.map((d) => (
                <li key={d}>
                  <button
                    type="button"
                    onClick={() => setStep({ at: "note", reason: step.reason, detail: d })}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-soft"
                  >
                    <span className="font-medium">{t(d)}</span>
                    <Icon name="arrowRight" className="size-4 shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Step 3: a few words, then send */}
          {step.at === "note" && (
            <div className="space-y-4 px-5 pt-2 pb-5">
              {step.detail && (
                <p className="flex items-center gap-2 rounded-2xl bg-soft px-4 py-3 text-sm font-medium">
                  <Icon name="check" className="size-4 shrink-0" /> {t(step.detail)}
                </p>
              )}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t(step.detail ? "Anything to add? (optional)" : "What's wrong?")}</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  maxLength={800}
                  autoFocus
                  placeholder={t("e.g. The photos are from another shop")}
                  className="w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-fg"
                />
                <span className="mt-1 block text-right text-xs text-muted tabular-nums">{note.length}/800</span>
              </label>
              <p className="text-xs leading-relaxed text-muted">{t("Your report is private. The seller won't know who sent it.")}</p>
              {error && <p className="text-sm font-medium text-danger">{t(error)}</p>}
              <button type="button" onClick={submit} disabled={busy} className={`${BUTTON_DANGER_SOLID} h-12 w-full`}>
                {t(busy ? "Sending…" : "Submit")}
              </button>
            </div>
          )}

          {/* Done */}
          {step.at === "done" && (
            <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
              <span className="grid size-16 animate-pop place-items-center rounded-full bg-emerald-500 text-white">
                <Icon name="check" className="size-8" />
              </span>
              <p className="mt-5 font-display text-2xl font-semibold">{t(heading)}</p>
              <p className="mt-2 max-w-xs text-sm text-muted">{t("The admins will look at this product. If it breaks the rules, it comes down.")}</p>
              <button type="button" onClick={onClose} className={`${BUTTON} mt-7 h-12 w-full`}>
                {t("Done")}
              </button>
            </div>
          )}
        </div>
        <div className="pb-[env(safe-area-inset-bottom)]" />
      </div>
    </div>,
    document.body,
  );
}

/**
 * "Report" for a product. Not shown to admins (they act from the admin panel) or to the seller.
 * Logged-out people are sent to log in first. `variant="icon"` is the round flag button.
 */
export function ReportButton({ product, variant = "link" }: { product: Product; variant?: "link" | "icon" }) {
  const { t } = useT();
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (user?.role === "admin" || (user && user.id === product.sellerId)) return null;

  const start = () => (user ? setOpen(true) : router.push(loginHref(pathname)));
  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={start}
          aria-label={t("Report this product")}
          title={t("Report this product")}
          className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-raised text-muted transition hover:border-danger hover:text-danger"
        >
          <Icon name="flag" className="size-5" />
        </button>
      ) : (
        <button type="button" onClick={start} className="inline-flex items-center gap-2 text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline">
          <Icon name="flag" className="size-4" /> {t("Report this product")}
        </button>
      )}
      {open && <ReportSheet product={product} onClose={() => setOpen(false)} />}
    </>
  );
}
