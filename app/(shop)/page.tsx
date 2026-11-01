"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { CATEGORIES, type Product } from "@/lib/shoplink";
import { CATEGORY_LABELS } from "@/lib/options";
import { Icon } from "@/components/icons";
import { BigBag } from "@/components/auth/illustrations";
import { formatPrice } from "@/lib/format";
import { BUTTON, Carousel, CardSkeletons, EmptyState, ErrorBox, Motif, ProductCard, ProductImage, Reveal, SectionTitle, Skeleton } from "@/components/ui";

// "Products for You" shows four rows: 2, 3, 4 or 5 cards a row (the product grid's columns), so 20 at most.
const FOUR_ROWS = 20;
/** Hides the cards that would start a fifth row at the current width. */
const fourRowsOnly = (i: number) => (i >= 16 ? "hidden 2xl:block" : i >= 12 ? "hidden lg:block" : i >= 8 ? "hidden md:block" : "");

const HERO_WORDS = ["fits", "drops", "hoodies", "styles"];
const TICKER = [
  "Order from Instagram, TikTok & Telegram",
  "Every order gets its own number",
  "Follow it from New to Delivered",
  "Anyone can sell on ShopLink",
  "Save favourites with the ♥",
];
// Quick searches; the catalog searches product names and descriptions, so they search in the chosen language.
// "Shop by": every category except "other".
const CHIPS = CATEGORIES.filter((c) => c !== "other");

/** "Fresh ___ are in", the word changing every few seconds, set in the serif's violet italic. */
function RotatingWord() {
  const { t } = useT();
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setI((n) => (n + 1) % HERO_WORDS.length), 2600);
    return () => clearInterval(timer);
  }, []);
  return (
    <span key={i} className="marker inline-block animate-word pr-[0.06em]">
      {t(HERO_WORDS[i])}
    </span>
  );
}

/** Two of the newest products, composed like a magazine page: a large photo with a smaller one over its corner. */
function Collage({ products }: { products: Product[] | null }) {
  const { t } = useT();
  const [main, second] = products?.filter((p) => p.hasImage) ?? [];
  if (products === null) {
    return (
      <div className="relative pb-14 pl-12 sm:pl-20">
        <Skeleton className="aspect-4/5 w-full rounded-3xl" />
      </div>
    );
  }
  if (!main) {
    return (
      <div className="grid aspect-4/5 place-items-center rounded-3xl bg-soft" aria-hidden>
        <BigBag className="h-1/2 drop-shadow-xl" />
      </div>
    );
  }
  return (
    <div className="relative pb-14 pl-12 sm:pl-20">
      <Link href={`/products/${main.id}`} className="group relative block overflow-hidden rounded-3xl bg-photo">
        <ProductImage product={main} className="aspect-4/5 w-full transition duration-1000 ease-out group-hover:scale-[1.03]" />
        <span className="absolute top-5 right-5 left-5 flex items-start justify-between gap-4">
          <span className="rounded-2xl bg-raised/90 px-4 py-3 shadow-sm backdrop-blur">
            <span className="block text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">{t("Today's pick")}</span>
            <span className="mt-0.5 block max-w-56 truncate font-medium">{main.name}</span>
            <span className="block text-sm font-semibold tabular-nums">{formatPrice(main.price)}</span>
          </span>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-raised/90 shadow-sm backdrop-blur transition group-hover:bg-fg group-hover:text-surface">
            <Icon name="arrowRight" className="size-4" />
          </span>
        </span>
      </Link>
      {second && (
        <Link
          href={`/products/${second.id}`}
          className="group absolute bottom-0 left-0 block w-[40%] overflow-hidden rounded-2xl border-[6px] border-surface bg-photo shadow-paper"
        >
          <ProductImage product={second} className="aspect-4/5 w-full transition duration-700 group-hover:scale-[1.05]" />
        </Link>
      )}
    </div>
  );
}

