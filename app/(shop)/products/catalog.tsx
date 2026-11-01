"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { CATEGORIES, type Page, type Product, type ProductQuery, type ProductSort } from "@/lib/shoplink";
import { useT } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { CATEGORY_LABELS, COLORS } from "@/lib/options";
import { Icon } from "@/components/icons";
import { ColorDot } from "@/components/pickers";
import { BUTTON, BUTTON_SECONDARY, EmptyState, ErrorBox, Motif, PageTitle, ProductGrid } from "@/components/ui";

const SORTS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name_asc", label: "Name A–Z" },
];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const PAGE_SIZE = 20; // one batch; the next one loads as you scroll near the end
const LOAD_AHEAD = "600px"; // start fetching the next batch this far before the bottom shows
const SEARCH_DELAY_MS = 400; // search while typing, but not on every key

const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);
// Color names (and their translations) are stored lowercase: "black" → "Black".
const capital = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

function readQuery(params: URLSearchParams): ProductQuery {
  return {
    search: params.get("search") ?? undefined,
    sort: (SORTS.find((s) => s.value === params.get("sort"))?.value ?? "newest") as ProductSort,
    minPrice: num(params.get("minPrice")),
    maxPrice: num(params.get("maxPrice")),
    size: params.get("size") ?? undefined,
    category: CATEGORIES.find((c) => c === params.get("category")),
    color: params.get("color") ?? undefined,
    inStock: params.get("inStock") === "true" ? true : undefined,
    sellerId: num(params.get("sellerId")),
    page: 1,
    limit: PAGE_SIZE,
  };
}

/** "100 000 – 250 000 сум", "from 100 000 сум"…, or undefined when no price filter is set. */
function priceLabel(min: number | undefined, max: number | undefined, t: ReturnType<typeof useT>["t"]) {
  if (min !== undefined && max !== undefined) return `${min.toLocaleString("ru-RU")} – ${formatPrice(max)}`;
  if (min !== undefined) return t("from {price}", { price: formatPrice(min) });
  if (max !== undefined) return t("up to {price}", { price: formatPrice(max) });
  return undefined;
}

/** Open/close state for a popover that closes on a click outside it or on Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return [open, setOpen, box] as const;
}

const TRIGGER =
  "flex h-11 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-soft";

/** One filter inside the Filters menu: a row that shows the current choice and folds open to change it. */
function FilterSection({
  title,
  value,
  open,
  onToggle,
  children,
}: {
  title: string;
  value?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="border-b border-line last:border-b-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-soft">
        <span className="font-semibold">{t(title)}</span>
        <span className={`ml-auto truncate text-sm ${value ? "font-medium text-brand" : "text-muted"}`}>{value ?? t("Any")}</span>
        <Icon name="chevronDown" className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="animate-drop px-4 pb-4">{children}</div>}
    </div>
  );
}

