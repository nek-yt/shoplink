"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage, splitErrors } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { CartItem } from "@/lib/shoplink";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/dialog";
import { ColorDot } from "@/components/pickers";
import { useRequireLogin, useSession } from "@/components/session";
import { BUTTON, BUTTON_SECONDARY, ErrorBox, FormRow, INPUT, ProductImage, Skeleton } from "@/components/ui";

const DELIVERY_FIELDS = ["customerName", "phone", "address", "comment"] as const;
type Step = "cart" | "delivery";

function CartRow({ item, onChange }: { item: CartItem; onChange: () => Promise<void> }) {
  const { t } = useT();
  const { notify, wishlist, toggleWishlist } = useSession();
  const [busy, setBusy] = useState(false);
  const p = item.product;

  async function run(action: () => Promise<unknown>, done?: { title: string; kind?: "ok" | "info" }) {
    setBusy(true);
    try {
      await action();
      await onChange();
      if (done) notify({ ...done, text: p.name, image: p.imageUrl });
    } catch (err) {
      notify({ title: "Couldn't update the cart", text: t(errorMessage(err)) }, "error");
    }
    setBusy(false);
  }

  const setQuantity = (n: number) => run(() => api.cart.setQuantity(item.id, n));
  // Out of the cart, into the wishlist (unless it's already saved there).
  const saveForLater = () =>
    run(
      async () => {
        if (!wishlist.has(item.productId)) await toggleWishlist(item.productId, p);
        await api.cart.remove(item.id);
      },
      { title: "Saved for later", kind: "info" },
    );

  return (
    <li className={`flex animate-rise gap-4 py-6 first:pt-0 sm:gap-6 ${busy ? "pointer-events-none opacity-60" : ""}`}>
      <Link href={`/products/${item.productId}`} className="group shrink-0 self-start overflow-hidden rounded-2xl bg-photo">
        <ProductImage product={p} className="aspect-4/5 w-24 transition duration-700 group-hover:scale-[1.04] sm:w-32" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href={`/products/${item.productId}`} className="block font-display text-2xl leading-tight font-semibold hover:text-brand">
              {p.name}
            </Link>
            {p.seller && <p className="mt-1 text-sm text-muted">{p.seller.socialUsername ? `@${p.seller.socialUsername}` : p.seller.name}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold tabular-nums">{formatPrice(item.subtotal)}</p>
            {item.quantity > 1 && <p className="text-xs text-muted tabular-nums">{t("{price} each", { price: formatPrice(item.price) })}</p>}
          </div>
        </div>

        {(item.size || item.color) && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {item.size && (
              <span className="rounded-full border border-line px-3 py-1">
                <span className="text-muted">{t("Size")}</span> <span className="font-medium">{item.size}</span>
              </span>
            )}
            {item.color && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1">
                <ColorDot name={item.color} className="size-3.5" />
                <span className="font-medium capitalize">{t(item.color)}</span>
              </span>
            )}
          </p>
        )}

        {!item.available && (
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-danger">
            <span className="size-1.5 rounded-full bg-current" />
            {p.inStock ? t("Only {n} left — lower the quantity", { n: p.stock }) : t("Sold out — remove it to order")}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-4">
          <div className="inline-flex h-10 items-center rounded-full border border-line bg-raised">
            <button
              type="button"
              disabled={busy || item.quantity <= 1}
              onClick={() => setQuantity(item.quantity - 1)}
              aria-label={t("Less")}
              className="grid h-full w-10 place-items-center rounded-l-full hover:bg-soft disabled:opacity-30"
            >
              <Icon name="minus" className="size-4" />
            </button>
            <span className="w-8 text-center font-semibold tabular-nums">{item.quantity}</span>
            <button
              type="button"
              disabled={busy || (p.inStock && item.quantity >= p.stock)}
              onClick={() => setQuantity(item.quantity + 1)}
              aria-label={t("More")}
              className="grid h-full w-10 place-items-center rounded-r-full hover:bg-soft disabled:opacity-30"
            >
              <Icon name="plus" className="size-4" />
            </button>
          </div>
          <button type="button" onClick={saveForLater} className="text-sm font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
            {t("Save for later")}
          </button>
          <button
            type="button"
            onClick={() => run(() => api.cart.remove(item.id), { title: "Removed from cart", kind: "info" })}
            className="text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline"
          >
            {t("Remove")}
          </button>
        </div>
      </div>
    </li>
  );
}

/** "1 Cart — 2 Delivery" above the side panel. */
function Steps({ step, onCart }: { step: Step; onCart: () => void }) {
  const { t } = useT();
  const dot = (n: number, on: boolean) => (
    <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${on ? "bg-fg text-surface" : "border border-line text-muted"}`}>{n}</span>
  );
  return (
    <ol className="flex items-center gap-3 text-sm font-medium">
      <li>
        <button type="button" onClick={onCart} disabled={step === "cart"} className="flex items-center gap-2 disabled:cursor-default">
          {dot(1, true)} {t("Cart")}
        </button>
      </li>
      <li className={`h-px flex-1 ${step === "delivery" ? "bg-fg" : "bg-line"}`} />
      <li className={`flex items-center gap-2 ${step === "delivery" ? "" : "text-muted"}`}>
        {dot(2, step === "delivery")} {t("Delivery")}
      </li>
    </ol>
  );
}

export default function CartPage() {
  const { t, tn } = useT();
  const user = useRequireLogin();
  const router = useRouter();
  const { cart, refreshCart, notify, unseen, markSeen } = useSession();
  const confirm = useConfirm();
  // Being on this page means the new items have been seen: the red badge goes away.
  useEffect(() => {
    if (unseen.cart) markSeen("cart");
  }, [unseen.cart, markSeen]);
  const [step, setStep] = useState<Step>("cart");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const header = (sub?: React.ReactNode) => (
    <header className="mb-10 border-b border-line pb-8">
      <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-muted uppercase">
        <span className="h-px w-10 bg-fg/40" />
        {t("Ready when you are")}
      </p>
      <h1 className="mt-4 font-display text-5xl leading-none font-semibold sm:text-6xl">
        {t("Your")} <span className="marker">{t("cart")}</span>
      </h1>
      {sub && <p className="mt-3 text-muted">{sub}</p>}
    </header>
  );

  if (!user || !cart) {
    return (
      <>
        {header()}
        <div className="space-y-8">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-6">
              <Skeleton className="aspect-4/5 w-32 rounded-2xl" />
              <div className="flex-1 space-y-3 pt-2">
                <Skeleton className="h-6 w-1/2 rounded-full" />
                <Skeleton className="h-4 w-1/3 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (cart.items.length === 0) {
    return (
      <>
        {header()}
        <section className="flex flex-col items-center py-12 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-soft text-brand">
            <Icon name="cart" className="size-9" />
          </span>
          <h2 className="mt-6 font-display text-4xl font-semibold">{t("Your cart is empty")}</h2>
          <p className="mt-2 max-w-sm text-muted">{t("Find something you like and add it here.")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/products" className={`${BUTTON} h-12 px-8`}>
              {t("Browse products")} <Icon name="arrowRight" className="size-4" />
            </Link>
            <Link href="/wishlist" className={`${BUTTON_SECONDARY} h-12 px-8`}>
              <Icon name="heart" className="size-4" /> {t("Wishlist")}
            </Link>
          </div>
        </section>
      </>
    );
  }

  const blocked = cart.items.some((i) => !i.available);

  async function emptyCart() {
    const yes = await confirm({
      title: "Remove everything from the cart?",
      text: "The products stay in the shop, so you can add them again later.",
      confirmLabel: "Empty cart",
      danger: true,
      icon: "cart",
    });
    if (!yes) return;
    try {
      await api.cart.clear();
      await refreshCart();
      setStep("cart");
      notify({ title: "Cart emptied", kind: "info" });
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  }

  async function checkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    if (!value("address")) {
      setErrors({ address: "Enter the delivery address" });
      return;
    }
    setErrors({});
    setGeneral(null);
    setPlacing(true);
    try {
      const order = await api.cart.checkout({
        address: value("address"),
        customerName: value("customerName") || undefined,
        phone: value("phone") || undefined,
        comment: value("comment") || undefined,
      });
      await refreshCart();
      notify({ title: "Order placed", text: t("Your order number is {number}.", { number: order.orderNumber }), action: { label: "View order", href: `/orders/${order.id}` } });
      router.push(`/orders/${order.id}?placed=1`);
    } catch (err) {
      const split = splitErrors(err, DELIVERY_FIELDS);
      setErrors(split.fields);
      setGeneral(split.general);
      setPlacing(false);
      refreshCart(); // stock may have changed
    }
  }

  const totalRow = (
    <div className="flex items-baseline justify-between border-t border-line pt-4">
      <span className="font-medium">{t("Total")}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatPrice(cart.total)}</span>
    </div>
  );

  return (
    <>
      {header(
        <>
          {tn(cart.totalQuantity, "{n} item", "{n} items")} · {formatPrice(cart.total)}
        </>,
      )}
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <div>
          <ul className="divide-y divide-line">
            {cart.items.map((item) => (
              <CartRow key={item.id} item={item} onChange={refreshCart} />
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm">
            <Link href="/products" className="inline-flex items-center gap-2 font-medium underline-offset-4 hover:underline">
              <Icon name="arrowLeft" className="size-4" /> {t("Keep shopping")}
            </Link>
            <button type="button" onClick={emptyCart} className="font-medium text-muted underline-offset-4 hover:text-danger hover:underline">
              {t("Empty the cart")}
            </button>
          </div>
        </div>

        <aside className="h-fit space-y-6 rounded-3xl border border-line bg-raised p-7 lg:sticky lg:top-24">
          <Steps step={step} onCart={() => setStep("cart")} />

          {/* Step 1: what you're buying */}
          <div className={step === "cart" ? "space-y-6" : "hidden"}>
            <div>
              <h2 className="font-display text-3xl font-semibold">{t("Order summary")}</h2>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{tn(cart.totalQuantity, "{n} item", "{n} items")}</dt>
                  <dd className="font-medium tabular-nums">{formatPrice(cart.total)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t("Payment")}</dt>
                  <dd className="text-right font-medium">{t("When it arrives")}</dd>
                </div>
              </dl>
            </div>
            {totalRow}
            <ErrorBox message={blocked ? "Some items aren't available any more — change or remove them first." : null} />
            <button type="button" onClick={() => setStep("delivery")} disabled={blocked} className={`${BUTTON} h-12 w-full`}>
              {t("Checkout")} <Icon name="arrowRight" className="size-4" />
            </button>
            <p className="flex gap-2 text-xs leading-relaxed text-muted">
              <Icon name="check" className="mt-0.5 size-3.5 shrink-0" />
              {t("No card needed. You pay the seller when your order arrives.")}
            </p>
          </div>

          {/* Step 2: where it goes. Kept mounted so typed details survive going back. */}
          <form onSubmit={checkout} noValidate className={step === "delivery" ? "space-y-4" : "hidden"}>
            <div>
              <h2 className="font-display text-[1.75rem] leading-tight font-semibold">{t("Where should we send it?")}</h2>
              <p className="mt-1 text-sm text-muted">{t("The seller uses these details to deliver your order.")}</p>
            </div>
            <FormRow label="Name" error={errors.customerName}>
              <input name="customerName" defaultValue={user.name} autoComplete="name" className={INPUT} />
            </FormRow>
            <FormRow label="Phone" hint={user.phone ? undefined : "So the seller can call you"} error={errors.phone}>
              <input name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="+998 90 123 45 67" autoComplete="tel" className={INPUT} />
            </FormRow>
            <FormRow label="Address" error={errors.address}>
              <textarea name="address" rows={2} placeholder={t("City, street, house, apartment")} autoComplete="street-address" className={`${INPUT} h-auto py-2.5`} />
            </FormRow>
            <FormRow label="Comment (optional)" error={errors.comment}>
              <input name="comment" placeholder={t("Call before delivery")} className={INPUT} />
            </FormRow>
            {totalRow}
            <ErrorBox message={general ?? (blocked ? "Some items aren't available any more — change or remove them first." : null)} />
            <button type="submit" disabled={placing || blocked} className={`${BUTTON} h-12 w-full`}>
              {t(placing ? "Placing order…" : "Place order")}
            </button>
            <button type="button" onClick={() => setStep("cart")} className="w-full text-center text-sm font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
              {t("Back to cart")}
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
