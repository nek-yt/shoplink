"use client";

import { useT } from "@/lib/i18n";
import { Logo } from "../icons";
import { SOCIALS } from "./socials";

// Drawings and small pieces that fill the tiles on the left half. Colors match the palette in globals.css.

type Props = { className: string };

export function Hoodie({ className }: Props) {
  return (
    <svg viewBox="0 0 200 200" className={className}>
      <path d="M62 48 Q100 4 138 48 L132 66 Q100 50 68 66 Z" fill="currentColor" opacity="0.75" />
      <path
        d="M62 48 L30 70 L14 142 L42 148 L52 104 L50 188 L150 188 L148 104 L158 148 L186 142 L170 70 L138 48 Q100 78 62 48 Z"
        fill="currentColor"
      />
      <path d="M70 142 H130 L138 176 H62 Z" fill="none" stroke="#ff6a3d" strokeWidth="5" strokeLinejoin="round" />
      <path d="M90 66 L88 100 M110 66 L112 100" stroke="#ff6a3d" strokeWidth="4" strokeLinecap="round" />
      <circle cx="88" cy="104" r="4" fill="#ff6a3d" />
      <circle cx="112" cy="104" r="4" fill="#ff6a3d" />
    </svg>
  );
}

export function Parcel({ className }: Props) {
  return (
    <svg viewBox="0 0 120 120" fill="none" stroke="white" strokeWidth="5" strokeLinejoin="round" className={className}>
      <path d="M60 12 L104 34 V86 L60 108 L16 86 V34 Z" fill="#ff6a3d" />
      <path d="M16 34 L60 56 L104 34 M60 56 V108" />
      <path d="M38 23 L82 45 V62" />
    </svg>
  );
}

export function Truck({ className }: Props) {
  return (
    <svg viewBox="0 0 160 100" className={className}>
      <rect x="6" y="14" width="92" height="58" rx="8" fill="#ff6a3d" />
      <path d="M98 34 H130 L150 56 V72 H98 Z" fill="white" />
      <path d="M108 42 H127 L139 56 H108 Z" fill="#2a2857" />
      <circle cx="36" cy="78" r="13" fill="white" stroke="#2a2857" strokeWidth="6" />
      <circle cx="124" cy="78" r="13" fill="white" stroke="#2a2857" strokeWidth="6" />
      <path d="M22 36 H60 M22 50 H48" stroke="white" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function Stopwatch({ className }: Props) {
  return (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" className={className}>
      <circle cx="50" cy="56" r="36" />
      <path d="M42 8 H58 M50 8 V20 M80 22 L86 16" />
      <path d="M50 56 L64 40" stroke="#2a2857" />
      <circle cx="50" cy="56" r="5" fill="#2a2857" stroke="none" />
    </svg>
  );
}

export function BigBag({ className }: Props) {
  return (
    <svg viewBox="0 0 120 140" className={className}>
      <path d="M38 44 V32 a22 22 0 0 1 44 0 V44" fill="none" stroke="#ff6a3d" strokeWidth="9" strokeLinecap="round" />
      <rect x="8" y="42" width="104" height="92" rx="16" fill="white" />
      <path d="M38 80 Q60 104 82 80" fill="none" stroke="#3c2bd9" strokeWidth="9" strokeLinecap="round" />
      <circle cx="40" cy="64" r="6" fill="#3c2bd9" />
      <circle cx="80" cy="64" r="6" fill="#3c2bd9" />
    </svg>
  );
}

/** The small bag next to "Regist here!" / "Log In!": the ShopLink logo. */
export function BagIcon() {
  return <Logo className="h-5.5 w-5" />;
}

/** An example of how a customer chats with the shop, e.g. in Instagram DMs. */
export function Chat() {
  const { t } = useT();
  return (
    <div className="space-y-2 text-sm">
      <p className="w-fit rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 whitespace-nowrap text-ink">{t("Is the hoodie in size M?")} 👀</p>
      <p className="ml-auto w-fit rounded-2xl rounded-br-sm bg-tangerine px-3.5 py-2 whitespace-nowrap">
        {t("Yes! Order it on ShopLink")} 🛍️
      </p>
    </div>
  );
}

/** The order statuses the backend uses, as a little tracker. */
export function OrderSteps() {
  const { t } = useT();
  const steps = ["Order placed", "Confirmed", "Shipped", "Delivered"];
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-3 text-sm">
          <span className={`size-3 rounded-full ${i < 3 ? "bg-tangerine" : "border-2 border-white/40"}`} />
          <span className={i < 3 ? "" : "opacity-50"}>{t(step)}</span>
        </li>
      ))}
    </ol>
  );
}

export function SocialChips() {
  return (
    <div className="flex flex-wrap gap-2">
      {SOCIALS.map((s) => (
        <span
          key={s.value}
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-semibold text-ink [&_svg]:size-4"
        >
          {s.icon}
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** Soft light circle in a tile's corner. */
export function Glow({ className }: Props) {
  return <div className={`pointer-events-none absolute rounded-full bg-white/10 ${className}`} />;
}