export function Catalog() {
  const { t, tn } = useT();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = readQuery(params);
  const queryKey = params.toString();

  // The answer remembers which filters it was for, so a new search shows loading boxes instead of old results.
  const [loaded, setLoaded] = useState<{ key: string; result?: Page<Product>; error?: string } | null>(null);
  const result = loaded?.key === queryKey ? (loaded.result ?? null) : null;
  const error = loaded?.key === queryKey ? (loaded.error ?? null) : null;

  const [filtersOpen, setFiltersOpen, filtersBox] = usePopover();
  const [sortOpen, setSortOpen, sortBox] = usePopover();
  const [section, setSection] = useState<string | null>("Category");

  // What's typed in the search box, and the URL search it was typed over (`base`). While the URL still has that
  // search, or has caught up with the typing, the box keeps the typing (spaces included); when the search changes
  // from somewhere else (the top bar), the box shows that instead.
  const [draft, setDraft] = useState<{ base?: string; value: string }>({ base: query.search, value: query.search ?? "" });
  const searchText =
    draft.base === query.search || (draft.value.trim() || undefined) === query.search ? draft.value : (query.search ?? "");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    api.products.list(readQuery(new URLSearchParams(queryKey))).then(
      (page) => setLoaded({ key: queryKey, result: page }),
      (err: Error) => setLoaded({ key: queryKey, error: err.message }),
    );
  }, [queryKey]);

  // Endless scrolling: when the marker under the grid comes near the screen, the next batch is added.
  const [loadingMore, setLoadingMore] = useState(false);
  const busy = useRef(false); // no second request for the same batch while one is on its way
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = Boolean(result && result.page < result.pages);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || !result) return;
    const nextPage = result.page + 1;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || busy.current) return;
        busy.current = true;
        setLoadingMore(true);
        try {
          const next = await api.products.list({ ...readQuery(new URLSearchParams(queryKey)), page: nextPage });
          setLoaded((prev) =>
            prev?.key === queryKey && prev.result ? { key: queryKey, result: { ...next, items: [...prev.result.items, ...next.items] } } : prev,
          );
        } catch (err) {
          setLoaded((prev) => (prev?.key === queryKey ? { ...prev, error: errorMessage(err) } : prev));
        }
        busy.current = false;
        setLoadingMore(false);
      },
      { rootMargin: `0px 0px ${LOAD_AHEAD} 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, result, queryKey]);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  // The filter icon in the top bar links to /products#filters: open the menu for it.
  useEffect(() => {
    const check = () => {
      if (location.hash !== "#filters") return;
      setFiltersOpen(true);
      history.replaceState(history.state, "", location.pathname + location.search);
    };
    const first = setTimeout(check, 0);
    window.addEventListener("hashchange", check);
    return () => {
      clearTimeout(first);
      window.removeEventListener("hashchange", check);
    };
  }, [setFiltersOpen]);

  /** Changes some filters in the URL; any change goes back to page 1. */
  function update(changes: Record<string, string | undefined>, keepPage = false) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!keepPage) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: keepPage });
  }

  function search(value: string, now = false) {
    const term = value.trim() || undefined;
    setDraft({ base: query.search, value });
    clearTimeout(searchTimer.current);
    if (term === query.search) return;
    if (now) update({ search: term });
    else searchTimer.current = setTimeout(() => update({ search: term }), SEARCH_DELAY_MS);
  }

  function clearAll() {
    clearTimeout(searchTimer.current);
    setDraft({ value: "" });
    router.replace(query.sort === "newest" ? pathname : `${pathname}?sort=${query.sort}`);
  }

  const price = priceLabel(query.minPrice, query.maxPrice, t);
  // One seller's products: their name comes with any of them (if the backend sends it), else their number.
  const seller = query.sellerId ? result?.items.find((p) => p.seller)?.seller : undefined;
  const sellerLabel = seller
    ? seller.socialUsername
      ? `@${seller.socialUsername}`
      : seller.name
    : t("Seller #{id}", { id: String(query.sellerId) });
  // What is switched on, and which URL keys its × clears.
  const chips = [
    query.search && { key: "search", label: `“${query.search}”`, clears: ["search"] },
    price && { key: "price", label: price, clears: ["minPrice", "maxPrice"] },
    query.category && { key: "category", label: t(CATEGORY_LABELS[query.category]), clears: ["category"] },
    query.size && { key: "size", label: `${t("Size")}: ${query.size}`, clears: ["size"] },
    query.color && { key: "color", label: capital(t(query.color)), dot: query.color, clears: ["color"] },
    query.inStock && { key: "inStock", label: t("In stock only"), clears: ["inStock"] },
    query.sellerId && { key: "seller", label: sellerLabel, clears: ["sellerId"] },
  ].filter((c): c is { key: string; label: string; dot?: string; clears: string[] } => Boolean(c));
  // The search box shows its own term, so the Filters button counts only what's inside the menu.
  const menuCount = chips.filter((c) => c.key !== "search").length;
  const sortLabel = SORTS.find((s) => s.value === query.sort)!.label;

  return (
    <>
      <PageTitle sub={result ? tn(result.total, "{n} product", "{n} products") : error ? undefined : "Loading…"}>
        {query.search
          ? t("Results for “{search}”", { search: query.search })
          : query.sellerId
            ? seller
              ? t("Products by {seller}", { seller: sellerLabel })
              : t("Products by seller #{id}", { id: query.sellerId })
            : query.category
              ? t(CATEGORY_LABELS[query.category])
              : "Products"}
      </PageTitle>

      {/* Search, then the Filters menu and the Sort menu */}
      <div id="filters" className="flex scroll-mt-24 flex-wrap items-center gap-2 sm:flex-nowrap">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            search(searchText, true);
          }}
          className="relative w-full sm:flex-1"
        >
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={searchText}
            onChange={(e) => search(e.target.value)}
            placeholder={t("Search in products…")}
            aria-label={t("Search")}
            className="h-11 w-full rounded-lg border border-line bg-soft pr-10 pl-11 outline-none placeholder:text-muted focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => search("", true)}
              aria-label={t("Clear")}
              className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-line hover:text-fg"
            >
              <Icon name="close" className="size-4" />
            </button>
          )}
        </form>

        <div ref={filtersBox} className="relative flex-1 sm:flex-none">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            className={`${TRIGGER} w-full justify-center ${menuCount || filtersOpen ? "border-brand" : "border-line"}`}
          >
            <Icon name="sliders" className="size-5" />
            {t("Filters")}
            {menuCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand text-xs font-bold text-white">{menuCount}</span>}
            <Icon name="chevronDown" className={`size-4 text-muted transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </button>

          {filtersOpen && (
            <div
              role="dialog"
              aria-label={t("Filters")}
              className="absolute left-0 z-30 mt-2 w-[min(23rem,calc(100vw-2rem))] animate-drop overflow-hidden rounded-xl border border-line bg-raised shadow-2xl sm:right-0 sm:left-auto"
            >
              <FilterSection title="Price" value={price} open={section === "Price"} onToggle={() => setSection((s) => (s === "Price" ? null : "Price"))}>
                <form
                  key={queryKey} // refill when the URL changes
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    const value = (key: string) => String(data.get(key) ?? "").trim() || undefined;
                    update({ minPrice: value("minPrice"), maxPrice: value("maxPrice") });
                  }}
                  className="flex items-center gap-2"
                >
                  <input name="minPrice" type="number" min={0} defaultValue={query.minPrice} placeholder={t("From")} aria-label={t("From")} className="h-10 w-full min-w-0 rounded-lg border border-line bg-soft px-3 text-sm outline-none focus:border-brand" />
                  <span className="text-muted">–</span>
                  <input name="maxPrice" type="number" min={0} defaultValue={query.maxPrice} placeholder={t("To")} aria-label={t("To")} className="h-10 w-full min-w-0 rounded-lg border border-line bg-soft px-3 text-sm outline-none focus:border-brand" />
                  <button type="submit" className={`${BUTTON} h-10 px-4 text-sm`}>
                    {t("Apply")}
                  </button>
                </form>
              </FilterSection>

              <FilterSection
                title="Category"
                value={query.category && t(CATEGORY_LABELS[query.category])}
                open={section === "Category"}
                onToggle={() => setSection((s) => (s === "Category" ? null : "Category"))}
              >
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={query.category === c}
                      onClick={() => update({ category: query.category === c ? undefined : c })}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        query.category === c ? "border-fg bg-fg text-surface" : "border-line hover:border-fg"
                      }`}
                    >
                      {t(CATEGORY_LABELS[c])}
                    </button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Size" value={query.size} open={section === "Size"} onToggle={() => setSection((s) => (s === "Size" ? null : "Size"))}>
                <div className="flex flex-wrap gap-2">
                  {SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={query.size === size}
                      onClick={() => update({ size: query.size === size ? undefined : size })}
                      className={`h-9 min-w-11 rounded-md border px-2 text-sm font-medium transition-colors ${
                        query.size === size ? "border-brand bg-brand text-white" : "border-line hover:border-fg"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection
                title="Color"
                value={query.color && capital(t(query.color))}
                open={section === "Color"}
                onToggle={() => setSection((s) => (s === "Color" ? null : "Color"))}
              >
                <div className="grid grid-cols-7 gap-2">
                  {COLORS.map((c) => {
                    const on = query.color === c.name;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        title={t(c.name)}
                        aria-label={t(c.name)}
                        aria-pressed={on}
                        onClick={() => update({ color: on ? undefined : c.name })}
                        className={`grid size-9 place-items-center rounded-full transition hover:scale-110 ${on ? "ring-2 ring-brand ring-offset-2 ring-offset-raised" : ""}`}
                      >
                        <ColorDot name={c.name} className="size-7" />
                      </button>
                    );
                  })}
                </div>
              </FilterSection>

              <FilterSection
                title="Availability"
                value={query.inStock ? t("In stock only") : undefined}
                open={section === "Availability"}
                onToggle={() => setSection((s) => (s === "Availability" ? null : "Availability"))}
              >
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
                  {t("In stock only")}
                  <input
                    type="checkbox"
                    role="switch"
                    checked={query.inStock === true}
                    onChange={(e) => update({ inStock: e.target.checked ? "true" : undefined })}
                    className="peer sr-only"
                  />
                  <span className="relative h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
                </label>
              </FilterSection>

              <div className="flex items-center justify-between gap-2 border-t border-line bg-soft/50 px-4 py-3">
                <button type="button" onClick={clearAll} disabled={!chips.length} className="text-sm font-medium text-muted hover:text-fg disabled:opacity-40">
                  {t("Clear all")}
                </button>
                <button type="button" onClick={() => setFiltersOpen(false)} className={`${BUTTON} h-9 px-4 text-sm`}>
                  {result ? tn(result.total, "Show {n} product", "Show {n} products") : t("Done")}
                </button>
              </div>
            </div>
          )}
        </div>

        <div ref={sortBox} className="relative flex-1 sm:flex-none">
          <button
            type="button"
            onClick={() => setSortOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            className={`${TRIGGER} w-full justify-center ${sortOpen ? "border-brand" : "border-line"}`}
          >
            <span className="text-muted">{t("Sort by")}:</span>
            {t(sortLabel)}
            <Icon name="chevronDown" className={`size-4 text-muted transition-transform ${sortOpen ? "rotate-180" : ""}`} />
          </button>
          {sortOpen && (
            <ul role="listbox" aria-label={t("Sort by")} className="absolute right-0 z-30 mt-2 w-60 animate-drop rounded-xl border border-line bg-raised p-1.5 shadow-2xl">
              {SORTS.map((s) => (
                <li key={s.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={s.value === query.sort}
                    onClick={() => {
                      update({ sort: s.value === "newest" ? undefined : s.value });
                      setSortOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      s.value === query.sort ? "bg-brand/10 text-brand" : "hover:bg-soft"
                    }`}
                  >
                    {t(s.label)}
                    {s.value === query.sort && <Icon name="check" className="ml-auto size-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* What's switched on, each with its own × */}
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => (c.key === "search" ? search("", true) : update(Object.fromEntries(c.clears.map((k) => [k, undefined]))))}
              className="group flex h-8 items-center gap-1.5 rounded-full border border-line bg-soft pr-2 pl-3 text-sm font-medium transition-colors hover:border-fg"
            >
              {c.dot && <ColorDot name={c.dot} className="size-3.5" />}
              {c.label}
              <Icon name="close" className="size-3.5 text-muted group-hover:text-fg" />
            </button>
          ))}
          {chips.length > 1 && (
            <button type="button" onClick={clearAll} className="px-2 text-sm font-medium text-brand hover:underline">
              {t("Clear all")}
            </button>
          )}
        </div>
      )}

      <div className="mt-6">
        <ErrorBox message={error} />
        {result?.items.length === 0 ? (
          <EmptyState
            icon="search"
            title="Nothing found"
            text={chips.length ? "Try other words or fewer filters." : "No products in the shop yet."}
            action={
              chips.length > 0 && (
                <button type="button" onClick={clearAll} className={BUTTON_SECONDARY}>
                  {t("Clear filters")}
                </button>
              )
            }
          />
        ) : (
          (result || !error) && <ProductGrid products={result?.items ?? null} loading={loadingMore} skeletons={result ? 4 : 10} />
        )}
        {/* The marker the endless scroll watches; the end of the list says so. */}
        <div ref={sentinel} aria-hidden />
        {result && !hasMore && result.items.length > PAGE_SIZE && (
          <div className="mt-16">
            <Motif />
            <p className="mt-4 text-center text-sm text-muted">{tn(result.total, "That's all — {n} product", "That's all — {n} products")}</p>
          </div>
        )}
      </div>
    </>
  );
}
