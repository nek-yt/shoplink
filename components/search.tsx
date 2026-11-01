"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Person, Product } from "@/lib/shoplink";
import { Icon } from "./icons";
import { ProductImage, Skeleton } from "./ui";

const WAIT_MS = 250; // after the last key press
const MAX_PRODUCTS = 6;
// The backend also matches descriptions; the quick menu shows only products whose name matches, so it asks for
// more and keeps those. "See all results" still searches descriptions too.
const PRODUCTS_TO_SCAN = 50;
const MAX_PEOPLE = 3; // above the products, like TikTok's "Users" row
const MAX_PEOPLE_ONLY = 8; // when searching "@name"

type Found = { query: string; products: Product[]; people: Person[]; peopleTotal: number; error?: string };

/** Shows the part of `text` that matches `term` in bold. */
function Match({ text, term }: { text: string; term: string }) {
  const at = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <b className="font-semibold text-brand">{text.slice(at, at + term.length)}</b>
      {text.slice(at + term.length)}
    </>
  );
}

const productsHref = (term: string) => (term ? `/products?search=${encodeURIComponent(term)}` : "/products");
// A person's page in the shop is their products ("Products by @name").
const personHref = (p: Person) => `/products?sellerId=${p.id}`;

/**
 * The search bar from the mockup. While typing, a menu opens under it: first the people whose name or @username
 * matches (like TikTok's "Users"), then the products. Starting with "@" searches people only.
 */
