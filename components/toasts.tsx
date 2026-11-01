"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Icon } from "./icons";

export type ToastKind = "ok" | "error" | "info";

/** A message that tells the user what just happened, e.g. "Added to cart" with the product's picture. */
export interface ToastInput {
  title: string;
  text?: string;
  kind?: ToastKind;
  /** Picture address from the API (relative ones are fine). */
  image?: string;
  action?: { label: string; href: string };
}

export type Toast = ToastInput & { id: number; kind: ToastKind };

export const TOAST_MS = 4500;

const STYLE: Record<ToastKind, { icon: "check" | "close" | "chat"; ring: string; bar: string }> = {
  ok: { icon: "check", ring: "bg-emerald-500 text-white", bar: "bg-emerald-500" },
  error: { icon: "close", ring: "bg-red-600 text-white", bar: "bg-red-600" },
  info: { icon: "chat", ring: "bg-brand text-white", bar: "bg-brand" },
};

export function Toasts({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  const { t: translate } = useT();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 md:bottom-4 flex flex-col items-center gap-2 px-3 sm:right-4 sm:left-auto sm:items-end"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const style = STYLE[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto relative w-full max-w-sm animate-rise overflow-hidden rounded-xl border border-line bg-raised shadow-2xl"
          >
            <div className="flex items-start gap-3 p-3.5 pr-10">
              {t.image ? (
                <span className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={api.assetUrl(t.image)} alt="" className="h-14 w-11 rounded-md bg-photo object-cover" />
                  <span className={`absolute -right-1.5 -bottom-1.5 grid size-5 place-items-center rounded-full ring-2 ring-surface ${style.ring}`}>
                    <Icon name={style.icon} className="size-3" />
                  </span>
                </span>
              ) : (
                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${style.ring}`}>
                  <Icon name={style.icon} className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.title}</p>
                {t.text && <p className="mt-0.5 text-sm text-muted">{t.text}</p>}
                {t.action && (
                  <Link href={t.action.href} onClick={() => onClose(t.id)} className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                    {t.action.label} <Icon name="arrowRight" className="size-3.5" />
                  </Link>
                )}
              </div>
            </div>
            <button type="button" onClick={() => onClose(t.id)} aria-label={translate("Close message")} className="absolute top-2.5 right-2.5 rounded-md p-1 text-muted hover:bg-soft hover:text-fg">
              <Icon name="close" className="size-4" />
            </button>
            {/* Shrinks while the message is shown. */}
            <span className={`absolute bottom-0 left-0 h-0.5 w-full origin-left animate-shrink ${style.bar}`} style={{ animationDuration: `${TOAST_MS}ms` }} />
          </div>
        );
      })}
    </div>
  );
}
