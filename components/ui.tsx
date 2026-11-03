"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatPrice, STATUS_LABELS } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { OrderStatus, Product } from "@/lib/shoplink";
import { Icon, type IconName } from "./icons";
import { useSession } from "./session";
import { AdminBadge } from "./admin-badge";

// Class names shared by buttons and inputs across the shop: pills, ink first, violet on hover.
export const BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full bg-fg px-6 py-2.5 font-medium text-surface transition duration-200 hover:bg-brand hover:text-white active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";
export const BUTTON_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-raised px-6 py-2.5 font-medium transition duration-200 hover:border-fg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";
/** For the one action that destroys something (delete, report): solid red. */
export const BUTTON_DANGER_SOLID =
  "inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-red-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-red-500 dark:hover:bg-red-600";
export const BUTTON_DANGER =
  "inline-flex items-center justify-center gap-2 rounded-full border border-danger/40 bg-raised px-6 py-2.5 font-medium text-danger transition-colors hover:bg-danger/5 disabled:pointer-events-none disabled:opacity-40";
export const INPUT =
  "h-11 w-full rounded-xl border border-line bg-raised px-3.5 outline-none placeholder:text-muted transition-colors focus:border-fg";

/** A quiet divider between two parts of a page: a hairline with a small violet diamond in the middle. */
export function Motif({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center gap-4 ${className}`}>
      <span className="h-px flex-1 bg-line" />
      <span className="size-1.5 rotate-45 bg-brand" />
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** A section heading: the serif, its key word in violet italic, on a hairline. Texts are translated here. */
export function SectionTitle({ title, accent, action }: { title: string; accent: string; action?: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="mb-8 flex items-end justify-between gap-4 border-b border-line pb-4">
      <h2 className="font-display text-3xl leading-none font-semibold tracking-tight sm:text-4xl">
        {t(title)} <span className="marker">{t(accent)}</span>
      </h2>
      {action}
    </div>
  );
}

/** The page's big title. Plain text is translated here; pass already-translated text when it has values in it. */
export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="mb-8">
      <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
        {typeof children === "string" ? t(children) : children}
      </h1>
      {sub && <p className="mt-2 text-muted">{typeof sub === "string" ? t(sub) : sub}</p>}
    </div>
  );
}

/** Gray box shown while something loads, like the placeholders in the mockup, with a light sweeping across. */
export function Skeleton({ className }: { className: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-sm bg-skeleton after:absolute after:inset-0 after:animate-shimmer after:bg-linear-to-r after:from-transparent after:via-white/60 dark:after:via-white/5 after:to-transparent ${className}`}
    />
  );
}

/** Fades its children up the first time they scroll into view. */
export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${visible ? "is-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function CardSkeletons({ count = 4 }: { count?: number }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i}>
      <Skeleton className="aspect-4/5 w-full rounded-2xl" />
      <Skeleton className="mt-3 h-4 w-2/3 rounded-full" />
      <Skeleton className="mt-2 h-3.5 w-1/3 rounded-full" />
    </div>
  ));
}

export function ProductImage({
  product,
  className = "",
}: {
  product: Pick<Product, "imageUrl" | "name"> & { hasImage?: boolean };
  className?: string;
}) {
  // The backend's gray "No image" picture would glow on a dark page; inverted it turns dark gray.
  const placeholder = product.hasImage === false ? "dark:invert dark:hue-rotate-180" : "";
  return (
    // Pictures come from the backend (any host), so a plain <img> instead of next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={api.assetUrl(product.imageUrl)}
      alt={product.name}
      loading="lazy"
      decoding="async"
      className={`bg-photo object-cover ${placeholder} ${className}`}
    />
  );
}

/** Average of the customer reviews and how many there are, or "No reviews" yet. */
/** `quiet`: show nothing at all when there are no reviews yet (on product cards, where it's only noise). */
export function Rating({ product, long = false, quiet = false }: { product: Pick<Product, "reviewsRating" | "reviewsCount">; long?: boolean; quiet?: boolean }) {
  const { t, tn } = useT();
  if (!product.reviewsCount || product.reviewsRating === null) {
    return quiet ? null : <span className="text-sm text-muted">{t("No reviews")}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted">
      <Icon name="star" filled className="size-4 text-amber-400" />
      <span className="font-semibold text-fg tabular-nums">{product.reviewsRating.toFixed(1)}</span>
      <span className="tabular-nums">{long ? `· ${tn(product.reviewsCount, "{n} review", "{n} reviews")}` : `(${product.reviewsCount})`}</span>
    </span>
  );
}

