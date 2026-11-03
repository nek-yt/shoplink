"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, currentToken } from "@/lib/api";
import { formatPrice, timeAgo } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { AppNotification } from "@/lib/shoplink";
import { Icon } from "./icons";
import { REPORT_REASON_LABELS } from "./report";
import { useSession } from "./session";

type Translate = ReturnType<typeof useT>["t"];

/** The notification in the reader's language, built from its details (the English title is the fallback). */
function words(n: AppNotification, t: Translate): { title: string; text: string } {
  const d = n.data ?? {};
  if (n.type === "sale" && d.buyerName) {
    const what = (d.items ?? []).map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name)).join(", ");
    return {
      title: t("{buyer} bought your product", { buyer: d.buyerName }),
      text: [what, d.total !== undefined && formatPrice(d.total), d.orderNumber && t("order {number}", { number: d.orderNumber })].filter(Boolean).join(" · "),
    };
  }
  if (n.type === "order" && d.orderNumber && d.status) {
    const moved: Record<string, string> = {
      confirmed: "Your order {number} was confirmed",
      shipped: "Your order {number} is on its way",
      delivered: "Your order {number} was delivered",
      cancelled: "Your order {number} was cancelled",
    };
    return { title: t(moved[d.status] ?? n.title, { number: d.orderNumber }), text: d.productName ?? "" };
  }
  if (n.type === "report" && d.productName) {
    const reason = d.reason && REPORT_REASON_LABELS[d.reason] ? t(REPORT_REASON_LABELS[d.reason].label) : (d.reason ?? "");
    return {
      title: t("{who} reported a product", { who: d.reporterName ?? t("Someone") }),
      text: `${d.productName} · ${reason}`,
    };
  }
  return { title: n.title, text: n.body };
}

const BASE_TITLE = "ShopLink";

/**
 * The live connection: one EventSource per logged-in account, reconnecting by itself.
 * Calls `onNew` for each notification that arrives and keeps the unread count.
 */
function useLiveNotifications(onNew: (n: AppNotification) => void) {
  const { user } = useSession();
  const [unread, setUnread] = useState(0);
  const onNewRef = useRef(onNew);
  useEffect(() => {
    onNewRef.current = onNew;
  }, [onNew]);
  const userId = user?.id;

  useEffect(() => {
    const token = currentToken();
    if (!userId || !token) return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let wait = 2000;
    let closed = false;

    const connect = () => {
      source = new EventSource(api.notifications.streamUrl(token));
      source.addEventListener("open", () => (wait = 2000));
      source.addEventListener("unread", (e) => setUnread(JSON.parse((e as MessageEvent).data).unread ?? 0));
      source.addEventListener("notification", (e) => onNewRef.current(JSON.parse((e as MessageEvent).data)));
      // The browser retries dropped connections itself; a refused one (server asleep, bad gateway) is closed for good,
      // so that case tries again here, waiting longer each time (up to a minute).
      source.addEventListener("error", () => {
        if (closed || source?.readyState !== EventSource.CLOSED) return;
        retry = setTimeout(connect, wait);
        wait = Math.min(wait * 2, 60_000);
      });
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      source?.close();
    };
  }, [userId]);

  return [unread, setUnread] as const;
}

