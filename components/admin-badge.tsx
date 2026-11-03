"use client";

import { useT } from "@/lib/i18n";

// A scalloped seal (like the "verified" one on Instagram or TikTok): 12 bumps around a circle.
const LOBES = 12;
const SEAL = (() => {
  const pts: string[] = [];
  for (let i = 0; i < LOBES * 2; i++) {
    const r = i % 2 === 0 ? 12 : 10.4;
    const a = (Math.PI * i) / LOBES - Math.PI / 2;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
})();

/** The shop admin's mark: a seal with a hammer, shown next to their name. */
export function AdminBadge({ className = "size-5" }: { className?: string }) {
  const { t } = useT();
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={t("Admin")} className={`inline-block shrink-0 align-[-0.15em] ${className}`}>
      <title>{t("Admin")}</title>
      <polygon points={SEAL} fill="var(--brand)" stroke="var(--brand)" strokeWidth="1.6" strokeLinejoin="round" />
      <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="translate(5.4 5.4) scale(0.55)">
        <path d="m15 12-8.4 8.4a1.4 1.4 0 0 1-2-2L13 10" />
        <path d="m18 15 4-4" />
        <path d="m21.5 11.5-1.9-1.9a2 2 0 0 1-.6-1.4V7l-2.3-2.3A6 6 0 0 0 12.5 3H9l.9.8A6.2 6.2 0 0 1 12 8.4V10l2 2h1.2a2 2 0 0 1 1.4.6l1.9 1.9" />
      </g>
    </svg>
  );
}
