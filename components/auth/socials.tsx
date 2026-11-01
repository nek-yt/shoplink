import type { Source } from "@/lib/shoplink";

/** The platforms customers come from, with their logos (white on the dark buttons, dark on the chips). */
export const SOCIALS: { value: Source; label: string; icon: React.ReactNode }[] = [
  {
    value: "instagram",
    label: "Instagram",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    value: "tiktok",
    label: "TikTok",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
      </svg>
    ),
  },
  {
    value: "telegram",
    label: "Telegram",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M21.9 4.3 18.7 19.4c-.24 1.06-.87 1.32-1.76.82l-4.86-3.58-2.35 2.26c-.26.26-.48.48-.98.48l.35-4.96 9.02-8.15c.39-.35-.09-.54-.61-.2L6.36 13.1l-4.8-1.5c-1.04-.33-1.06-1.04.22-1.54L20.55 2.9c.87-.32 1.63.2 1.35 1.4z" />
      </svg>
    ),
  },
];
