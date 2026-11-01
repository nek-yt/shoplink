"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage, splitErrors } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { CATEGORIES, type Category, type Product, type ProductInput } from "@/lib/shoplink";
import { CATEGORY_LABELS } from "@/lib/options";
import { Icon } from "./icons";
import { BagProgress } from "./loader";
import { ColorDot, ColorPicker, SizePicker, Stepper } from "./pickers";
import { useConfirm } from "./dialog";
import { useSession } from "./session";
import { BUTTON, BUTTON_DANGER, BUTTON_SECONDARY, ErrorBox, INPUT } from "./ui";

const FIELDS = ["name", "description", "price", "stock", "sizes", "colors", "image", "images"] as const;
const MAX_IMAGE = 5 * 1024 * 1024;
/** The backend keeps a cover picture plus up to 10 more. */
const MAX_PHOTOS = 11;
/** Long side in pixels below which a picture looks blurry on the product page. */
const MIN_SHARP = 1000;
const NAME_MAX = 200;
const DESCRIPTION_MAX = 5000;

/** A picture in the form: one already saved on the backend (cover or extra), or a file picked just now. */
type Photo =
  | { key: string; kind: "main" | "extra"; url: string }
  | { key: string; kind: "new"; file: File; preview: string; width?: number; height?: number };

let nextKey = 0;
const photoUrl = (p: Photo) => (p.kind === "new" ? p.preview : api.assetUrl(p.url));

function savedPhotos(product?: Product): Photo[] {
  if (!product) return [];
  const list: Photo[] = [];
  if (product.hasImage) list.push({ key: "main", kind: "main", url: product.imageUrl });
  for (const url of product.images) list.push({ key: url, kind: "extra", url });
  return list;
}

/** Downloads a picture that's already on the backend, to upload it again in another slot (cover ↔ extra). */
async function fetchBlob(url: string) {
  const res = await fetch(api.assetUrl(url));
  if (!res.ok) throw new Error("Couldn't read the picture");
  return res.blob();
}

/** A numbered step: "1 Photos", "2 Details"… Steps are split by a hairline, not boxed. */
function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <section className="border-t border-line pt-8 first:border-t-0 first:pt-0">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand">{n}</span>
        <div>
          <h2 className="font-semibold">{t(title)}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{t(hint)}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={`text-xs font-normal tabular-nums ${value > max * 0.9 ? "text-danger" : "text-muted"}`}>
      {value.toLocaleString("ru-RU")} / {max.toLocaleString("ru-RU")}
    </span>
  );
}