export function WishlistButton({ product, className = "" }: { product: Pick<Product, "id" | "name" | "imageUrl">; className?: string }) {
  const { t } = useT();
  const productId = product.id;
  const { wishlist, toggleWishlist } = useSession();
  const saved = wishlist.has(productId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault(); // inside a product link
        toggleWishlist(productId, product);
      }}
      aria-pressed={saved}
      aria-label={t(saved ? "Remove from wishlist" : "Add to wishlist")}
      className={`grid size-9 place-items-center rounded-full bg-raised/90 shadow-sm backdrop-blur transition hover:scale-110 active:scale-95 ${saved ? "text-tangerine" : "text-fg"} ${className}`}
    >
      {/* A new key on every change replays the little "pop". */}
      <span key={String(saved)} className={saved ? "animate-pop" : ""}>
        <Icon name="heart" filled={saved} className="size-5" />
      </span>
    </button>
  );
}

/** A product: the photo first and large, then its name, seller and price. `index` staggers a row's arrival. */
export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { t } = useT();
  return (
    <Link href={`/products/${product.id}`} className="group block animate-rise" style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}>
      <div className="relative overflow-hidden rounded-2xl bg-photo">
        <ProductImage product={product} className="aspect-4/5 w-full transition duration-700 ease-out group-hover:scale-[1.04]" />
        <WishlistButton product={product} className="absolute top-3 right-3" />
        {!product.inStock && (
          <span className="absolute top-3 left-3 rounded-full bg-raised/90 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-danger uppercase backdrop-blur">
            {t("Sold out")}
          </span>
        )}
      </div>
      {/* Phones: price under the name (two columns leave no room beside it). Wider: price on the right. */}
      <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium transition-colors group-hover:text-brand">{product.name}</p>
          <p className="truncate text-sm text-muted">
            {product.seller ? (product.seller.socialUsername ? `@${product.seller.socialUsername}` : product.seller.name) : "\u00a0"}
            {product.seller?.isAdmin && <AdminBadge className="ml-1 size-3.5" />}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 sm:block sm:text-right">
          <p className="text-[15px] font-semibold whitespace-nowrap tabular-nums">{formatPrice(product.price)}</p>
          <Rating product={product} quiet />
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products, loading, skeletons = 8 }: { products: Product[] | null; loading?: boolean; skeletons?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {products?.map((p, i) => <ProductCard key={p.id} product={p} index={i % 20} />)}
      {(loading || !products) && <CardSkeletons count={skeletons} />}
    </div>
  );
}

/** A row of cards with arrows on both sides, like "Best sales of the Day" in the mockup. */
export function Carousel({ products }: { products: Product[] | null }) {
  const { t } = useT();
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth, behavior: "smooth" });
  const arrow =
    "absolute top-[38%] hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-raised text-fg shadow-sm transition hover:border-fg active:scale-90 md:grid";
  return (
    // The arrows sit in the page's side padding, outside the cards (as in the mockup).
    <div className="relative md:-mx-11 md:px-11">
      <button type="button" onClick={() => scroll(-1)} aria-label={t("Previous")} className={`${arrow} left-0`}>
        <Icon name="arrowLeft" />
      </button>
      {/* py/-my give the hover lift and shadow room inside the scrolling row. */}
      <div ref={track} className="-my-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 py-4 [scrollbar-width:none] sm:gap-6">
        {(products ?? Array.from({ length: 5 }, () => null)).map((p, i) => (
          <div
            key={p?.id ?? i}
            className="w-[calc(50%-8px)] shrink-0 snap-start sm:w-[calc(50%-12px)] md:w-[calc(33.33%-16px)] lg:w-[calc(25%-18px)] 2xl:w-[calc(20%-19.2px)]"
          >
            {p ? <ProductCard product={p} index={i} /> : <CardSkeletons count={1} />}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => scroll(1)} aria-label={t("Next")} className={`${arrow} right-0`}>
        <Icon name="arrowRight" />
      </button>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-soft text-muted">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="mt-5 font-display text-2xl font-semibold tracking-tight">{t(title)}</p>
      {text && <p className="mt-1.5 max-w-sm text-muted">{t(text)}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Known messages (also from the backend, e.g. "Too many attempts…") are translated; others show as they are. */
export function ErrorBox({ message }: { message: string | null }) {
  const { t } = useT();
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 font-medium text-danger">
      {t(message)}
    </p>
  );
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  new: "bg-brand/10 text-brand",
  confirmed: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  shipped: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
  cancelled: "bg-soft text-muted",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useT();
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>{t(STATUS_LABELS[status])}</span>;
}

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  const { t } = useT();
  if (pages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label={t("Pages")}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={BUTTON_SECONDARY} aria-label={t("Previous page")}>
        <Icon name="arrowLeft" className="size-5" />
      </button>
      <span className="text-muted">
        {t("Page {page} of {pages}", { page, pages })}
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={BUTTON_SECONDARY} aria-label={t("Next page")}>
        <Icon name="arrowRight" className="size-5" />
      </button>
    </nav>
  );
}

/** Label + control, for the forms outside login/registration. */
/** Label + control. Label, hint and error are translated here (known backend errors too). */
export function FormRow({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{t(label)}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-danger">{t(error)}</span> : hint && <span className="mt-1 block text-sm text-muted">{t(hint)}</span>}
    </label>
  );
}
