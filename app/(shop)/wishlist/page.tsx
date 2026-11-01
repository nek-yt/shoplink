"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, AUTH_EVENT } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatPrice, timeAgo } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Product, WishlistItem } from "@/lib/shoplink";
import { useConfirm } from "@/components/dialog";
import { Icon } from "@/components/icons";
import { ColorDot } from "@/components/pickers";
import { useRequireLogin, useSession } from "@/components/session";
import { BUTTON, BUTTON_SECONDARY, ErrorBox, ProductGrid, ProductImage, SectionTitle, Skeleton } from "@/components/ui";

const LIMIT = 100; // the whole wishlist at once (the backend's largest page)
const LOW = 5;
type Sort = "recent" | "price_asc" | "price_desc";
const SORTS: { id: Sort; label: string }[] = [
  { id: "recent", label: "Recently saved" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
];

/** The size and color chosen for one saved product. A single option is chosen from the start. */
type Choice = { size?: string; color?: string };
const firstChoice = (p: Product): Choice => ({
  size: p.sizes.length === 1 ? p.sizes[0] : undefined,
  color: p.colors.length === 1 ? p.colors[0] : undefined,
});
/** What's still missing before it can go to the cart. */
const missingOf = (p: Product, c: Choice) => ({ size: p.sizes.length > 0 && !c.size, color: p.colors.length > 0 && !c.color });
const isComplete = (p: Product, c: Choice) => {
  const m = missingOf(p, c);
  return !m.size && !m.color;
};

function Checkbox({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <label
      className={`grid size-6 shrink-0 place-items-center rounded-md border transition ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"} ${checked ? "border-fg bg-fg text-surface" : "border-line bg-raised hover:border-fg"}`}
    >
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="sr-only" aria-label={label} />
      {checked && <Icon name="check" className="size-4" />}
    </label>
  );
}

function SavedRow({
  item,
  choice,
  onChoose,
  selected,
  onSelect,
  canBuy,
  flagged,
  busy,
  onAdd,
  onRemove,
}: {
  item: WishlistItem;
  choice: Choice;
  onChoose: (choice: Choice) => void;
  selected: boolean;
  onSelect: () => void;
  /** In stock and not the viewer's own product. */
  canBuy: boolean;
  /** Was sent to the cart without its size or color: show what's missing. */
  flagged: boolean;
  busy: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { t, locale } = useT();
  const p = item.product;
  const low = p.inStock && p.stock <= LOW;
  const missing = missingOf(p, choice);
  const warn = flagged && (missing.size || missing.color);

  return (
    <li className={`flex animate-rise gap-4 py-6 transition-colors sm:gap-6 ${warn ? "rounded-2xl bg-danger/5 px-3 sm:px-4" : "first:pt-0"}`}>
      <div className="pt-1">
        <Checkbox checked={selected} disabled={!canBuy} onChange={onSelect} label={t("Select {name}", { name: p.name })} />
      </div>

      <Link href={`/products/${p.id}`} className={`group shrink-0 self-start overflow-hidden rounded-2xl bg-photo ${canBuy ? "" : "opacity-70"}`}>
        <ProductImage product={p} className="aspect-4/5 w-24 transition duration-700 group-hover:scale-[1.04] sm:w-32" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href={`/products/${p.id}`} className="block font-display text-2xl leading-tight font-semibold hover:text-brand">
              {p.name}
            </Link>
            <p className="mt-1 text-sm text-muted">
              {p.seller && <>{p.seller.socialUsername ? `@${p.seller.socialUsername}` : p.seller.name} · </>}
              {t("saved {when}", { when: timeAgo(item.createdAt, locale) })}
            </p>
          </div>
          <p className="shrink-0 text-lg font-semibold tabular-nums">{formatPrice(p.price)}</p>
        </div>

        <p className={`mt-2 flex items-center gap-2 text-sm font-medium ${!p.inStock ? "text-danger" : low ? "text-tangerine" : "text-emerald-700 dark:text-emerald-400"}`}>
          <span className="size-1.5 rounded-full bg-current" />
          {!p.inStock ? t("Sold out") : low ? t("Only {n} left!", { n: p.stock }) : t("In stock")}
        </p>

        {/* Size and color right in the row, so several pieces can go to the cart at once */}
        {canBuy && (p.sizes.length > 1 || p.colors.length > 1) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
            {p.sizes.length > 1 && (
              <label className="flex items-center gap-2 text-sm">
                <span className={flagged && missing.size ? "font-medium text-danger" : "text-muted"}>{t("Size")}</span>
                <select
                  value={choice.size ?? ""}
                  onChange={(e) => onChoose({ ...choice, size: e.target.value || undefined })}
                  className={`h-9 rounded-full border bg-raised px-3 text-sm font-medium outline-none focus:border-fg ${flagged && missing.size ? "border-danger" : "border-line"}`}
                >
                  <option value="">{t("Choose")}</option>
                  {p.sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {p.colors.length > 1 && (
              <div className="flex items-center gap-2 text-sm" role="radiogroup" aria-label={t("Color")}>
                <span className={flagged && missing.color ? "font-medium text-danger" : "text-muted"}>{t("Color")}</span>
                {p.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={choice.color === c}
                    aria-label={t(c)}
                    title={t(c)}
                    onClick={() => onChoose({ ...choice, color: c })}
                    className={`grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-surface transition ${choice.color === c ? "ring-2 ring-fg" : flagged && missing.color ? "ring-1 ring-danger" : "ring-1 ring-line hover:ring-fg/50"}`}
                  >
                    <ColorDot name={c} className="size-6" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {warn && <p className="mt-2 text-sm font-medium text-danger">{t(missing.size ? "Pick a size first" : "Pick a color first")}</p>}

        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-4">
          {canBuy ? (
            <button type="button" disabled={busy} onClick={onAdd} className={`${BUTTON} h-10 px-5 text-sm`}>
              <Icon name="cart" className="size-4" /> {t("Add to cart")}
            </button>
          ) : !p.inStock ? (
            <Link href={`/products?category=${p.category}`} className={`${BUTTON_SECONDARY} h-10 px-5 text-sm`}>
              {t("Find something similar")}
            </Link>
          ) : (
            <span className="text-sm text-muted">{t("This is your product")}</span>
          )}
          <button type="button" onClick={onRemove} className="text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline">
            {t("Remove")}
          </button>
        </div>
      </div>
    </li>
  );
}

export default function WishlistPage() {
  const { t, tn } = useT();
  const user = useRequireLogin();
  const { wishlist, unseen, markSeen, toggleWishlist, addManyToCart, notify } = useSession();
  const confirm = useConfirm();
  // Being on this page means the new items have been seen: the red badge goes away.
  useEffect(() => {
    if (unseen.wishlist) markSeen("wishlist");
  }, [unseen.wishlist, markSeen]);

  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState<Product[] | null>(null);
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [flagged, setFlagged] = useState<ReadonlySet<number>>(new Set());

  // Reloads when a heart is toggled anywhere (the set of saved ids changes).
  useEffect(() => {
    if (!user) return;
    api.wishlist.list({ limit: LIMIT }).then(
      (page) => setItems(page.items),
      (err) => setError(errorMessage(err)),
    );
  }, [user, wishlist]);

  // Empty wishlist: a few new things to start with.
  const empty = items?.length === 0;
  useEffect(() => {
    if (!empty) return;
    api.products.list({ sort: "newest", inStock: true, limit: 4 }).then((p) => setIdeas(p.items), () => setIdeas([]));
  }, [empty]);

  const canBuy = (i: WishlistItem) => i.product.inStock && i.product.sellerId !== user?.id;
  const choiceOf = (i: WishlistItem) => choices[i.id] ?? firstChoice(i.product);
  const shown = items
    ? [...items].sort((a, b) =>
        sort === "price_asc" ? a.product.price - b.product.price : sort === "price_desc" ? b.product.price - a.product.price : b.createdAt.localeCompare(a.createdAt),
      )
    : null;
  const buyable = shown?.filter(canBuy) ?? [];
  // Selections of pieces that left the list (removed, sold out) don't count.
  const chosen = buyable.filter((i) => selected.has(i.id));
  const allChosen = buyable.length > 0 && chosen.length === buyable.length;
  const worth = buyable.reduce((sum, i) => sum + i.product.price, 0);
  const chosenWorth = chosen.reduce((sum, i) => sum + i.product.price, 0);

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function choose(item: WishlistItem, choice: Choice) {
    setChoices((all) => ({ ...all, [item.id]: choice }));
    if (isComplete(item.product, choice)) setFlagged((f) => new Set([...f].filter((id) => id !== item.id)));
  }

  function remove(item: WishlistItem) {
    setItems((all) => all && all.filter((i) => i.id !== item.id));
    toggleWishlist(item.productId, item.product);
  }

  /** Puts these pieces in the cart with their chosen size and color; the ones still missing a choice are flagged instead. */
  async function add(list: WishlistItem[]) {
    const incomplete = list.filter((i) => !isComplete(i.product, choiceOf(i)));
    const ready = list.filter((i) => isComplete(i.product, choiceOf(i)));
    setFlagged(new Set(incomplete.map((i) => i.id)));
    if (incomplete.length) {
      notify(
        {
          title: tn(incomplete.length, "{n} piece needs a size or color", "{n} pieces need a size or color"),
          text: ready.length ? "The rest went to the cart." : "Choose them in the list, then add again.",
        },
        "info",
      );
    }
    if (!ready.length) return;
    setBusy(true);
    const { added } = await addManyToCart(
      ready.map((i) => ({ productId: i.productId, quantity: 1, ...choiceOf(i) })),
      "wishlist",
    );
    if (added) setSelected((s) => new Set([...s].filter((id) => !ready.some((i) => i.id === id))));
    setBusy(false);
  }

  async function clearAll() {
    const yes = await confirm({
      title: "Clear your wishlist?",
      text: "Everything you saved will be removed from it. The products stay in the shop.",
      confirmLabel: "Clear wishlist",
      danger: true,
      icon: "heart",
    });
    if (!yes) return;
    try {
      await api.wishlist.clear();
      setItems([]);
      notify({ title: "Wishlist cleared", kind: "info" });
      // Lets the hearts across the shop catch up.
      window.dispatchEvent(new Event(AUTH_EVENT));
    } catch (err) {
      notify({ title: "Couldn't clear the wishlist", text: t(errorMessage(err)) }, "error");
    }
  }

  return (
    <>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
        <div>
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-muted uppercase">
            <span className="h-px w-10 bg-fg/40" />
            {t("Saved for later")}
          </p>
          <h1 className="mt-4 font-display text-5xl leading-none font-semibold sm:text-6xl">
            <span className="marker">{t("Wishlist")}</span>
          </h1>
          {items && items.length > 0 && (
            <p className="mt-3 text-muted">
              {tn(items.length, "{n} piece", "{n} pieces")} · {tn(buyable.length, "{n} in stock", "{n} in stock")} · {formatPrice(worth)}
            </p>
          )}
        </div>
        {items && items.length > 1 && (
          <div className="flex rounded-full bg-soft p-1 text-sm" role="tablist" aria-label={t("Sort by")}>
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={sort === s.id}
                onClick={() => setSort(s.id)}
                className={`rounded-full px-3.5 py-1.5 font-medium whitespace-nowrap transition ${sort === s.id ? "bg-surface shadow-sm" : "text-muted hover:text-fg"}`}
              >
                {t(s.label)}
              </button>
            ))}
          </div>
        )}
      </header>

      <ErrorBox message={error} />

      {!shown ? (
        <div className="space-y-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-6">
              <Skeleton className="aspect-4/5 w-32 rounded-2xl" />
              <div className="flex-1 space-y-3 pt-2">
                <Skeleton className="h-6 w-1/2 rounded-full" />
                <Skeleton className="h-4 w-1/3 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <>
          <section className="flex flex-col items-center py-12 text-center">
            <span className="grid size-20 place-items-center rounded-full bg-soft text-tangerine">
              <Icon name="heart" filled className="size-9" />
            </span>
            <h2 className="mt-6 font-display text-4xl font-semibold">{t("Nothing saved yet")}</h2>
            <p className="mt-2 max-w-sm text-muted">{t("Tap the heart on any product to keep it here — and come back when you're ready.")}</p>
            <Link href="/products" className={`${BUTTON} mt-8 h-12 px-8`}>
              {t("Browse products")} <Icon name="arrowRight" className="size-4" />
            </Link>
          </section>
          {ideas && ideas.length > 0 && (
            <section className="mt-12">
              <SectionTitle title="To get you" accent="started" />
              <ProductGrid products={ideas} />
            </section>
          )}
        </>
      ) : (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <div>
            {buyable.length > 0 && (
              <div className="mb-6 flex items-center gap-3 border-b border-line pb-4 text-sm font-medium">
                <Checkbox
                  checked={allChosen}
                  onChange={() => setSelected(allChosen ? new Set() : new Set(buyable.map((i) => i.id)))}
                  label={t("Select all")}
                />
                <span>{t("Select all")}</span>
                {chosen.length > 0 && <span className="text-muted">· {tn(chosen.length, "{n} selected", "{n} selected")}</span>}
              </div>
            )}
            <ul className="divide-y divide-line">
              {shown.map((item) => (
                <SavedRow
                  key={item.id}
                  item={item}
                  choice={choiceOf(item)}
                  onChoose={(c) => choose(item, c)}
                  selected={selected.has(item.id) && canBuy(item)}
                  onSelect={() => toggle(item.id)}
                  canBuy={canBuy(item)}
                  flagged={flagged.has(item.id)}
                  busy={busy}
                  onAdd={() => add([item])}
                  onRemove={() => remove(item)}
                />
              ))}
            </ul>
          </div>

          <aside className="h-fit rounded-3xl border border-line bg-raised p-7 lg:sticky lg:top-24">
            <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">{t("Your wishlist")}</p>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{t("Saved pieces")}</dt>
                <dd className="font-medium tabular-nums">{items?.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t("Selected")}</dt>
                <dd className="font-medium tabular-nums">
                  {chosen.length} / {buyable.length}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-4">
                <dt className="font-medium">{t(chosen.length ? "Selected total" : "Worth")}</dt>
                <dd className="text-2xl font-semibold tracking-tight tabular-nums">{formatPrice(chosen.length ? chosenWorth : worth)}</dd>
              </div>
            </dl>
            <button type="button" onClick={() => add(chosen)} disabled={busy || chosen.length === 0} className={`${BUTTON} mt-6 h-12 w-full`}>
              <Icon name="cart" className="size-4" />
              {chosen.length ? tn(chosen.length, "Add {n} selected to cart", "Add {n} selected to cart") : t("Select pieces to add")}
            </button>
            {buyable.length > 0 && (
              <button type="button" onClick={() => add(buyable)} disabled={busy} className={`${BUTTON_SECONDARY} mt-3 h-11 w-full`}>
                {tn(buyable.length, "Add all {n} to cart", "Add all {n} to cart")}
              </button>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted">{t("Sizes and colors chosen in the list go to the cart with each piece. Pieces stay saved here.")}</p>
            <Link href="/products" className="mt-5 block text-center text-sm font-medium underline-offset-4 hover:underline">
              {t("Continue shopping")}
            </Link>
            <button type="button" onClick={clearAll} className="mt-3 w-full text-center text-sm text-muted underline-offset-4 hover:text-danger hover:underline">
              {t("Clear wishlist")}
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