function Row({ n, onOpen }: { n: AppNotification; onOpen: () => void }) {
  const { t, locale } = useT();
  const { title, text } = words(n, t);
  const inner = (
    <>
      <span className="relative shrink-0">
        {n.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={api.assetUrl(n.imageUrl)} alt="" className="size-12 rounded-xl object-cover" />
        ) : (
          <span className="grid size-12 place-items-center rounded-xl bg-soft">
            <Icon name="bell" className="size-5" />
          </span>
        )}
        <span
          className={`absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full border-2 border-raised text-white ${n.type === "report" ? "bg-danger" : n.type === "order" ? "bg-brand" : "bg-emerald-500"}`}
        >
          <Icon name={n.type === "report" ? "flag" : n.type === "order" ? "truck" : "cart"} className="size-2.5" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm leading-snug ${n.read ? "" : "font-semibold"}`}>{title}</span>
        {text && <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">{text}</span>}
        <span className="mt-1 block text-xs text-muted">{timeAgo(n.createdAt, locale)}</span>
      </span>
      {!n.read && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand" aria-label={t("New")} />}
    </>
  );
  const cls = `flex items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-soft ${n.read ? "" : "bg-brand/[0.05]"}`;
  return n.link ? (
    <Link href={n.link} onClick={onOpen} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** The bell in the top bar: live badge, and the list of notifications in a panel. One per account (it starts fresh on a switch). */
export function NotificationBell() {
  const { user } = useSession();
  return user ? <Bell key={user.id} /> : null;
}

function Bell() {
  const { t } = useT();
  const { user, notify } = useSession();
  const pathname = usePathname();
  // The page it was opened on: going to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (o: boolean) => setOpenOn(o ? pathname : null);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [alerts, setAlerts] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const panelRef = useRef<HTMLDivElement>(null);

  // What happens the moment one arrives: into the list, a toast, and a system notification when the tab is hidden.
  const onNew = useCallback(
    (n: AppNotification) => {
      setItems((list) => (list ? [n, ...list.filter((x) => x.id !== n.id)] : list));
      const { title, text } = words(n, t);
      notify({ title, text, image: n.imageUrl ?? undefined, kind: n.type === "report" ? "info" : "ok", action: n.link ? { label: "View", href: n.link } : undefined });
      try {
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          const sys = new Notification(title, { body: text, icon: n.imageUrl ? api.assetUrl(n.imageUrl) : undefined, tag: `shoplink-${n.id}` });
          sys.onclick = () => {
            window.focus();
            if (n.link) window.location.href = n.link;
          };
        }
      } catch {
        // some browsers (iOS Safari) only allow these from an installed app
      }
    },
    [notify, t],
  );
  const [unread, setUnread] = useLiveNotifications(onNew);

  // The count in the tab title, like "(2) ShopLink".
  useEffect(() => {
    document.title = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${BASE_TITLE}` : BASE_TITLE;
  }, [unread]);

  // Opening the panel loads the list and counts everything in it as seen (the dots stay until it closes).
  useEffect(() => {
    if (!open || !user) return;
    api.notifications.list({ limit: 30 }).then(
      (page) => {
        setItems(page.items);
        if (page.unread > 0) api.notifications.markRead().then((r) => setUnread(r.unread), () => {});
      },
      () => setItems([]),
    );
  }, [open, user, setUnread]);

  // Closing: on Escape and on a click outside (changing page closes it too, see openOn).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && !(e.target as Element).closest?.("[data-bell]")) setOpenOn(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);
  async function askForAlerts() {
    try {
      setAlerts(await Notification.requestPermission());
    } catch {
      setAlerts("denied");
    }
  }

  return (
    <>
      <button
        type="button"
        data-bell
        onClick={() => setOpen(!open)}
        aria-label={unread ? t("Notifications ({n} new)", { n: unread }) : t("Notifications")}
        aria-expanded={open}
        className={`relative rounded-md p-2 transition hover:bg-soft ${open ? "bg-soft" : ""}`}
      >
        <Icon name="bell" className={`size-7 ${unread ? "origin-top animate-[wiggle_0.9s_ease-in-out_1]" : ""}`} key={`bell-${unread}`} />
        {unread > 0 && (
          <span
            key={`count-${unread}`}
            className="absolute -top-1 -right-1.5 grid h-4.5 min-w-4.5 animate-pop place-items-center rounded-full bg-tangerine px-1 text-[11px] font-bold text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("Notifications")}
            className="fixed inset-x-2 top-16 z-50 flex max-h-[min(36rem,calc(100dvh-9rem))] animate-dialog flex-col rounded-3xl border border-line bg-raised shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[26rem]"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-display text-2xl font-semibold">{t("Notifications")}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("Close")} className="rounded-full p-1.5 text-muted hover:bg-soft hover:text-fg">
                <Icon name="close" className="size-5" />
              </button>
            </div>

            {alerts === "default" && (
              <button
                type="button"
                onClick={askForAlerts}
                className="mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-fg px-4 py-3 text-left text-sm text-surface transition hover:opacity-90"
              >
                <Icon name="bell" className="size-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t("Turn on alerts")}</span>
                  <span className="block opacity-75">{t("Know the moment someone buys, even in another tab.")}</span>
                </span>
              </button>
            )}

            <div className="overflow-y-auto p-2">
              {!items ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-2xl bg-skeleton" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <span className="grid size-14 place-items-center rounded-full bg-soft text-muted">
                    <Icon name="bell" className="size-6" />
                  </span>
                  <p className="mt-4 font-display text-xl font-semibold">{t("All quiet for now")}</p>
                  <p className="mt-1 text-sm text-muted">{t("When someone buys your product, you'll know right here — no refresh needed.")}</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {items.map((n) => (
                    <li key={n.id}>
                      <Row n={n} onOpen={() => setOpen(false)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
