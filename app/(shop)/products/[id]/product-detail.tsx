"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/options";
import { useT } from "@/lib/i18n";
import { ShoplinkError, type Product, type ProductSeller, type User } from "@/lib/shoplink";
import { Icon, type IconName } from "@/components/icons";
import { ColorDot } from "@/components/pickers";
import { Reviews } from "@/components/reviews";
import { useSession } from "@/components/session";
import { AdminBadge } from "@/components/admin-badge";
import { ReportButton } from "@/components/report";
import {
  BUTTON,
  BUTTON_SECONDARY,
  Carousel,
  EmptyState,
  ErrorBox,
  Motif,
  Rating,
  SectionTitle,
  Skeleton,
  WishlistButton,
} from "@/components/ui";

function OptionPicker({
  label,
  options,
  value,
  onChange,
  missing,
  swatches = false,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
  missing: boolean;
  /** Round colour swatches instead of size tiles (and translate the colour names). */
  swatches?: boolean;
}) {
  const { t } = useT();
  const name = (o: string) => (swatches || o === "One size" ? t(o) : o);
  return (
    <fieldset>
      <legend className="mb-3 flex items-baseline gap-2">
        <span className={`text-xs font-bold tracking-[0.18em] uppercase ${missing ? "text-danger" : "text-muted"}`}>{t(label)}</span>
        {value && <span className="text-sm font-medium text-fg capitalize">{name(value)}</span>}
        {missing && <span className="text-sm font-medium text-danger">{t("Pick one")}</span>}
      </legend>
      <div className="flex flex-wrap gap-2.5">
        {options.map((o) =>
          swatches ? (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              aria-pressed={value === o}
              aria-label={name(o)}
              title={name(o)}
              className={`grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-surface transition active:scale-90 ${
                value === o ? "ring-2 ring-fg" : missing ? "ring-2 ring-danger/60" : "ring-1 ring-line hover:ring-fg/60"
              }`}
            >
              <ColorDot name={o} className="size-9" />
            </button>
          ) : (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              aria-pressed={value === o}
              className={`inline-flex h-12 min-w-14 items-center justify-center rounded-xl border px-4 text-sm font-semibold uppercase transition duration-200 active:scale-95 ${
                value === o
                  ? "border-fg bg-fg text-surface"
                  : missing
                    ? "border-danger/70 text-danger"
                    : "border-line hover:-translate-y-0.5 hover:border-fg"
              }`}
            >
              {name(o)}
            </button>
          ),
        )}
      </div>
    </fieldset>
  );
}

/** All pictures of a product: the cover first, then the extra ones. */
const picturesOf = (p: Product) => (p.hasImage ? [p.imageUrl, ...p.images] : p.images.length ? p.images : [p.imageUrl]);

const ARROW = "grid size-10 place-items-center rounded-full bg-white/90 text-ink shadow-md transition hover:scale-105 hover:bg-white";

