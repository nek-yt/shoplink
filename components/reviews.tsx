"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, timeAgo } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { CommentSort, Page, Product, ProductComment, Review, User } from "@/lib/shoplink";
import { useConfirm } from "./dialog";
import { Icon } from "./icons";
import { loginHref, useSession } from "./session";
import { BUTTON_SECONDARY, Skeleton } from "./ui";
import { AdminBadge } from "./admin-badge";

const TEXT_MAX = 1000;
const PAGE = 10;
const STAR_WORDS = ["Terrible", "Bad", "Okay", "Good", "Excellent"];
const SORTS: { value: CommentSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

export function Stars({ value, className = "size-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex text-amber-400" aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" filled={value >= n - 0.25} className={`${className} ${value >= n - 0.25 ? "" : "text-line"}`} />
      ))}
    </span>
  );
}

/** Five big stars to tap. Hovering shows what each one means. */
function StarPicker({ value, onPick, disabled }: { value: number; onPick: (n: number) => void; disabled?: boolean }) {
  const { t } = useT();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label={t("Your rating")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t(STAR_WORDS[n - 1])}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onClick={() => onPick(n)}
            className="rounded-md p-0.5 transition hover:scale-115 active:scale-95 disabled:pointer-events-none"
          >
            <Icon name="star" filled={shown >= n} className={`size-8 ${shown >= n ? "text-amber-400" : "text-line"}`} />
          </button>
        ))}
      </div>
      <p className="mt-1 h-5 text-sm font-medium text-muted">{shown ? t(STAR_WORDS[shown - 1]) : ""}</p>
    </div>
  );
}

