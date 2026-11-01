"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { COLORS, colorHex, SIZE_GROUPS } from "@/lib/options";
import { Icon } from "./icons";

const CHIP = "h-9 min-w-11 rounded-md border px-2.5 text-sm font-medium transition active:scale-95";
const chip = (on: boolean) => `${CHIP} ${on ? "border-brand bg-brand text-white shadow-sm" : "border-line hover:border-fg"}`;

const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** A round color swatch; unknown color names get a striped dot. */
export function ColorDot({ name, className = "size-4" }: { name: string; className?: string }) {
  const hex = colorHex(name);
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full border border-black/15 dark:border-white/20 ${className}`}
      style={{ background: hex ?? "repeating-linear-gradient(45deg,#c9c9d2 0 3px,#8f8fa0 3px 6px)" }}
    />
  );
}

/** "3 selected · Clear" line above a picker. `selected` and `empty` are already translated. */
function Summary({ count, selected, empty, onClear }: { count: number; selected: string; empty: string; onClear: () => void }) {
  const { t } = useT();
  return (
    <p className="mb-2 flex items-center gap-2 text-sm">
      <span className={count ? "font-semibold text-brand" : "text-muted"}>{count ? selected : empty}</span>
      {count > 0 && (
        <button type="button" onClick={onClear} className="text-muted underline hover:text-fg">
          {t("Clear")}
        </button>
      )}
    </p>
  );
}

/** Small "add your own" field under a picker. */
function AddOwn({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const { t } = useT();
  const [text, setText] = useState("");
  const add = () => {
    const value = text.trim();
    if (value) onAdd(value);
    setText("");
  };
  return (
    <div className="mt-3 flex max-w-xs gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault(); // don't submit the product form
            add();
          }
        }}
        placeholder={placeholder}
        className="h-9 min-w-0 flex-1 rounded-md border border-line bg-soft px-3 text-sm outline-none focus:border-brand focus:bg-surface"
      />
      <button type="button" onClick={add} className="inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 text-sm font-medium hover:border-fg">
        <Icon name="plus" className="size-4" /> {t("Add")}
      </button>
    </div>
  );
}

export function SizePicker({ value, onChange }: { value: string[]; onChange: (sizes: string[]) => void }) {
  const { t, tn } = useT();
  const known = new Set(SIZE_GROUPS.flatMap((g) => g.sizes));
  const own = value.filter((s) => !known.has(s));
  return (
    <div>
      <Summary
        count={value.length}
        selected={tn(value.length, "{n} size selected", "{n} sizes selected")}
        empty={t("No sizes — pick any that fit")}
        onClear={() => onChange([])}
      />
      <div className="space-y-4">
        {SIZE_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 text-xs font-bold tracking-wider text-muted uppercase">{t(group.label)}</p>
            <div className="flex flex-wrap gap-2">
              {group.sizes.map((size) => (
                <button key={size} type="button" aria-pressed={value.includes(size)} onClick={() => onChange(toggle(value, size))} className={chip(value.includes(size))}>
                  {size === "One size" ? t(size) : size}
                </button>
              ))}
            </div>
          </div>
        ))}
        {own.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-bold tracking-wider text-muted uppercase">{t("Your own")}</p>
            <div className="flex flex-wrap gap-2">
              {own.map((size) => (
                <button key={size} type="button" aria-pressed onClick={() => onChange(toggle(value, size))} className={chip(true)}>
                  {size} <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <AddOwn placeholder={t("Other size, e.g. 2XS")} onAdd={(s) => !value.includes(s) && onChange([...value, s])} />
      </div>
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: string[]; onChange: (colors: string[]) => void }) {
  const { t, tn } = useT();
  const own = value.filter((c) => !colorHex(c));
  const swatches = [...COLORS.map((c) => c.name), ...own];
  return (
    <div>
      <Summary
        count={value.length}
        selected={tn(value.length, "{n} color selected", "{n} colors selected")}
        empty={t("No colors — pick any that fit")}
        onClear={() => onChange([])}
      />
      <div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-2">
          {swatches.map((name) => {
            const on = value.includes(name);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(toggle(value, name))}
                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-1 py-2 text-xs font-medium capitalize transition active:scale-95 ${
                  on ? "border-brand bg-brand/5" : "border-transparent hover:bg-soft"
                }`}
              >
                <span className="relative">
                  <ColorDot name={name} className="size-8" />
                  {on && (
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid size-5 place-items-center rounded-full bg-brand text-white shadow">
                        <Icon name="check" className="size-3.5" />
                      </span>
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{t(name)}</span>
              </button>
            );
          })}
        </div>
        <AddOwn placeholder={t("Other color, e.g. mint")} onAdd={(c) => !value.includes(c.toLowerCase()) && onChange([...value, c.toLowerCase()])} />
      </div>
    </div>
  );
}

/** − 25 + with quick "+5 / +10" buttons, for how many are in stock. */
export function Stepper({ value, onChange, invalid }: { value: number; onChange: (n: number) => void; invalid?: boolean }) {
  const { t, tn } = useT();
  const set = (n: number) => onChange(Math.max(0, Math.min(1_000_000, Math.round(n))));
  const btn = "grid size-11 place-items-center transition hover:bg-soft active:scale-90 disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={`inline-flex items-center rounded-lg border ${invalid ? "border-danger" : "border-line"}`}>
        <button type="button" onClick={() => set(value - 1)} disabled={value <= 0} aria-label={t("One less")} className={btn}>
          <Icon name="minus" className="size-5" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => set(Number(e.target.value) || 0)}
          aria-label={t("How many in stock")}
          className="h-11 w-20 border-x border-line bg-transparent text-center font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button type="button" onClick={() => set(value + 1)} aria-label={t("One more")} className={btn}>
          <Icon name="plus" className="size-5" />
        </button>
      </div>
      {[5, 10].map((n) => (
        <button key={n} type="button" onClick={() => set(value + n)} className="h-9 rounded-md border border-line px-3 text-sm font-medium transition hover:border-fg active:scale-95">
          +{n}
        </button>
      ))}
      <span className={`text-sm font-medium ${value > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-danger"}`}>
        {value > 0 ? tn(value, "{n} in stock", "{n} in stock") : t("Sold out")}
      </span>
    </div>
  );
}