export function SearchBar() {
  const { t, tn } = useT();
  const router = useRouter();
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // highlighted row for the arrow keys
  const [found, setFound] = useState<Found | null>(null);
  const query = text.trim();
  const peopleOnly = query.startsWith("@");
  const term = peopleOnly ? query.replace(/^@+/, "").trim() : query;
  const searchProducts = !peopleOnly && Boolean(term);

  // Ask the backend a moment after typing stops. Answers for an older query are ignored below.
  useEffect(() => {
    if (!term) return;
    const timer = setTimeout(async () => {
      try {
        const [people, products] = await Promise.all([
          api.people.search(term, { limit: peopleOnly ? MAX_PEOPLE_ONLY : MAX_PEOPLE }),
          searchProducts ? api.products.list({ search: term, limit: PRODUCTS_TO_SCAN }) : null,
        ]);
        setFound({
          query,
          people: people.items,
          peopleTotal: people.total,
          products: (products?.items ?? []).filter((p) => p.name.toLowerCase().includes(term.toLowerCase())).slice(0, MAX_PRODUCTS),
        });
      } catch (err) {
        setFound({ query, products: [], people: [], peopleTotal: 0, error: errorMessage(err) });
      }
    }, WAIT_MS);
    return () => clearTimeout(timer);
  }, [query, term, peopleOnly, searchProducts]);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = found?.query === query ? found : null;
  const loading = Boolean(term) && !current;
  const people = current?.people ?? [];
  const products = searchProducts ? (current?.products ?? []) : [];

  // "See all" goes to the full product list; for "@name" the best match is the place to go.
  const seeAll = peopleOnly ? null : productsHref(term);
  // Every row the arrow keys can reach, in screen order: people, products, "see all".
  const rows = [...people.map(personHref), ...products.map((p) => `/products/${p.id}`), ...(seeAll ? [seeAll] : [])];

  function go(href: string) {
    setOpen(false);
    setActive(-1);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return setOpen(false);
    if (!rows.length || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    setOpen(true);
    setActive((i) => (e.key === "ArrowDown" ? (i + 1) % rows.length : (i <= 0 ? rows.length : i) - 1));
  }

  const rowClass = (i: number) => `flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${active === i ? "bg-soft" : "hover:bg-soft"}`;
  const heading = "flex items-center justify-between px-3 pt-3 pb-1 text-xs font-bold tracking-[0.15em] text-muted uppercase";
  const showMenu = open && Boolean(query);
  const option = (i: number, href: string) => ({
    id: `${listId}-${i}`,
    role: "option",
    "aria-selected": active === i,
    href,
    onClick: () => setOpen(false),
    onMouseEnter: () => setActive(i),
    className: rowClass(i),
  });

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const target = active >= 0 && active < rows.length ? rows[active] : (seeAll ?? rows[0]);
          if (target) go(target);
        }}
        className="flex h-11 items-center rounded-lg bg-soft pl-3 transition-shadow focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand/30"
      >
        <Link href="/products#filters" aria-label={t("Filters")} title={t("Filters")} className="text-fg hover:text-brand">
          <Icon name="filter" className="size-5" />
        </Link>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("Search products, or @name for people . . .")}
          aria-label={t("Search")}
          role="combobox"
          aria-expanded={showMenu}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showMenu && active >= 0 ? `${listId}-${active}` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted"
        />
        {text && (
          <button type="button" onClick={() => setText("")} aria-label={t("Clear search")} className="p-1 text-muted hover:text-fg">
            <Icon name="close" className="size-4" />
          </button>
        )}
        <button type="submit" aria-label={t("Search")} className="grid h-full w-11 place-items-center rounded-r-lg hover:bg-fg/5">
          <Icon name="search" />
        </button>
      </form>

      {showMenu && (
        <div
          id={listId}
          role="listbox"
          className="animate-drop fixed inset-x-2 top-15 z-40 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-raised p-2 shadow-xl sm:absolute sm:inset-x-0 sm:top-full sm:mt-2"
        >
          {!term ? (
            <p className="px-3 py-4 text-sm text-muted">{t("Type a name after “@” to find people, e.g. @aziza")}</p>
          ) : loading ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className={i === 0 || peopleOnly ? "size-10 rounded-full" : "h-14 w-11 rounded-md"} />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : current?.error ? (
            <p className="px-3 py-4 text-sm text-danger">{current.error}</p>
          ) : (
            <>
              {/* People first. Without "@" they only show up when someone matches. */}
              {(peopleOnly || people.length > 0) && (
                <>
                  <p className={heading}>
                    {t("People")}
                    {current && current.peopleTotal > people.length && (
                      <span className="font-medium tracking-normal normal-case">{tn(current.peopleTotal, "{n} found", "{n} found")}</span>
                    )}
                  </p>
                  {people.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted">{t("No one matches “{term}”.", { term })}</p>
                  ) : (
                    people.map((p, i) => (
                      <Link key={p.id} {...option(i, rows[i])}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={api.assetUrl(p.avatarUrl)} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            <Match text={p.socialUsername ?? p.name} term={term} />
                          </p>
                          <p className="truncate text-sm text-muted">
                            {p.socialUsername && (
                              <>
                                <Match text={p.name} term={term} /> ·{" "}
                              </>
                            )}
                            {p.productsCount ? tn(p.productsCount, "{n} product", "{n} products") : t("No products yet")}
                          </p>
                        </div>
                        <Icon name="arrowRight" className="size-4 text-muted" />
                      </Link>
                    ))
                  )}
                </>
              )}

              {searchProducts && (
                <>
                  <p className={`${heading} ${people.length ? "mt-1 border-t border-line pt-3" : ""}`}>{t("Products")}</p>
                  {products.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted">{t("No products match “{term}”.", { term })}</p>
                  ) : (
                    products.map((p, i) => {
                      const row = people.length + i;
                      return (
                        <Link key={p.id} {...option(row, rows[row])}>
                          <ProductImage product={p} className="h-14 w-11 shrink-0 rounded-md" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              <Match text={p.name} term={term} />
                            </p>
                            <p className="text-sm text-muted">
                              {formatPrice(p.price)}
                              {p.seller?.socialUsername && <span className="ml-2">@{p.seller.socialUsername}</span>}
                              {!p.inStock && <span className="ml-2 font-medium text-danger">{t("Sold out")}</span>}
                            </p>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </>
              )}

              {seeAll && (
                <Link {...option(rows.length - 1, seeAll)} className={`mt-1 justify-between border-t border-line font-medium text-brand ${rowClass(rows.length - 1)}`}>
                  <span>{t("See all results for “{term}”", { term })}</span>
                  <Icon name="arrowRight" className="size-4" />
                </Link>
              )}
              {!peopleOnly && <p className="px-3 pt-2 pb-1 text-xs text-muted">{t("Tip: start with @ to search only people.")}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
