"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import { REPORT_REASONS, type Product, type ReportReason } from "@/lib/shoplink";
import { Icon } from "./icons";
import { useSession } from "./session";
import { BUTTON_DANGER_SOLID, BUTTON_SECONDARY } from "./ui";

/** What each reason means, for the reporter and the admins (English; shown through t()). */
export const REPORT_REASON_LABELS: Record<ReportReason, { label: string; text: string }> = {
  fake: { label: "Fake or copy", text: "Not the real brand, or photos taken from someone else" },
  scam: { label: "Looks like a scam", text: "Asks to pay outside the shop, price too good to be true" },
  offensive: { label: "Offensive", text: "Rude, hateful or adult content" },
  wrong_info: { label: "Wrong information", text: "Wrong price, size, photos or description" },
  prohibited: { label: "Not allowed to sell", text: "Weapons, drugs, medicines and the like" },
  other: { label: "Something else", text: "Tell the admins in a few words" },
};

function ReportDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const { t } = useT();
  const { notify } = useSession();
  const titleId = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send() {
    if (!reason) return setError("Pick a reason");
    if (reason === "other" && !note.trim()) return setError("Say in a few words what's wrong");
    setBusy(true);
    setError(null);
    try {
      await api.reports.create({ productId: product.id, reason, note: note.trim() || undefined });
      notify({ title: "Thanks for the report", text: "The admins will look at it.", image: product.imageUrl });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-70 grid place-items-end p-0 sm:place-items-center sm:p-4">
      <div className="absolute inset-0 animate-fade bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92dvh] w-full max-w-lg animate-dialog flex-col rounded-t-3xl border border-line bg-raised shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start gap-4 border-b border-line p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-red-500/10 text-danger">
            <Icon name="flag" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-2xl font-semibold">
              {t("Report this product")}
            </h2>
            <p className="truncate text-sm text-muted">{product.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("Close")} className="rounded-full p-1.5 text-muted hover:bg-soft hover:text-fg">
            <Icon name="close" className="size-5" />
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto p-6" role="radiogroup" aria-label={t("Reason")}>
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => {
                setReason(r);
                setError(null);
              }}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                reason === r ? "border-fg bg-fg/[0.03]" : "border-line hover:border-fg/40"
              }`}
            >
              <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${reason === r ? "border-fg" : "border-line"}`}>
                {reason === r && <span className="size-2.5 rounded-full bg-fg" />}
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{t(REPORT_REASON_LABELS[r].label)}</span>
                <span className="block text-sm text-muted">{t(REPORT_REASON_LABELS[r].text)}</span>
              </span>
            </button>
          ))}
          <label className="block pt-3">
            <span className="mb-1.5 block text-sm font-medium">{t(reason === "other" ? "What's wrong?" : "Anything to add? (optional)")}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t("e.g. The photos are from another shop")}
              className="w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-fg"
            />
          </label>
          {error && <p className="text-sm font-medium text-danger">{t(error)}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-line p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={`${BUTTON_SECONDARY} h-11`}>
            {t("Cancel")}
          </button>
          <button type="button" onClick={send} disabled={busy} className={`${BUTTON_DANGER_SOLID} h-11`}>
            <Icon name="flag" className="size-4" /> {t(busy ? "Sending…" : "Send report")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** "Report" link under a product, for logged-in people who don't sell it. */
export function ReportButton({ product }: { product: Product }) {
  const { t } = useT();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  if (!user || user.id === product.sellerId) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline">
        <Icon name="flag" className="size-4" /> {t("Report this product")}
      </button>
      {open && <ReportDialog product={product} onClose={() => setOpen(false)} />}
    </>
  );
}
