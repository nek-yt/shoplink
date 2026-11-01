"use client";

import { useT } from "@/lib/i18n";
import { LanguageMenu } from "../language";
import { BigBag, Chat, Glow, Hoodie, OrderSteps, Parcel, SocialChips, Stopwatch, Truck } from "./illustrations";

// The dark left half with three colored tiles. Each page arranges them like its mockup.
const TILE = "relative flex flex-col justify-between overflow-hidden rounded-[32px] p-7 text-white";
const ORANGE = `${TILE} bg-tangerine`;
const NAVY = `${TILE} border-2 border-white bg-navy`;
const BLUE = `${TILE} bg-brand`;
const KICKER = "text-xs font-bold tracking-[0.2em] uppercase opacity-80";

function LoginTiles() {
  const { t } = useT();
  return (
    <div className="grid h-full grid-cols-[1.85fr_1fr] grid-rows-[1.45fr_1fr] gap-6">
      <div className={ORANGE}>
        <Glow className="-top-16 -right-16 size-56" />
        <Hoodie className="absolute top-5 right-6 h-[46%] rotate-6 text-white drop-shadow-xl" />
        <p className={KICKER}>{t("New drops weekly")}</p>
        <div>
          <p className="font-hand text-5xl leading-none font-bold">
            {t("Fresh fits,")}
            <br />
            {t("every week")}
          </p>
          <p className="mt-3 max-w-xs text-sm opacity-90">{t("Hoodies, jeans, bags and more — new pieces land in the shop every week.")}</p>
        </div>
      </div>
      <div className={NAVY}>
        <p className={KICKER}>{t("Your orders")}</p>
        <Parcel className="mx-auto w-[55%] -rotate-6 drop-shadow-xl" />
        <OrderSteps />
      </div>
      <div className={`col-span-2 ${BLUE}`}>
        <Glow className="-right-20 -bottom-24 size-72" />
        <div className="flex items-start justify-between gap-6">
          <p className="max-w-xs text-2xl leading-snug font-medium">
            {t("Found us on social media? Order the way you like — one account for everything.")}
          </p>
          <div className="w-60 shrink-0">
            <Chat />
          </div>
        </div>
        <SocialChips />
      </div>
    </div>
  );
}

function RegisterTiles() {
  const { t } = useT();
  const perks = ["Save your address for fast checkout", "Track every order in one place", "Shop from Instagram, TikTok or Telegram"];
  return (
    <div className="grid h-full grid-cols-[1fr_1.6fr] grid-rows-[1fr_1.1fr] gap-6">
      <div className={`col-span-2 ${BLUE}`}>
        <Glow className="-top-24 -right-16 size-72" />
        <BigBag className="absolute top-1/2 right-[8%] h-[62%] -translate-y-1/2 -rotate-8 drop-shadow-2xl" />
        <div>
          <p className={KICKER}>{t("ShopLink account")}</p>
          <p className="mt-2 font-hand text-5xl leading-none font-bold">{t("Join the shop")}</p>
        </div>
        <ul className="space-y-1.5 text-sm">
          {perks.map((perk) => (
            <li key={perk} className="flex gap-2">
              <span className="text-tangerine">✓</span>
              {t(perk)}
            </li>
          ))}
        </ul>
      </div>
      <div className={ORANGE}>
        <p className={KICKER}>{t("Takes")}</p>
        <Stopwatch className="mx-auto w-[48%] text-white" />
        <div>
          <p className="font-hand text-6xl leading-none font-bold">{t("1 min")}</p>
          <p className="mt-1 text-sm opacity-90">{t("to create your account")}</p>
        </div>
      </div>
      <div className={NAVY}>
        <p className={KICKER}>{t("Order tracking")}</p>
        <Truck className="w-[62%] self-center drop-shadow-xl" />
        <OrderSteps />
      </div>
    </div>
  );
}

const GRADIENT =
  "radial-gradient(circle at 15% 10%, rgb(255 106 61 / 0.22), transparent 45%), " +
  "radial-gradient(circle at 90% 95%, rgb(60 43 217 / 0.45), transparent 55%), " +
  "linear-gradient(160deg, #262626, #121212)";

/** Split screen: decorative tiles on the left (hidden on phones), the form on the right. */
export function AuthLayout({ tiles, children }: { tiles: "login" | "register"; children: React.ReactNode }) {
  return (
    // The form side follows the theme; the tile panel on the left is dark in both.
    <div className="auth-ui flex min-h-screen flex-1 bg-paper text-black dark:bg-surface dark:text-fg">
      <aside className="hidden w-[58%] bg-ink px-[5%] py-16 md:block dark:border-r dark:border-line dark:bg-raised dark:bg-none!" style={{ backgroundImage: GRADIENT }} aria-hidden>
        {tiles === "login" ? <LoginTiles /> : <RegisterTiles />}
      </aside>
      <main className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        {/* Language switch, also on the login pages. */}
        <div className="absolute top-4 right-4">
          <LanguageMenu />
        </div>
        <div className="w-full max-w-115">{children}</div>
      </main>
    </div>
  );
}