/** The top of the shop: an editorial headline on the left, the newest products composed on the right. */
function Hero({ newest, total }: { newest: Product[] | null; total: number | null }) {
  const { t } = useT();
  // "Fresh {word} are in": the changing word goes where {word} is in the translation.
  const [before, after] = t("Fresh {word} are in").split("{word}");
  return (
    <section className="grid items-center gap-14 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:pt-10">
      <div>
        <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-muted uppercase">
          <span className="h-px w-10 bg-fg/40" />
          {t("New drops every week")}
        </p>
        <h1 className="mt-6 font-display text-6xl leading-[0.92] font-semibold tracking-tight sm:text-7xl xl:text-[5.5rem]">
          {before}
          <RotatingWord />
          {after}
        </h1>
        <p className="mt-7 max-w-md text-lg leading-relaxed text-muted">
          {t("Order from Instagram, TikTok & Telegram")}. {t("Every order gets its own number")}. {t("Follow it from New to Delivered")}.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
          <Link href="/products" className={`${BUTTON} h-12 px-8`}>
            {t("Shop now")} <Icon name="arrowRight" className="size-4" />
          </Link>
          <Link href="/sell/new" className="group inline-flex items-center gap-2 font-medium">
            <span className="underline-offset-4 group-hover:underline">{t("Start selling")}</span>
            <Icon name="arrowRight" className="size-4 transition group-hover:translate-x-1" />
          </Link>
        </div>
        <dl className="mt-12 flex max-w-md gap-12 border-t border-line pt-6">
          <div>
            <dd className="font-display text-4xl font-semibold tabular-nums">{total ?? "—"}</dd>
            <dt className="mt-1 text-sm text-muted">{t("products on sale")}</dt>
          </div>
          <div>
            <dd className="font-display text-4xl font-semibold">3</dd>
            <dt className="mt-1 text-sm text-muted">{t("apps to order from")}</dt>
          </div>
        </dl>
      </div>
      <Collage products={newest} />
    </section>
  );
}

