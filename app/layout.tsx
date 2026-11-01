import type { Metadata, Viewport } from "next";
import { Caveat, Cormorant_Garamond, Figtree, Kalam, Onest, Plus_Jakarta_Sans } from "next/font/google";
import { ConfirmProvider } from "@/components/dialog";
import { ActionLoader } from "@/components/loader";
import { SessionProvider } from "@/components/session";
import { THEME_SCRIPT, ThemeSync } from "@/components/theme";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

// Handwritten font for the headings ("Welcome, Back!", "Registration").
const kalam = Kalam({
  variable: "--font-kalam",
  weight: ["400", "700"],
  subsets: ["latin"],
  // No automatic Arial fallback: it has Cyrillic and would win over Caveat (below) for Russian and Tajik.
  adjustFontFallback: false,
  fallback: [],
});

// Kalam has no Cyrillic, so Russian and Tajik headings fall back to this handwriting font
// (cyrillic-ext has the Tajik letters ҳ ҷ ӣ ӯ қ ғ).
const caveat = Caveat({
  variable: "--font-caveat",
  weight: ["700"],
  subsets: ["cyrillic", "cyrillic-ext"],
});

// The logo's wordmark: Plus Jakarta Sans ExtraBold (from the logo sheet).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  weight: ["800"],
  subsets: ["latin"],
});

// The shop's two faces: Cormorant Garamond for headlines (a high-contrast serif with a real italic) and Onest
// for everything you read and click. Both have Cyrillic, including Tajik's extra letters (cyrillic-ext).
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});

export const metadata: Metadata = {
  title: "ShopLink",
  description: "Your shop, one link.",
};

// "cover" lets the phone tab bar sit under the home indicator, padded by env(safe-area-inset-bottom).
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT sets data-theme on <html> before React loads.
    <html lang="en" suppressHydrationWarning className={`${figtree.variable} ${kalam.variable} ${caveat.variable} ${jakarta.variable} ${cormorant.variable} ${onest.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeSync />
        <ConfirmProvider>
          <SessionProvider>{children}</SessionProvider>
        </ConfirmProvider>
        <ActionLoader />
      </body>
    </html>
  );
}