/** Full-screen view; ← → switch pictures, Escape or a click outside closes it. */
function PictureViewer({ urls, start, name, onClose }: { urls: string[]; start: number; name: string; onClose: () => void }) {
  const { t } = useT();
  const [i, setI] = useState(start);
  const many = urls.length > 1;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => (n + 1) % urls.length);
      if (e.key === "ArrowLeft") setI((n) => (n - 1 + urls.length) % urls.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, urls.length]);
  return (
    <div role="dialog" aria-modal aria-label={name} onClick={onClose} className="fixed inset-0 z-50 flex animate-drop flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between p-4 text-sm text-white/80">
        <span className="tabular-nums">{many && `${i + 1} / ${urls.length}`}</span>
        <button type="button" onClick={onClose} aria-label={t("Close")} className="grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
          <Icon name="close" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={i} src={api.assetUrl(urls[i])} alt={name} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full animate-drop rounded-lg object-contain shadow-2xl" />
        {many && (
          <>
            <button type="button" aria-label={t("Previous")} onClick={(e) => { e.stopPropagation(); setI((n) => (n - 1 + urls.length) % urls.length); }} className={`${ARROW} absolute left-4`}>
              <Icon name="arrowLeft" className="size-5" />
            </button>
            <button type="button" aria-label={t("Next")} onClick={(e) => { e.stopPropagation(); setI((n) => (n + 1) % urls.length); }} className={`${ARROW} absolute right-4`}>
              <Icon name="arrowRight" className="size-5" />
            </button>
          </>
        )}
      </div>
      {many && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-5" onClick={(e) => e.stopPropagation()}>
          {urls.map((u, n) => (
            <button key={u} type="button" onClick={() => setI(n)} aria-label={t("Picture {n}", { n: n + 1 })} className={`shrink-0 overflow-hidden rounded-md ring-2 transition ${n === i ? "ring-white" : "opacity-50 ring-transparent hover:opacity-100"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={api.assetUrl(u)} alt="" className="h-16 w-12 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The big picture, with the other pictures as thumbnails under it. */
function Gallery({ product, onOpen }: { product: Product; onOpen: (index: number) => void }) {
  const { t } = useT();
  const urls = picturesOf(product);
  const [i, setI] = useState(0);
  const current = Math.min(i, urls.length - 1);
  const many = urls.length > 1;
  const real = product.hasImage || product.images.length > 0;
  return (
    <div>
      <div>
        <div className="group relative overflow-hidden rounded-3xl bg-photo">
          <button type="button" onClick={() => real && onOpen(current)} aria-label={t("Open the picture")} className={`block w-full ${real ? "cursor-zoom-in" : "cursor-default"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current}
              src={api.assetUrl(urls[current])}
              alt={product.name}
              className={`bg-photo aspect-4/5 w-full animate-drop object-cover transition duration-700 group-hover:scale-[1.03] ${real ? "" : "dark:invert dark:hue-rotate-180"}`}
            />
          </button>
          <WishlistButton product={product} className="absolute top-4 right-4 size-11" />
          {many && (
            <>
              <button type="button" aria-label={t("Previous")} onClick={() => setI((current - 1 + urls.length) % urls.length)} className={`${ARROW} absolute top-1/2 left-3 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100`}>
                <Icon name="arrowLeft" className="size-5" />
              </button>
              <button type="button" aria-label={t("Next")} onClick={() => setI((current + 1) % urls.length)} className={`${ARROW} absolute top-1/2 right-3 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100`}>
                <Icon name="arrowRight" className="size-5" />
              </button>
            </>
          )}
          {real && (
            <span className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white tabular-nums">
              <Icon name="search" className="size-3.5" /> {many ? `${current + 1} / ${urls.length}` : t("Tap to enlarge")}
            </span>
          )}
        </div>
      </div>
      {many && (
        <div className="mt-4 flex gap-3 overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:none]">
          {urls.map((u, n) => (
            <button
              key={u}
              type="button"
              onClick={() => setI(n)}
              aria-label={t("Picture {n}", { n: n + 1 })}
              aria-current={n === current}
              className={`shrink-0 overflow-hidden rounded-xl ring-offset-2 ring-offset-surface transition duration-300 ${
                n === current ? "ring-2 ring-fg" : "opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={api.assetUrl(u)} alt="" className="bg-photo h-24 w-20 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "Sold by" chip at the top of the buy panel. Backends that send the seller with the product show their name and
 * @username to everyone. Older ones send only the id; then admins look the seller up and everyone else sees the number.
 */
function SellerChip({ sellerId, known }: { sellerId: number; known?: ProductSeller | null }) {
  const { t } = useT();
  const { user } = useSession();
  const [looked, setLooked] = useState<Pick<User, "name" | "socialUsername" | "avatarUrl"> | null>(null);
  const isMe = user?.id === sellerId;

  useEffect(() => {
    if (known || !user || isMe || user.role !== "admin") return;
    api.users.get(sellerId).then(setLooked, () => setLooked(null));
  }, [known, user, isMe, sellerId]);

  const shown = isMe ? user : (known ?? looked);
  return (
    <Link href={`/products?sellerId=${sellerId}`} className="group inline-flex max-w-full items-center gap-2.5 rounded-full border border-line bg-raised py-1 pr-4 pl-1 transition hover:border-fg">
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={api.assetUrl(shown.avatarUrl)} alt="" className="size-8 rounded-full object-cover" />
      ) : (
        <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand">
          <Icon name="tag" className="size-4" />
        </span>
      )}
      <span className="min-w-0 truncate text-sm">
        <span className="text-muted">{t("sold by")} </span>
        <span className="font-semibold group-hover:text-brand">
          {shown ? (shown.socialUsername ? `@${shown.socialUsername}` : shown.name) : t("Seller #{id}", { id: sellerId })}
        </span>
        {(isMe ? user?.role === "admin" : known?.isAdmin) && <AdminBadge className="ml-1 size-4" />}
        {isMe && <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-semibold text-brand">{t("You")}</span>}
      </span>
      <Icon name="arrowRight" className="size-3.5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
    </Link>
  );
}

/** The price: large and plain, nothing in its way. */
function PriceTag({ price }: { price: number }) {
  return <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-[2.1rem]">{formatPrice(price)}</p>;
}

const PROMISES: { icon: IconName; text: string }[] = [
  { icon: "box", text: "Every order gets its own number" },
  { icon: "truck", text: "Follow it from New to Delivered" },
  { icon: "chat", text: "Order from Instagram, TikTok & Telegram" },
];

export function ProductDetail({ id }: { id: number }) {
  const { t, tn, locale } = useT();
  const router = useRouter();
  const { user, addToCart, wishlist, toggleWishlist } = useSession();
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showMissing, setShowMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState<Product[] | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const validId = Number.isInteger(id) && id > 0;

  useEffect(() => {
    if (!validId) return;
    api.products.get(id).then(
      (p) => {
        setProduct(p);
        // One option only: pick it for the customer.
        if (p.sizes.length === 1) setSize(p.sizes[0]);
        if (p.colors.length === 1) setColor(p.colors[0]);
        const others = p.sellerId ? { sellerId: p.sellerId } : { sort: "newest" as const };
        api.products.list({ ...others, inStock: true, limit: 12 }).then(
          (page) => setMore(page.items.filter((x) => x.id !== p.id)),
          () => setMore([]),
        );
      },
      (err) => (err instanceof ShoplinkError && err.status === 404 ? setNotFound(true) : setError(err.message)),
    );
  }, [id, validId]);

  if (!validId || notFound) {
    return (
      <EmptyState
        icon="search"
        title="Product not found"
        text="It may have been removed by its seller."
        action={
          <Link href="/products" className={BUTTON}>
            {t("Back to products")}
          </Link>
        }
      />
    );
  }
  if (error) return <ErrorBox message={error} />;
  if (!product) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-3/4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const needsSize = product.sizes.length > 0 && !size;
  const needsColor = product.colors.length > 0 && !color;
  const canEdit = user && (user.id === product.sellerId || user.role === "admin");
  // You can't buy what you sell; you can still keep it in your wishlist.
  const isMine = Boolean(user && product.sellerId === user.id);
  const saved = wishlist.has(product.id);

  async function add(thenCheckout: boolean) {
    if (needsSize || needsColor) return setShowMissing(true);
    setBusy(true);
    const ok = await addToCart({ productId: id, quantity, size: size ?? undefined, color: color ?? undefined, product: product ?? undefined });
    setBusy(false);
    if (ok && thenCheckout) router.push("/cart");
  }

  const lowStock = product.inStock && product.stock <= 5;

  return (
    <>
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/products" className="hover:text-brand">
          {t("Products")}
        </Link>
        <Icon name="arrowRight" className="size-3" />
        {product.category !== "other" && (
          <>
            <Link href={`/products?category=${product.category}`} className="hover:text-brand">
              {t(CATEGORY_LABELS[product.category])}
            </Link>
            <Icon name="arrowRight" className="size-3" />
          </>
        )}
        <span className="truncate text-fg">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Gallery product={product} onOpen={setViewing} />
        </div>

        <div className="pb-24 md:pb-0">
          {product.sellerId && <SellerChip sellerId={product.sellerId} known={product.seller} />}

          <h1 className="mt-6 font-display text-5xl leading-[1] font-semibold tracking-tight break-words sm:text-6xl">{product.name}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href="#reviews" className="hover:underline">
              <Rating product={product} long />
            </a>
            <span
              className={`inline-flex items-center gap-2 text-sm font-semibold ${
                !product.inStock ? "text-danger" : lowStock ? "text-tangerine" : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              <span className={`size-2 rounded-full bg-current ${product.inStock ? "animate-pulse" : ""}`} />
              {!product.inStock ? t("Sold out") : lowStock ? t("Only {n} left!", { n: product.stock }) : tn(product.stock, "{n} in stock", "{n} in stock")}
            </span>
          </div>

          <div className="mt-8">
            <PriceTag price={product.price} />
          </div>

          <div className="mt-10 space-y-8">
            {product.sizes.length > 0 && (
              <OptionPicker label="Size" options={product.sizes} value={size} onChange={setSize} missing={showMissing && needsSize} />
            )}
            {product.colors.length > 0 && (
              <OptionPicker swatches label="Color" options={product.colors} value={color} onChange={setColor} missing={showMissing && needsColor} />
            )}
          </div>

          {isMine ? (
            <div className="mt-10 rounded-2xl border border-line bg-raised p-6">
              <p className="flex items-center gap-2 font-semibold">
                <Icon name="tag" className="size-5 text-brand" /> {t("This is your product")}
              </p>
              <p className="mt-1.5 text-sm text-muted">{t("You can't buy your own product, but you can save it to your wishlist.")}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/sell/${product.id}`} className={`${BUTTON} h-12 flex-1`}>
                  <Icon name="edit" className="size-4" /> {t("Edit this product")}
                </Link>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id, product)}
                  aria-pressed={saved}
                  className={`${BUTTON_SECONDARY} h-12 flex-1 ${saved ? "text-tangerine" : ""}`}
                >
                  <Icon name="heart" filled={saved} className="size-5" /> {t(saved ? "In your wishlist" : "Add to wishlist")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-10 space-y-3">
              <div className="flex gap-3">
                {product.inStock && (
                  <div className="flex h-14 shrink-0 items-center rounded-full border border-line bg-raised px-1">
                    <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label={t("Less")} className="grid h-full w-11 place-items-center hover:text-brand">
                      <Icon name="minus" className="size-5" />
                    </button>
                    <span className="w-8 text-center font-semibold tabular-nums">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                      aria-label={t("More")}
                      className="grid h-full w-11 place-items-center hover:text-brand"
                    >
                      <Icon name="plus" className="size-5" />
                    </button>
                  </div>
                )}
                <button type="button" disabled={!product.inStock || busy} onClick={() => add(false)} className={`${BUTTON} h-14 min-w-0 flex-1 text-base`}>
                  <Icon name="cart" className="size-5 shrink-0" />
                  <span className="truncate">
                    {t("Add to cart")}
                    <span className="hidden opacity-70 sm:inline"> · {formatPrice(product.price * quantity)}</span>
                  </span>
                </button>
              </div>
              <div className="flex gap-3">
                <button type="button" disabled={!product.inStock || busy} onClick={() => add(true)} className={`${BUTTON_SECONDARY} h-12 flex-1`}>
                  {t("Buy now")} <Icon name="arrowRight" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id, product)}
                  aria-pressed={saved}
                  aria-label={t(saved ? "Remove from wishlist" : "Add to wishlist")}
                  className={`grid size-12 shrink-0 place-items-center rounded-full border border-line bg-raised transition hover:border-fg ${saved ? "text-tangerine" : ""}`}
                >
                  <Icon name="heart" filled={saved} className="size-5" />
                </button>
              </div>
            </div>
          )}
          {canEdit && !isMine && (
            <Link href={`/sell/${product.id}`} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline">
              <Icon name="edit" className="size-4" /> {t("Edit this product")}
            </Link>
          )}

          {/* What every order comes with */}
          <ul className="mt-10 grid gap-4 border-y border-line py-6 sm:grid-cols-3">
            {PROMISES.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm leading-snug sm:flex-col sm:items-start sm:gap-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-soft text-fg">
                  <Icon name={p.icon} className="size-5" />
                </span>
                {t(p.text)}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <ReportButton product={product} />
          </div>

          {/* About the piece, and its details like a shop receipt */}
          <div className="mt-10">
            <h2 className="font-display text-3xl font-semibold tracking-tight">{t("About this piece")}</h2>
            {product.description && <p className="mt-3 text-[17px] leading-relaxed whitespace-pre-line">{product.description}</p>}
            <dl className="mt-6 space-y-2.5 text-sm">
              {[
                product.category !== "other" && { label: "Category", value: t(CATEGORY_LABELS[product.category]) },
                product.sizes.length > 0 && { label: "Sizes", value: product.sizes.join(" · ") },
                product.colors.length > 0 && { label: "Colors", value: product.colors.map((c) => t(c)).join(" · ") },
                { label: "Added", value: formatDate(product.createdAt, locale) },
              ]
                .filter((row): row is { label: string; value: string } => Boolean(row))
                .map((row) => (
                  <div key={row.label} className="flex items-baseline gap-3">
                    <dt className="text-muted">{t(row.label)}</dt>
                    <span className="min-w-6 flex-1 border-b border-dotted border-line" aria-hidden />
                    <dd className="font-medium capitalize">{row.value}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Phones: the price and the button stay in reach while scrolling */}
      {!isMine && product.inStock && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden print:hidden">
          <span className="min-w-0 flex-1 truncate text-lg font-semibold tabular-nums">{formatPrice(product.price * quantity)}</span>
          <button type="button" disabled={busy} onClick={() => add(false)} className={`${BUTTON} h-11 px-5`}>
            <Icon name="cart" className="size-5" /> {t("Add to cart")}
          </button>
        </div>
      )}

      <div className="mt-20">
        <Motif />
      </div>

      {/* Refreshes the product after a review so its average and count are up to date. */}
      <Reviews product={product} onChanged={() => api.products.get(product.id).then(setProduct, () => {})} />

      {more && more.length > 0 && (
        <section className="mt-20">
          <SectionTitle title={product.sellerId ? "More from this" : "You may also"} accent={product.sellerId ? "Seller" : "Like"} />
          <Carousel products={more} />
        </section>
      )}

      {viewing !== null && <PictureViewer urls={picturesOf(product)} start={viewing} name={product.name} onClose={() => setViewing(null)} />}
    </>
  );
}