/** "Add a comment…": grows with the text; the buttons show up once you start. Ctrl/⌘+Enter posts. */
function Composer({
  user,
  initial = "",
  autoFocus = false,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  user: User;
  initial?: string;
  autoFocus?: boolean;
  submitLabel: string;
  onSubmit: (text: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const { t } = useT();
  const [text, setText] = useState(initial);
  const [focused, setFocused] = useState(autoFocus);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const open = focused || text.length > 0 || Boolean(onCancel);
  const trimmed = text.trim();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    if (autoFocus) box.current?.focus();
  }, [autoFocus]);

  async function submit() {
    if (!trimmed || busy) return;
    setBusy(true);
    const ok = await onSubmit(trimmed);
    setBusy(false);
    if (ok && !onCancel) {
      setText("");
      setFocused(false);
      box.current?.blur();
    }
  }

  return (
    <div className="flex gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={api.assetUrl(user.avatarUrl)} alt="" className="size-9 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <textarea
          ref={box}
          value={text}
          rows={1}
          maxLength={TEXT_MAX}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape" && onCancel) onCancel();
          }}
          placeholder={t("Add a comment…")}
          aria-label={t("Add a comment…")}
          className="block max-h-60 w-full resize-none border-b-2 border-line bg-transparent pb-1.5 leading-relaxed outline-none transition-colors placeholder:text-muted focus:border-brand"
        />
        {open && (
          <div className="mt-2 flex items-center justify-end gap-2">
            {text.length > TEXT_MAX * 0.8 && (
              <span className="mr-auto text-xs text-muted tabular-nums">
                {text.length} / {TEXT_MAX}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (onCancel) return onCancel();
                setText("");
                setFocused(false);
              }}
              className="rounded-full px-4 py-1.5 text-sm font-medium hover:bg-soft"
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              disabled={!trimmed || busy || trimmed === initial.trim()}
              onClick={submit}
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:bg-soft disabled:text-muted"
            >
              {t(busy ? "Saving…" : submitLabel)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** A comment, or the comment someone wrote with their stars (older reviews). */
type Entry = {
  key: string;
  kind: "comment" | "review";
  id: number;
  userId: number;
  name: string;
  username: string | null;
  avatarUrl: string;
  /** Admins get the hammer badge next to their name. */
  isAdmin: boolean;
  text: string;
  edited: boolean;
  createdAt: string;
};

const fromComment = (c: ProductComment): Entry => ({
  key: `c${c.id}`,
  kind: "comment",
  id: c.id,
  userId: c.userId,
  name: c.userName,
  username: c.userUsername,
  avatarUrl: c.userAvatarUrl,
  isAdmin: c.userIsAdmin ?? false,
  text: c.text,
  edited: c.edited,
  createdAt: c.createdAt,
});

const fromReview = (r: Review): Entry => ({
  key: `r${r.id}`,
  kind: "review",
  id: r.id,
  userId: r.userId,
  name: r.userName,
  username: null,
  avatarUrl: r.userAvatarUrl,
  isAdmin: false,
  text: r.comment,
  edited: new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime() > 1000,
  createdAt: r.createdAt,
});

function CommentItem({
  entry,
  rating,
  isSeller,
  user,
  canDelete,
  onSave,
  onDelete,
}: {
  entry: Entry;
  rating?: number;
  isSeller: boolean;
  user: User | null | undefined;
  canDelete: boolean;
  onSave: (entry: Entry, text: string) => Promise<boolean>;
  onDelete: (entry: Entry) => void;
}) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState(false);
  const mine = user?.id === entry.userId;

  return (
    <li className="group flex animate-rise gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={api.assetUrl(entry.avatarUrl)} alt="" className="size-9 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="inline-flex items-center gap-1 font-semibold">
            {entry.username ? `@${entry.username}` : entry.name}
            {/* Reviews don’t say who is an admin, but your own entries are known. */}
            {(entry.isAdmin || (mine && user?.role === "admin")) && <AdminBadge className="size-3.5" />}
          </span>
          {isSeller && <span className="rounded bg-tangerine/15 px-1.5 py-px text-[11px] font-bold text-tangerine">{t("The seller")}</span>}
          {rating !== undefined && <Stars value={rating} className="size-3.5" />}
          <time dateTime={entry.createdAt} title={formatDate(entry.createdAt, locale)} className="text-muted">
            {timeAgo(entry.createdAt, locale)}
          </time>
          {entry.edited && <span className="text-xs text-muted">({t("edited")})</span>}
        </p>

        {editing && user ? (
          <div className="mt-2">
            <Composer
              user={user}
              initial={entry.text}
              autoFocus
              submitLabel="Save"
              onCancel={() => setEditing(false)}
              onSubmit={async (text) => {
                const ok = await onSave(entry, text);
                if (ok) setEditing(false);
                return ok;
              }}
            />
          </div>
        ) : (
          <p className="mt-1 leading-relaxed break-words whitespace-pre-line">{entry.text}</p>
        )}

        {!editing && (mine || canDelete) && (
          <div className="mt-1 flex gap-1 text-xs font-medium text-muted opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            {mine && (
              <button type="button" onClick={() => setEditing(true)} className="rounded-full px-2.5 py-1 hover:bg-soft hover:text-fg">
                {t("Edit")}
              </button>
            )}
            <button type="button" onClick={() => onDelete(entry)} className="rounded-full px-2.5 py-1 hover:bg-red-500/10 hover:text-danger">
              {t("Delete")}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Ratings & comments under a product. Stars: one rating per person (tap to rate, tap again to change).
 * Comments: as many as anyone likes, the seller can answer, and older reviews' comments show up among them.
 */
export function Reviews({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const { t, tn } = useT();
  const pathname = usePathname();
  const { user, notify } = useSession();
  const confirm = useConfirm();
  const isSeller = user?.id === product.sellerId;

  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [loadedMine, setMine] = useState<Review | null | undefined>(undefined);
  const [comments, setComments] = useState<Page<ProductComment> | null>(null);
  const [sort, setSort] = useState<CommentSort>("newest");
  const [rating, setRating] = useState(false);
  // Guests and the seller have no rating of their own; nothing to load for them.
  const mine = user === null || isSeller ? null : loadedMine;

  const loadReviews = useCallback(() => {
    api.reviews.list(product.id, { limit: 100 }).then(
      (page) => setReviews(page.items),
      () => setReviews([]),
    );
  }, [product.id]);

  const loadMine = useCallback(() => {
    if (!user || isSeller) return;
    api.reviews.mine(product.id).then(setMine, () => setMine(null));
  }, [product.id, user, isSeller]);

  const loadComments = useCallback(
    (page = 1) => {
      api.comments.list(product.id, { sort, page, limit: PAGE }).then(
        (next) => setComments((prev) => (page > 1 && prev ? { ...next, items: [...prev.items, ...next.items] } : next)),
        () => setComments({ items: [], total: 0, page: 1, limit: PAGE, pages: 0 }),
      );
    },
    [product.id, sort],
  );

  useEffect(() => loadReviews(), [loadReviews]);
  useEffect(() => loadMine(), [loadMine]);
  useEffect(() => loadComments(1), [loadComments]);

  const count = product.reviewsCount;
  const average = product.reviewsRating;
  const spread = reviews ? [1, 2, 3, 4, 5].map((n) => reviews.filter((r) => r.rating === n).length) : null;
  const spreadTotal = spread?.reduce((a, b) => a + b, 0) ?? 0;
  const ratingOf = new Map((reviews ?? []).map((r) => [r.userId, r.rating]));

  // Comments, plus the comments people wrote with their stars before comments existed on their own.
  const reviewEntries = (reviews ?? []).filter((r) => r.comment.trim()).map(fromReview);
  const entries = [...(comments?.items ?? []).map(fromComment), ...reviewEntries].sort((a, b) =>
    sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
  );
  const commentCount = (comments?.total ?? 0) + reviewEntries.length;

  async function rate(n: number) {
    if (rating || mine === undefined || n === mine?.rating) return;
    setRating(true);
    try {
      const saved = mine ? await api.reviews.update(product.id, mine.id, { rating: n }) : await api.reviews.create(product.id, { rating: n });
      setMine(saved);
      notify({ title: mine ? "Rating changed" : "Thanks for rating!", text: t(STAR_WORDS[n - 1]) });
      loadReviews();
      onChanged();
    } catch (err) {
      notify({ title: "Couldn't save your rating", text: t(errorMessage(err)) }, "error");
    }
    setRating(false);
  }

  async function removeRating() {
    if (!mine) return;
    const yes = await confirm({
      title: "Remove your rating?",
      text: mine.comment.trim() ? "Your stars and the comment you wrote with them will be removed." : "Your stars will be removed.",
      confirmLabel: "Remove",
      danger: true,
      icon: "star",
    });
    if (!yes) return;
    try {
      await api.reviews.remove(product.id, mine.id);
      setMine(null);
      notify({ title: "Rating removed", kind: "info" });
      loadReviews();
      onChanged();
    } catch (err) {
      notify({ title: "Couldn't remove your rating", text: t(errorMessage(err)) }, "error");
    }
  }

  async function post(text: string) {
    try {
      const comment = await api.comments.create(product.id, text);
      setComments((prev) => (prev ? { ...prev, items: sort === "newest" ? [comment, ...prev.items] : [...prev.items, comment], total: prev.total + 1 } : prev));
      notify({ title: "Comment posted" });
      return true;
    } catch (err) {
      notify({ title: "Couldn't post the comment", text: t(errorMessage(err)) }, "error");
      return false;
    }
  }

  async function save(entry: Entry, text: string) {
    try {
      if (entry.kind === "comment") {
        const saved = await api.comments.update(product.id, entry.id, text);
        setComments((prev) => (prev ? { ...prev, items: prev.items.map((c) => (c.id === saved.id ? saved : c)) } : prev));
      } else {
        await api.reviews.update(product.id, entry.id, { comment: text });
        loadReviews();
      }
      notify({ title: "Comment updated" });
      return true;
    } catch (err) {
      notify({ title: "Couldn't save the comment", text: t(errorMessage(err)) }, "error");
      return false;
    }
  }

  async function remove(entry: Entry) {
    const yes = await confirm({ title: "Delete this comment?", text: "It disappears for everyone.", confirmLabel: "Delete", danger: true });
    if (!yes) return;
    try {
      if (entry.kind === "comment") {
        await api.comments.remove(product.id, entry.id);
        setComments((prev) => (prev ? { ...prev, items: prev.items.filter((c) => c.id !== entry.id), total: prev.total - 1 } : prev));
      } else {
        // A review's comment: keep the stars, drop the words.
        await api.reviews.update(product.id, entry.id, { comment: "" });
        loadReviews();
      }
      notify({ title: "Comment deleted", kind: "info" });
    } catch (err) {
      notify({ title: "Couldn't delete the comment", text: t(errorMessage(err)) }, "error");
    }
  }

  return (
    <section id="reviews" className="mt-16 scroll-mt-24">
      <h2 className="mb-8 border-b border-line pb-4 font-display text-3xl leading-none font-semibold tracking-tight sm:text-4xl">
        <span className="marker">{t("Ratings & comments")}</span>
      </h2>

      {/* The one box: how it's rated, and your own rating */}
      <div className="relative grid gap-8 rounded-3xl border border-line bg-raised p-6 sm:p-8 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,17rem)] lg:items-center lg:gap-10">
        <div className="flex items-center gap-4 lg:block">
          <p className={`font-display text-7xl leading-none font-semibold tabular-nums ${count ? "" : "text-muted"}`}>
            {average !== null && count ? average.toFixed(1) : "0.0"}
          </p>
          <div className="lg:mt-2">
            <Stars value={average ?? 0} className="size-5" />
            <p className="mt-1 text-sm text-muted">{count ? tn(count, "{n} rating", "{n} ratings") : t("No ratings yet")}</p>
          </div>
        </div>

        <ul className="space-y-2">
          {[5, 4, 3, 2, 1].map((n) => {
            const k = spread?.[n - 1] ?? 0;
            return (
              <li key={n} className="flex items-center gap-3 text-sm">
                <span className="w-3 text-right font-medium tabular-nums">{n}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-soft">
                  <span
                    className="block h-full rounded-full bg-amber-400 transition-all duration-700"
                    style={{ width: spreadTotal ? `${(k / spreadTotal) * 100}%` : "0%" }}
                  />
                </span>
                <span className="w-7 text-right text-muted tabular-nums">{k}</span>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-line pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
          {user === undefined || mine === undefined ? (
            <Skeleton className="h-20 w-full rounded-lg" />
          ) : !user ? (
            <>
              <p className="font-semibold">{t("Rate this product")}</p>
              <div className="pointer-events-none mt-2 opacity-40">
                <StarPicker value={0} onPick={() => {}} disabled />
              </div>
              <Link href={loginHref(`${pathname}#reviews`)} className="text-sm font-medium text-brand hover:underline">
                {t("Log in to rate and comment")}
              </Link>
            </>
          ) : isSeller ? (
            <>
              <p className="font-semibold">{t("Your product")}</p>
              <p className="mt-1 text-sm text-muted">{t("Buyers rate it here. You can answer their questions in the comments.")}</p>
            </>
          ) : (
            <>
              <p className="font-semibold">{t(mine ? "Your rating" : "Rate this product")}</p>
              <div className="mt-2">
                <StarPicker value={mine?.rating ?? 0} onPick={rate} disabled={rating} />
              </div>
              <p className="text-xs text-muted">
                {mine ? (
                  <>
                    {t("Tap a star to change it.")}{" "}
                    <button type="button" onClick={removeRating} className="font-medium hover:text-danger hover:underline">
                      {t("Remove")}
                    </button>
                  </>
                ) : (
                  t("One rating per person. Comments are unlimited.")
                )}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Comments */}
      <div className="mt-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-2xl font-semibold">
            {t("Comments")} <span className="font-normal text-muted tabular-nums">{commentCount}</span>
          </h3>
          <div className="flex rounded-full bg-soft p-1 text-sm" role="tablist" aria-label={t("Sort by")}>
            {SORTS.map((s) => (
              <button
                key={s.value}
                type="button"
                role="tab"
                aria-selected={sort === s.value}
                onClick={() => {
                  if (s.value === sort) return;
                  setComments(null);
                  setSort(s.value);
                }}
                className={`rounded-full px-3.5 py-1 font-medium transition ${sort === s.value ? "bg-surface shadow-sm" : "text-muted hover:text-fg"}`}
              >
                {t(s.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          {user ? (
            <Composer user={user} submitLabel="Comment" onSubmit={post} />
          ) : user === null ? (
            <Link
              href={loginHref(`${pathname}#reviews`)}
              className="flex items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-muted transition hover:border-brand hover:text-brand"
            >
              <Icon name="chat" className="size-5" />
              {t("Log in to join the conversation")}
            </Link>
          ) : null}
        </div>

        {!comments || !reviews ? (
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-soft text-muted">
              <Icon name="chat" className="size-6" />
            </span>
            <p className="mt-3 font-medium">{t("No comments yet")}</p>
            <p className="mt-1 text-sm text-muted">{t("Ask about the size, the fabric, the delivery — the seller can answer here.")}</p>
          </div>
        ) : (
          <>
            <ul className="space-y-6">
              {entries.map((e) => (
                <CommentItem
                  key={e.key}
                  entry={e}
                  rating={ratingOf.get(e.userId)}
                  isSeller={e.userId === product.sellerId}
                  user={user}
                  // Comments: the author, the seller or an admin. Words written with stars: only their author.
                  canDelete={Boolean(user && (user.id === e.userId || (e.kind === "comment" && (user.role === "admin" || isSeller))))}
                  onSave={save}
                  onDelete={remove}
                />
              ))}
            </ul>
            {comments.page < comments.pages && (
              <button type="button" onClick={() => loadComments(comments.page + 1)} className={`${BUTTON_SECONDARY} mt-8 w-full`}>
                {t("Show more comments")}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