/** Drop zone + thumbnails. The first photo is the cover. */
function PhotoManager({
  photos,
  onChange,
  error,
}: {
  photos: Photo[];
  onChange: React.Dispatch<React.SetStateAction<Photo[]>>;
  error?: string;
}) {
  const { t, tn } = useT();
  const { notify } = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const room = MAX_PHOTOS - photos.length;

  function add(files: FileList | File[]) {
    const picked: Extract<Photo, { kind: "new" }>[] = [];
    const skipped: string[] = [];
    for (const file of Array.from(files)) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) skipped.push(t("{name}: not a JPEG, PNG, WebP or GIF", { name: file.name }));
      else if (file.size > MAX_IMAGE) skipped.push(t("{name}: larger than 5 MB", { name: file.name }));
      else if (picked.length >= room) skipped.push(t("{name}: no room (11 photos at most)", { name: file.name }));
      else picked.push({ key: `new-${nextKey++}`, kind: "new", file, preview: URL.createObjectURL(file) });
    }
    if (skipped.length) notify({ title: tn(skipped.length, "{n} photo skipped", "{n} photos skipped"), text: skipped.join(" · ") }, "error");
    if (!picked.length) return;
    onChange((all) => [...all, ...picked]);
    // Measure the new pictures so small ones can be flagged.
    for (const photo of picked) {
      const img = new Image();
      img.onload = () => {
        if (!img.naturalWidth) return; // size unknown: don't flag it
        onChange((all) => all.map((p) => (p.key === photo.key ? { ...photo, width: img.naturalWidth, height: img.naturalHeight } : p)));
      };
      img.src = photo.preview;
    }
  }

  const remove = (key: string) =>
    onChange((all) => {
      const gone = all.find((p) => p.key === key);
      if (gone?.kind === "new") URL.revokeObjectURL(gone.preview);
      return all.filter((p) => p.key !== key);
    });
  const makeCover = (key: string) => onChange((all) => [all.find((p) => p.key === key)!, ...all.filter((p) => p.key !== key)]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {photos.map((photo, i) => {
          const small = photo.kind === "new" && photo.width !== undefined && Math.max(photo.width, photo.height ?? 0) < MIN_SHARP;
          return (
            <figure
              key={photo.key}
              className={`group relative animate-rise overflow-hidden rounded-xl border bg-photo ${
                i === 0 ? "col-span-2 row-span-2 border-brand ring-2 ring-brand/25" : "border-line"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(photo)} alt="" className="aspect-3/4 size-full object-cover" />
              {i === 0 && <span className="absolute top-2 left-2 rounded-md bg-brand px-2 py-0.5 text-xs font-semibold text-white shadow">{t("Cover")}</span>}
              {small && photo.kind === "new" && (
                <span
                  title={t("Low resolution — it may look blurry")}
                  className="absolute bottom-2 left-2 rounded-md bg-amber-400 px-1.5 py-0.5 text-[11px] font-semibold text-black"
                >
                  {photo.width}×{photo.height}
                </span>
              )}
              <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-2 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                {i > 0 && (
                  <button type="button" onClick={() => makeCover(photo.key)} className="rounded-md bg-white/95 px-2 py-1 text-xs font-semibold text-ink shadow hover:bg-white">
                    {t("Make cover")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(photo.key)}
                  aria-label={t("Remove photo")}
                  className="grid size-7 place-items-center rounded-md bg-white/95 text-ink shadow hover:bg-white hover:text-red-600"
                >
                  <Icon name="trash" className="size-4" />
                </button>
              </div>
            </figure>
          );
        })}

        {room > 0 && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              add(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-center transition ${
              photos.length === 0 ? "col-span-3 py-14 sm:col-span-4" : "aspect-3/4"
            } ${dragging ? "border-brand bg-brand-soft text-brand" : error ? "border-danger text-danger" : "border-line text-muted hover:border-brand hover:text-brand"}`}
          >
            <span className="grid size-11 place-items-center rounded-full bg-soft">
              <Icon name="upload" className="size-5" />
            </span>
            <span className="text-sm font-semibold text-fg">{t(photos.length ? "Add photos" : "Drop photos here or click to choose")}</span>
            <span className="text-xs">{tn(room, "{n} more allowed", "{n} more allowed")}</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) add(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-sm text-danger">{t(error)}</p>}
      <p className="mt-3 text-xs text-muted">{t("JPEG, PNG, WebP or GIF, up to 5 MB each. Best: at least 1000 × 1300 px, taken upright, on a plain background.")}</p>
    </div>
  );
}

/** How the product will look in the shop. */
function Preview({ cover, name, price, stock, colors }: { cover?: string; name: string; price: string; stock: number; colors: string[] }) {
  const { t, tn } = useT();
  const amount = Number(price);
  return (
    <div className="rounded-2xl border border-line bg-raised p-4">
      <p className="mb-3 text-xs font-bold tracking-[0.15em] text-muted uppercase">{t("Preview")}</p>
      <div className="overflow-hidden rounded-xl bg-photo">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="aspect-3/4 w-full object-cover" />
        ) : (
          <div className="grid aspect-3/4 place-items-center text-muted">
            <Icon name="upload" className="size-8" />
          </div>
        )}
      </div>
      <p className={`mt-3 truncate font-medium ${name ? "" : "text-muted"}`}>{name || t("Product name")}</p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="font-semibold tabular-nums">{price && amount >= 0 ? formatPrice(amount) : "— сум"}</p>
        <span className={`text-xs font-medium ${stock > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-danger"}`}>
          {stock > 0 ? tn(stock, "{n} in stock", "{n} in stock") : t("Sold out")}
        </span>
      </div>
      {colors.length > 0 && (
        <div className="mt-2 flex gap-1">
          {colors.slice(0, 8).map((c) => (
            <ColorDot key={c} name={c} className="size-3.5" />
          ))}
        </div>
      )}
    </div>
  );
}

/** Create (no `product`) or edit a product with its photos. */
export function ProductForm({ product }: { product?: Product }) {
  const confirm = useConfirm();
  const { t, tn } = useT();
  const router = useRouter();
  const { notify } = useSession();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState(product?.stock ?? 1);
  const [sizes, setSizes] = useState<string[]>(product?.sizes ?? []);
  const [colors, setColors] = useState<string[]>(product?.colors ?? []);
  const [category, setCategory] = useState<Category>(product?.category ?? "other");
  const [photos, setPhotos] = useState<Photo[]>(() => savedPhotos(product));
  const editing = Boolean(product);

  // Free the previews of picked files when leaving the page.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => p.kind === "new" && URL.revokeObjectURL(p.preview)), []);

  const clearError = (field: string) =>
    setErrors((current) => {
      const rest = { ...current };
      delete rest[field];
      return rest;
    });

  const checklist = [
    { label: "Cover photo", done: photos.length > 0 },
    { label: "Name", done: name.trim().length > 0 },
    { label: "Price", done: price.trim() !== "" && Number(price) >= 0 },
    { label: "In stock", done: stock > 0 },
  ];
  const ready = checklist.filter((c) => c.done).length;

  /** Brings the backend's pictures in line with the form: the first photo is the cover, the rest follow. */
  async function savePhotos(saved: Product) {
    const before = savedPhotos(product);
    const [cover, ...rest] = photos;
    let mainBlob: Blob | null = null;
    const extraBlobs: Blob[] = [];

    if (cover?.kind === "new") mainBlob = cover.file;
    else if (cover?.kind === "extra") mainBlob = await fetchBlob(cover.url); // an extra picture becomes the cover
    for (const p of rest) {
      if (p.kind === "new") extraBlobs.push(p.file);
      else if (p.kind === "main") extraBlobs.push(await fetchBlob(p.url)); // the old cover moves into the extras
    }

    // Extras that are gone (removed, or promoted to cover) are deleted first, to make room.
    const keptExtras = new Set(rest.filter((p) => p.kind === "extra").map((p) => p.key));
    for (const p of before) if (p.kind === "extra" && !keptExtras.has(p.key)) saved = await api.products.removeExtraImage(saved.id, p.url);
    if (!cover && before.some((p) => p.kind === "main")) saved = await api.products.removeImage(saved.id);

    const total = (mainBlob?.size ?? 0) + extraBlobs.reduce((n, b) => n + b.size, 0);
    if (!total) return saved;
    let sent = 0;
    setProgress(0);
    if (mainBlob) {
      const size = mainBlob.size;
      saved = await api.products.uploadMainImage(saved.id, mainBlob, (done) => setProgress(((sent + done * size) / total) * 100));
      sent += size;
    }
    if (extraBlobs.length) {
      const size = extraBlobs.reduce((n, b) => n + b.size, 0);
      saved = await api.products.addImages(saved.id, extraBlobs, (done) => setProgress(((sent + done * size) / total) * 100));
    }
    setProgress(100);
    return saved;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: ProductInput = { name: name.trim(), description: description.trim(), price: Number(price), stock, sizes, colors, category };

    // The same checks as the backend, so every wrong field is marked at once.
    const invalid: Record<string, string> = {};
    if (!input.name) invalid.name = "Enter a name";
    if (!price.trim() || !Number.isFinite(input.price) || input.price < 0) invalid.price = "Enter a price (0 or more)";
    if (Object.keys(invalid).length) {
      setErrors(invalid);
      notify({ title: tn(Object.keys(invalid).length, "Check {n} field", "Check {n} fields"), text: "The ones marked in red need fixing." }, "error");
      return;
    }

    setErrors({});
    setGeneral(null);
    setSaving(true);
    let saved: Product;
    try {
      saved = product ? await api.products.update(product.id, input) : await api.products.create(input);
    } catch (err) {
      const split = splitErrors(err, FIELDS);
      setErrors(split.fields);
      setGeneral(split.general);
      setSaving(false);
      notify({ title: editing ? "Couldn't save the changes" : "Couldn't add the product", text: split.general ?? "Check the fields marked in red." }, "error");
      return;
    }

    try {
      saved = await savePhotos(saved);
    } catch (err) {
      // The product itself is saved; the photos can be fixed on its edit page.
      notify({ title: "Saved, but some photos didn't upload", text: t(errorMessage(err)), action: { label: "Try again", href: `/sell/${saved.id}` } }, "error");
      setSaving(false);
      setProgress(null);
      router.push(`/sell/${saved.id}`);
      return;
    }

    const photoCount = (saved.hasImage ? 1 : 0) + saved.images.length;
    notify({
      title: editing ? "Changes saved" : "Product added",
      text: [
        editing ? `“${saved.name}”` : t("“{name}” is on sale now", { name: saved.name }),
        tn(photoCount, "{n} photo", "{n} photos"),
        tn(saved.stock, "{n} in stock", "{n} in stock"),
      ].join(" · "),
      image: saved.imageUrl,
      action: { label: "View product", href: `/products/${saved.id}` },
    });
    router.push(`/products/${saved.id}`);
  }

  async function remove() {
    if (!product) return;
    const yes = await confirm({
      title: t("Delete “{name}”?", { name: product.name }),
      text: "It disappears from the shop right away. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!yes) return;
    try {
      await api.products.remove(product.id);
      notify({ title: "Product deleted", text: t("“{name}” is no longer in the shop.", { name: product.name }), kind: "info" });
      router.push("/sell");
    } catch (err) {
      notify({ title: "Couldn't delete the product", text: t(errorMessage(err)) }, "error");
    }
  }

  const label = "mb-1.5 flex items-center justify-between gap-3 text-sm font-medium";

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-8">
        <Section n={1} title="Photos" hint="The first photo is the cover buyers see first. Add up to 11.">
          <PhotoManager photos={photos} onChange={setPhotos} error={errors.image ?? errors.images} />
        </Section>

        <Section n={2} title="Name & description" hint="A clear name and a few honest lines sell better than a long story.">
          <div className="space-y-5">
            <label className="block">
              <span className={label}>
                {t("Name")}
                <Counter value={name.length} max={NAME_MAX} />
              </span>
              <input
                value={name}
                maxLength={NAME_MAX}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                placeholder={t("Oversize Hoodie")}
                aria-invalid={Boolean(errors.name)}
                className={`${INPUT} ${errors.name ? "border-danger" : ""}`}
              />
              {errors.name && <span className="mt-1 block text-sm text-danger">{t(errors.name)}</span>}
            </label>
            <label className="block">
              <span className={label}>
                {t("Description")}
                <Counter value={description.length} max={DESCRIPTION_MAX} />
              </span>
              <textarea
                value={description}
                maxLength={DESCRIPTION_MAX}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder={t("Material, fit, care…")}
                className={`${INPUT} h-auto resize-y py-2.5 leading-relaxed`}
              />
              {errors.description && <span className="mt-1 block text-sm text-danger">{t(errors.description)}</span>}
            </label>
            <fieldset>
            <legend className={label}>{t("Category")}</legend>
            <p className="-mt-1 mb-2.5 text-sm text-muted">{t("Where buyers will find it in the shop.")}</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${category === c ? "border-fg bg-fg text-surface" : "border-line hover:border-fg"}`}
                >
                  {t(CATEGORY_LABELS[c])}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        </Section>

        <Section n={3} title="Price & stock">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className={label}>{t("Price")}</span>
              <span
                className={`flex h-11 items-center rounded-lg border bg-soft transition-shadow focus-within:border-brand focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand/20 ${
                  errors.price ? "border-danger" : "border-line"
                }`}
              >
                <input
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value.replace(/[^\d.]/g, ""));
                    clearError("price");
                  }}
                  inputMode="decimal"
                  placeholder="249000"
                  aria-invalid={Boolean(errors.price)}
                  className="h-full min-w-0 flex-1 bg-transparent px-3.5 font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted"
                />
                <span className="pr-3.5 text-sm font-medium text-muted">сум</span>
              </span>
              {errors.price ? (
                <span className="mt-1 block text-sm text-danger">{t(errors.price)}</span>
              ) : (
                Number(price) > 0 && <span className="mt-1 block text-sm text-muted">{formatPrice(Number(price))}</span>
              )}
            </label>
            <div>
              <span className={label}>{t("How many do you have?")}</span>
              <Stepper value={stock} onChange={setStock} invalid={Boolean(errors.stock)} />
              {errors.stock && <span className="mt-1 block text-sm text-danger">{t(errors.stock)}</span>}
            </div>
          </div>
        </Section>

        <Section n={4} title="Sizes" hint="Leave empty if the product has no sizes.">
          <SizePicker value={sizes} onChange={setSizes} />
          {errors.sizes && <p className="mt-1 text-sm text-danger">{t(errors.sizes)}</p>}
        </Section>

        <Section n={5} title="Colors" hint="Buyers pick one of these when they order.">
          <ColorPicker value={colors} onChange={setColors} />
          {errors.colors && <p className="mt-1 text-sm text-danger">{t(errors.colors)}</p>}
        </Section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <Preview cover={photos[0] && photoUrl(photos[0])} name={name.trim()} price={price} stock={stock} colors={colors} />

        <div className="px-1 pt-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold tracking-[0.15em] text-muted uppercase">{t("Ready to publish")}</p>
            <span className="text-xs font-semibold tabular-nums">
              {ready}/{checklist.length}
            </span>
          </div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-soft">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(ready / checklist.length) * 100}%` }} />
          </div>
          <ul className="space-y-2 text-sm">
            {checklist.map((c) => (
              <li key={c.label} className={`flex items-center gap-2.5 ${c.done ? "" : "text-muted"}`}>
                <span className={`grid size-5 place-items-center rounded-full transition ${c.done ? "bg-emerald-500 text-white" : "border-2 border-line"}`}>
                  {c.done && <Icon name="check" className="size-3" />}
                </span>
                {t(c.label)}
              </li>
            ))}
          </ul>
        </div>

        {progress !== null && (
          <div className="px-1 pb-2">
            <BagProgress value={progress} label={t("Uploading photos")} />
            <p className="mt-4 text-center text-sm text-muted">{t(progress < 100 ? "Uploading photos…" : "Photos uploaded")}</p>
          </div>
        )}

        <ErrorBox message={general} />
        <div className="space-y-2">
          <button type="submit" disabled={saving} className={`${BUTTON} h-12 w-full text-base`}>
            {t(saving ? "Saving…" : editing ? "Save changes" : "Publish product")}
          </button>
          <button type="button" onClick={() => router.back()} disabled={saving} className={`${BUTTON_SECONDARY} w-full`}>
            {t("Cancel")}
          </button>
          {editing && (
            <button type="button" onClick={remove} disabled={saving} className={`${BUTTON_DANGER} w-full`}>
              <Icon name="trash" className="size-4" /> {t("Delete product")}
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}
