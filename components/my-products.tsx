"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Product } from "@/lib/shoplink";
import { Icon } from "./icons";
import { useSession } from "./session";
import { BUTTON, ErrorBox, ProductImage, Rating, Skeleton } from "./ui";

const LIMIT = 100; // a seller's whole shelf in one go (the newest 100)
const LOW = 5; // "running low" from here down
const METER = 10; // squares in the stock meter
const SAVE_AFTER_MS = 700; // the stepper saves once the clicking stops

type Shelf = "all" | "live" | "low" | "out";
const SHELVES: { id: Shelf; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "On sale" },
  { id: "low", label: "Running low" },
  { id: "out", label: "Sold out" },
];
const onShelf = (p: Product, shelf: Shelf) =>
  shelf === "all" || (shelf === "live" ? p.stock > LOW : shelf === "low" ? p.stock > 0 && p.stock <= LOW : p.stock === 0);

// Dashed lines between the figures: two columns on phones, four from md up.
const SEPARATORS = ["pl-0", "border-l-2 border-dashed border-line", "pl-0 md:border-l-2 md:border-dashed md:border-line md:pl-5", "border-l-2 border-dashed border-line"];

/** The shop's numbers, written like a shopkeeper's ledger: big figures, handwritten labels, no boxes. */
function Ledger({ items, total }: { items: Product[]; total: number }) {
  const { t } = useT();
  const units = items.reduce((n, p) => n + p.stock, 0);
  const low = items.filter((p) => p.stock > 0 && p.stock <= LOW).length;
  const out = items.filter((p) => p.stock === 0).length;
  const figures = [
    { value: total, label: "products on your shelf", tone: "" },
    { value: units, label: "pieces in stock", tone: "" },
    { value: low, label: "running low", tone: low ? "text-tangerine" : "" },
    { value: out, label: "sold out", tone: out ? "text-danger" : "" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-y-8 border-y-2 border-dashed border-line py-7 md:grid-cols-4">
      {figures.map((f, i) => (
        <div key={f.label} className={`flex flex-col px-5 ${SEPARATORS[i]}`}>
          <dt className="order-2 mt-1 text-sm text-muted">{t(f.label)}</dt>
          <dd className={`font-display text-5xl leading-none font-semibold tabular-nums sm:text-6xl ${f.tone}`}>{f.value.toLocaleString("ru-RU")}</dd>
        </div>
      ))}
    </dl>
  );
}

/** How much is left, as a row of the shop's squares: one per piece, up to ten. */
function StockMeter({ stock }: { stock: number }) {
  const { t, tn } = useT();
  const filled = Math.min(stock, METER);
  const tone = stock === 0 ? "bg-danger/25" : stock <= LOW ? "bg-tangerine" : "bg-brand";
  return (
    <div className="mt-3 flex items-center gap-2" title={tn(stock, "{n} in stock", "{n} in stock")}>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: METER }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-3 rounded-full transition-colors duration-300 ${i < filled ? tone : "bg-line"}`}
          />
        ))}
      </div>
      <span className={`text-xs font-medium ${stock === 0 ? "text-danger" : stock <= LOW ? "text-tangerine" : "text-muted"}`}>
        {stock === 0 ? t("sold out") : stock > METER ? t("{n} left", { n: stock }) : tn(stock, "{n} left", "{n} left")}
      </span>
    </div>
  );
}

/** A product on the seller's shelf: photo with its stamp, price, stock meter, and the stock stepper that saves itself. */
function ShelfCard({ product, index, onStock }: { product: Product; index: number; onStock: (id: number, stock: number) => void }) {
  const { t } = useT();
  const { notify } = useSession();
  const [stock, setStock] = useState(product.stock);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const extras = product.images.length;

  useEffect(() => () => clearTimeout(timer.current), []);

  function change(next: number) {
    const value = Math.max(0, Math.min(99999, next));
    setStock(value);
    setState("idle");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (value === product.stock) return;
      setState("saving");
      try {
        const saved = await api.products.update(product.id, { stock: value });
        onStock(product.id, saved.stock);
        setState("saved");
        timer.current = setTimeout(() => setState("idle"), 1600);
      } catch (err) {
        setStock(product.stock);
        setState("idle");
        notify({ title: "Couldn't save the stock", text: t(errorMessage(err)) }, "error");
      }
    }, SAVE_AFTER_MS);
  }

  const stamp =
    stock === 0
      ? { text: "Sold out", className: "border-danger text-danger" }
      : stock <= LOW
        ? { text: "Low stock", className: "border-tangerine text-tangerine" }
        : null;

  return (
    <article className="group flex animate-rise flex-col" style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}>
      <Link href={`/products/${product.id}`} className="relative block overflow-hidden rounded-2xl bg-photo">
        <ProductImage product={product} className="aspect-4/5 w-full transition duration-500 group-hover:scale-[1.04]" />
        {stamp && (
          <span className={`absolute top-3 left-3 rounded-full bg-raised/90 px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase backdrop-blur ${stamp.className}`}>
            {t(stamp.text)}
          </span>
        )}
        {extras > 0 && (
          <span className="absolute right-2.5 bottom-2.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
            <Icon name="upload" className="size-3" />+{extras}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col px-1.5 pt-3">
        <Link href={`/products/${product.id}`} className="truncate font-medium hover:text-brand">
          {product.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="font-semibold whitespace-nowrap tabular-nums">{formatPrice(product.price)}</span>
          <Rating product={product} />
        </div>
        <StockMeter stock={stock} />

        <div className="mt-auto flex items-center gap-2 pt-4">
          <div className="flex h-10 items-center rounded-full border border-line" aria-label={t("Stock")}>
            <button type="button" onClick={() => change(stock - 1)} disabled={stock === 0} aria-label={t("One less")} className="grid h-full w-8 place-items-center hover:text-brand disabled:opacity-30">
              <Icon name="minus" className="size-4" />
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums">{stock}</span>
            <button type="button" onClick={() => change(stock + 1)} aria-label={t("One more")} className="grid h-full w-8 place-items-center hover:text-brand">
              <Icon name="plus" className="size-4" />
            </button>
          </div>
          <Link href={`/sell/${product.id}`} className={`${BUTTON} h-10 flex-1 px-3 text-sm`}>
            <Icon name="edit" className="size-4" /> {t("Edit")}
          </Link>
        </div>
        <p className="h-5 pt-1 text-xs text-muted" aria-live="polite">
          {state === "saving" ? t("Saving…") : state === "saved" ? <span className="text-emerald-700 dark:text-emerald-400">✓ {t("Stock saved")}</span> : ""}
        </p>
      </div>
    </article>
  );
}

/** The first spot on the shelf: a dashed, hand-drawn frame inviting the next product. */
function AddCard({ href }: { href: string }) {
  const { t } = useT();
  return (
    <Link
      href={href}
      className="group flex min-h-80 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-fg/25 p-6 text-center transition hover:border-fg/60 hover:bg-raised"
    >
      <span className="grid size-14 place-items-center rounded-full bg-fg text-surface transition duration-300 group-hover:bg-brand group-hover:text-white">
        <Icon name="plus" className="size-8" />
      </span>
      <span className="font-display text-2xl font-semibold">{t("Add something new")}</span>
      <span className="text-sm text-muted">{t("photos, price, sizes — about a minute")}</span>
    </Link>
  );
}

/** The products I sell: my numbers, the shelves, and every product with its stock right at hand. Used on /sell. */
export function MyProducts({ addHref }: { addHref: string }) {
  const { t } = useT();
  const [items, setItems] = useState<Product[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [shelf, setShelf] = useState<Shelf>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.products.mine({ limit: LIMIT, sort: "newest" }).then(
      (page) => {
        setItems(page.items);
        setTotal(page.total);
      },
      (err) => setError(errorMessage(err)),
    );
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!items) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-3/4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const term = search.trim().toLowerCase();
  const shown = items.filter((p) => onShelf(p, shelf) && (!term || p.name.toLowerCase().includes(term)));
  const updateStock = (id: number, stock: number) => setItems((all) => all && all.map((p) => (p.id === id ? { ...p, stock, inStock: stock > 0 } : p)));

  if (items.length === 0) {
    return (
      <div className="grid gap-10 md:grid-cols-[minmax(0,20rem)_1fr] md:items-center">
        <AddCard href={addHref} />
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-muted uppercase">{t("your shelf is waiting")}</p>
          <h2 className="mt-3 font-display text-4xl leading-tight font-semibold">{t("You're not selling anything yet")}</h2>
          <p className="mt-3 max-w-md text-muted">{t("Add a product with a picture, price, sizes and colors — it takes a minute.")}</p>
          <Link href={addHref} className={`${BUTTON} mt-6 h-12 px-6`}>
            <Icon name="plus" className="size-5" /> {t("Add your first product")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Ledger items={items} total={total} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 overflow-x-auto rounded-full bg-soft p-1 text-sm [scrollbar-width:none]" role="tablist" aria-label={t("Shelf")}>
          {SHELVES.map((s) => {
            const count = items.filter((p) => onShelf(p, s.id)).length;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={shelf === s.id}
                onClick={() => setShelf(s.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium whitespace-nowrap transition ${
                  shelf === s.id ? "bg-surface shadow-sm" : "text-muted hover:text-fg"
                }`}
              >
                {t(s.label)}
                <span className="text-xs text-muted tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
        <label className="relative w-full sm:w-64">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Find on your shelf…")}
            aria-label={t("Find on your shelf…")}
            className="h-10 w-full rounded-full border-2 border-line bg-raised pr-4 pl-9 text-sm outline-none placeholder:text-muted focus:border-fg [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {shelf === "all" && !term && <AddCard href={addHref} />}
        {shown.map((p, i) => (
          <ShelfCard key={p.id} product={p} index={i} onStock={updateStock} />
        ))}
      </div>
      {shown.length === 0 && (
        <p className="py-10 text-center text-muted">{t(term ? "Nothing on your shelf matches that." : "Nothing on this shelf right now.")}</p>
      )}
      {total > items.length && <p className="text-center text-sm text-muted">{t("Showing your newest {n} products.", { n: items.length })}</p>}
    </div>
  );
}