/** Two panels: one for buyers, one for sellers. */
function Notes() {
  const { t } = useT();
  const notes = [
    { href: "/settings?tab=help", eyebrow: "For buyers", text: "Found us on Instagram, TikTok or Telegram? Order right here.", className: "bg-fg text-surface" },
    { href: "/sell", eyebrow: "For sellers", text: "Have something to sell? Open your shop on ShopLink.", className: "bg-brand text-white" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {notes.map((n) => (
        <Link key={n.href} href={n.href} className={`group flex min-h-52 flex-col justify-between rounded-3xl p-8 transition duration-300 hover:-translate-y-1 sm:p-10 ${n.className}`}>
          <span className="text-xs font-semibold tracking-[0.25em] uppercase opacity-60">{t(n.eyebrow)}</span>
          <span className="mt-6 flex items-end justify-between gap-6">
            <span className="max-w-sm font-display text-3xl leading-tight font-semibold">{t(n.text)}</span>
            <span className="grid size-12 shrink-0 place-items-center rounded-full border border-current/30 transition group-hover:bg-current/10">
              <Icon name="arrowRight" className="size-5 transition group-hover:translate-x-0.5" />
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** A quiet moving line of what the shop does; the list is doubled so the loop has no gap. */
function Ticker() {
  const { t } = useT();
  return (
    <div className="overflow-hidden border-y border-line py-4" aria-label={TICKER.map((line) => t(line)).join(". ")}>
      <div className="flex w-max animate-marquee gap-10 pr-10 hover:[animation-play-state:paused]" aria-hidden>
        {[...TICKER, ...TICKER].map((line, i) => (
          <span key={i} className="flex items-center gap-10 text-xs font-semibold tracking-[0.2em] whitespace-nowrap text-muted uppercase">
            {t(line)}
            <span className="size-1.5 rotate-45 bg-brand" />
          </span>
        ))}
      </div>
    </div>
  );
}

function ShopBy() {
  const { t } = useT();
  return (
    <nav aria-label={t("Popular searches")} className="flex items-center gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]">
      <span className="mr-2 shrink-0 text-xs font-semibold tracking-[0.2em] text-muted uppercase">{t("Shop by")}</span>
      {CHIPS.map((chip) => (
        <Link
          key={chip}
          href={`/products?category=${chip}`}
          className="shrink-0 rounded-full border border-line px-4 py-2 text-sm font-medium transition hover:border-fg hover:bg-fg hover:text-surface"
        >
          {t(CATEGORY_LABELS[chip])}
        </Link>
      ))}
    </nav>
  );
}

export default function Home() {
  const { t, tn } = useT();
  const [topRated, setTopRated] = useState<Product[] | null>(null);
  const [newest, setNewest] = useState<Product[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [forYou, setForYou] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fail = (err: Error) => setError(err.message);
    // The backend's "rating_desc" sort uses the old seller-set number, not the reviews, so the best-reviewed
    // of the latest products are picked here.
    api.products.list({ sort: "newest", inStock: true, limit: 60 }).then(
      (p) =>
        setTopRated(
          [...p.items]
            .sort((a, b) => (b.reviewsRating ?? 0) - (a.reviewsRating ?? 0) || b.reviewsCount - a.reviewsCount)
            .slice(0, 12),
        ),
      fail,
    );
    api.products.list({ sort: "newest", inStock: true, limit: 12 }).then((p) => {
      setNewest(p.items);
      setTotal(p.total);
    }, fail);
    api.products.list({ sort: "name_asc", inStock: true, limit: FOUR_ROWS }).then((p) => setForYou(p.items), fail);
  }, []);

  const emptyShop = forYou?.length === 0;
  const divider = <Motif className="my-16" />;

  return (
    <>
      <Hero newest={newest} total={total} />
      <div className="mt-10 space-y-8">
        <Notes />
        <Ticker />
        <ShopBy />
        <ErrorBox message={error} />
      </div>
      <Motif className="my-16" />

      {/* Backend unreachable: the message above says so, no endless loading boxes. */}
      {error ? null : emptyShop ? (
        <section id="products">
          <EmptyState
            icon="tag"
            title="No products yet"
            text="The shop is empty for now. Be the first to put something up for sale."
            action={
              <Link href="/sell/new" className={BUTTON}>
                <Icon name="plus" className="size-5" /> {t("Sell a product")}
              </Link>
            }
          />
        </section>
      ) : (
        <>
          <Reveal>
            <SectionTitle title="Top rated right" accent="Now" />
            <Carousel products={topRated} />
          </Reveal>
          {divider}
          <Reveal>
            <SectionTitle title="Newest" accent="Arrivals" />
            <Carousel products={newest} />
          </Reveal>
          {divider}
          <section id="products" className="scroll-mt-20">
            <SectionTitle
              title="Products for"
              accent="You"
              action={
                <Link href="/products" className="text-sm font-medium text-brand hover:underline">
                  {t("See all")}
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {forYou
                ? forYou.map((p, i) => (
                    <div key={p.id} className={fourRowsOnly(i)}>
                      <ProductCard product={p} index={i} />
                    </div>
                  ))
                : Array.from({ length: FOUR_ROWS }, (_, i) => (
                    <div key={i} className={fourRowsOnly(i)}>
                      <CardSkeletons count={1} />
                    </div>
                  ))}
            </div>
            <div className="mt-12 flex flex-col items-center gap-3">
              <Link href="/products" className={`${BUTTON} h-12 px-8`}>
                {total ? tn(total, "See all {n} product", "See all {n} products") : t("See all products")} <Icon name="arrowRight" className="size-4" />
              </Link>
              <p className="text-sm text-muted">{t("Filters, sizes, colors and search are on the next page.")}</p>
            </div>
          </section>
        </>
      )}
    </>
  );
}
