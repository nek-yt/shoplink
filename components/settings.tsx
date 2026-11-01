"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage, splitErrors } from "@/lib/errors";
import { formatDate, SOURCE_LABELS } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { ProfileUpdate, Source, User } from "@/lib/shoplink";
import { cleanUsername, isEmail, isPhone, USERNAME_MAX, usernameProblem } from "@/lib/validation";
import { Icon, LogoFull, type IconName } from "./icons";
import { LanguageSwitch } from "./language";
import { useSession } from "./session";
import { useTheme, type ThemeChoice } from "./theme";
import { BUTTON, BUTTON_SECONDARY, ErrorBox, FormRow, INPUT } from "./ui";

const PROFILE_FIELDS = ["name", "email", "phone", "source", "socialUsername"] as const;

/** A titled block inside a settings tab, split from the next by a hairline. Plain title and text are translated here. */
export function SettingsCard({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <section className="border-t border-line pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold">{t(title)}</h2>
      {text && <p className="mt-0.5 text-sm text-muted">{t(text)}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function AvatarEditor({ user }: { user: User }) {
  const { t } = useT();
  const { setUser, notify } = useSession();
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<User>, done: string) {
    setBusy(true);
    try {
      setUser(await action());
      notify(done);
    } catch (err) {
      notify(errorMessage(err), "error");
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={api.assetUrl(user.avatarUrl)} alt="" className={`size-24 rounded-full border border-line object-cover ${busy ? "opacity-50" : ""}`} />
      <div className="space-y-2">
        <label className={`${BUTTON_SECONDARY} cursor-pointer`}>
          <Icon name="upload" className="size-4" /> {t(user.hasAvatar ? "Change picture" : "Upload picture")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) return notify("The picture must be 5 MB or smaller", "error");
              run(() => api.auth.uploadAvatar(file), "Picture updated");
            }}
          />
        </label>
        {user.hasAvatar && (
          <button type="button" disabled={busy} onClick={() => run(api.auth.removeAvatar, "Picture removed")} className="block text-sm font-medium text-danger hover:underline">
            {t("Remove picture")}
          </button>
        )}
        <p className="text-sm text-muted">{t("JPEG, PNG, WebP or GIF, up to 5 MB.")}</p>
      </div>
    </div>
  );
}

/**
 * Username like on TikTok / YouTube: lowercase, no spaces, only letters, numbers and - _ .
 * Anything else is dropped while typing, and the rules are checked again on save.
 */
function UsernameField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const { t } = useT();
  const problem = usernameProblem(value);
  const shown = error ?? (value ? problem : null);
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{t("Username")}</span>
      <div
        className={`flex h-11 items-center rounded-lg border bg-soft transition-shadow focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand/20 ${
          shown ? "border-danger" : "border-line focus-within:border-brand"
        }`}
      >
        <span className="pl-3.5 font-semibold text-muted">@</span>
        <input
          name="socialUsername"
          value={value}
          onChange={(e) => onChange(cleanUsername(e.target.value))}
          maxLength={USERNAME_MAX}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="aziza.style"
          aria-invalid={Boolean(shown)}
          className="h-full min-w-0 flex-1 bg-transparent px-1 outline-none placeholder:text-muted"
        />
        <span className="pr-3 text-xs text-muted tabular-nums">
          {value.length}/{USERNAME_MAX}
        </span>
      </div>
      {shown ? (
        <span className="mt-1 block text-sm text-danger">{t(shown)}</span>
      ) : (
        <span className="mt-1 block text-sm text-muted">{t("Lowercase letters, numbers, and - _ . only. No spaces.")}</span>
      )}
    </div>
  );
}

/** Picture, name, username, contacts and where the customer found the shop. */
export function AccountSettings({ user }: { user: User }) {
  const { t, locale } = useT();
  const { setUser, notify } = useSession();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Old usernames may break today's rules (spaces, capitals); they're cleaned the same way when shown.
  const [username, setUsername] = useState(cleanUsername(user.socialUsername ?? ""));

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const text = (k: string) => String(data.get(k) ?? "").trim();
    const update: ProfileUpdate = {
      name: text("name"),
      email: text("email") || null,
      phone: text("phone") || null,
      source: text("source") as Source,
      socialUsername: username || null,
    };

    const invalid: Record<string, string> = {};
    if (!update.name) invalid.name = "Enter your name";
    if (update.email && !isEmail(update.email)) invalid.email = "Enter a valid email";
    if (update.phone && !isPhone(update.phone)) invalid.phone = "Enter a valid phone number, e.g. +998901234567";
    const usernameError = usernameProblem(username);
    if (usernameError) invalid.socialUsername = usernameError;
    // Accounts with a password log in with their email or phone, so one of them has to stay.
    if (!update.email && !update.phone && !user.telegramId && !user.tiktokId && !user.instagramId) {
      invalid.email = "Keep an email or a phone number to log in with";
    }
    if (Object.keys(invalid).length) {
      setErrors(invalid);
      notify({ title: "Check the marked fields", kind: "error" });
      return;
    }

    setErrors({});
    setGeneral(null);
    setSaving(true);
    try {
      setUser(await api.auth.updateMe(update));
      notify({ title: "Profile saved", text: username ? `@${username}` : undefined });
    } catch (err) {
      const split = splitErrors(err, PROFILE_FIELDS);
      setErrors(split.fields);
      setGeneral(split.general);
    }
    setSaving(false);
  }

  const memberSince = t("Member since {date}", { date: formatDate(user.createdAt, locale) });

  return (
    <div className="space-y-8">
      <SettingsCard title="Profile picture">
        <AvatarEditor user={user} />
      </SettingsCard>
      <SettingsCard title="Your details" text={user.role === "admin" ? `${memberSince} · ${t("Admin")}` : memberSince}>
        <form onSubmit={save} noValidate className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormRow label="Name" error={errors.name}>
              <input name="name" defaultValue={user.name} autoComplete="name" className={INPUT} />
            </FormRow>
            <UsernameField
              value={username}
              onChange={(v) => {
                setUsername(v);
                setErrors((current) => {
                  const rest = { ...current };
                  delete rest.socialUsername;
                  return rest;
                });
              }}
              error={errors.socialUsername}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormRow label="Email" error={errors.email}>
              <input name="email" type="email" defaultValue={user.email ?? ""} autoComplete="email" className={INPUT} />
            </FormRow>
            <FormRow label="Phone" error={errors.phone}>
              <input name="phone" defaultValue={user.phone ?? ""} placeholder="+998 90 123 45 67" autoComplete="tel" className={INPUT} />
            </FormRow>
          </div>
          <FormRow label="Where did you find us?" error={errors.source}>
            <select name="source" defaultValue={user.source} className={`${INPUT} sm:max-w-xs`}>
              {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
                <option key={s} value={s}>
                  {t(SOURCE_LABELS[s])}
                </option>
              ))}
            </select>
          </FormRow>
          <ErrorBox message={general} />
          <button type="submit" disabled={saving} className={BUTTON}>
            {t(saving ? "Saving…" : "Save changes")}
          </button>
        </form>
      </SettingsCard>
    </div>
  );
}

const THEMES: { value: ThemeChoice; label: string; icon: IconName; text: string }[] = [
  { value: "light", label: "Light", icon: "sun", text: "White pages" },
  { value: "dark", label: "Dark", icon: "moon", text: "Easy on the eyes at night" },
  { value: "system", label: "System", icon: "monitor", text: "Follow this device" },
];

/** Language, light / dark / system. Saved in this browser only, so it works without an account. */
export function AppearanceSettings() {
  const { t } = useT();
  const { choice, setTheme } = useTheme();
  return (
    <div className="space-y-8">
      <SettingsCard title="Language" text="The whole shop switches right away. Saved on this device.">
        <LanguageSwitch large />
      </SettingsCard>
      <SettingsCard title="Theme" text="The logo and every page switch with it. Saved on this device.">
        <div role="radiogroup" aria-label={t("Theme")} className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((theme) => {
            const selected = choice === theme.value;
            return (
              <button
                key={theme.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(theme.value)}
                className={`rounded-xl border-2 p-4 text-left transition hover:-translate-y-0.5 ${
                  selected ? "border-brand bg-brand/5" : "border-line hover:border-muted"
                }`}
              >
                {/* Small preview of the shop in that theme. */}
                <span
                  className={`mb-3 block overflow-hidden rounded-lg border border-line bg-raised ${
                    theme.value === "dark"
                      ? "bg-[#0f0e1c]"
                      : theme.value === "light"
                        ? "bg-white"
                        : "bg-linear-to-r from-white from-50% to-[#0f0e1c] to-50%"
                  }`}
                >
                  <span className="flex h-16 items-end gap-1.5 p-2">
                    <span className="h-full w-3 rounded bg-[#3b2bd9]/70" />
                    <span className="h-3/4 flex-1 rounded bg-tangerine/70" />
                    <span className="h-1/2 flex-1 rounded bg-[#9b9ab2]/50" />
                  </span>
                </span>
                <span className="flex items-center gap-2 font-semibold">
                  <Icon name={theme.icon} className="size-5" />
                  {t(theme.label)}
                  {selected && <Icon name="check" className="ml-auto size-5 text-brand" />}
                </span>
                <span className="mt-0.5 block text-sm text-muted">{t(theme.text)}</span>
              </button>
            );
          })}
        </div>
      </SettingsCard>
      <SettingsCard title="Logo" text="How the ShopLink logo looks right now.">
        <div className="flex flex-wrap items-center gap-6 rounded-lg bg-soft px-6 py-5">
          <LogoFull className="scale-125" />
        </div>
      </SettingsCard>
    </div>
  );
}

// Everything here describes how the ShopLink backend actually behaves.
const FAQ: { q: string; a: string; link?: { label: string; href: string } }[] = [
  {
    q: "How do I order?",
    a: "Pick a size and color on a product, add it to your cart, then enter your delivery address and press “Place order”. You need an account — registering takes a minute.",
    link: { label: "Open the cart", href: "/cart" },
  },
  {
    q: "How do I follow my order?",
    a: "Every order gets its own number, like SL-7K3F9QX2. Find it in My orders. An order goes New → Confirmed → Shipped → Delivered.",
    link: { label: "My orders", href: "/orders" },
  },
  {
    q: "Can I cancel an order?",
    a: "Yes, while it is still “New”: open the order and press “Cancel order”. Once the shop has confirmed it, ask the shop to cancel it for you.",
  },
  {
    q: "Can I order the same things again?",
    a: "Yes. Press “Buy again” on any order and its items go back into your cart, with the same sizes and colors.",
  },
  {
    q: "What if a product sells out while it's in my cart?",
    a: "The cart marks it, and you can lower the quantity or remove it before ordering. Stock is held for you the moment you place the order.",
  },
  {
    q: "I found you on Instagram, TikTok or Telegram",
    a: "Great — pick that platform in your account, and add your username so people can find you with @username.",
    link: { label: "Account", href: "/settings?tab=account" },
  },
  {
    q: "How do I sell my own products?",
    a: "Open Add product and fill in a picture (JPEG, PNG, WebP or GIF, up to 5 MB), price, stock, sizes and colors. It appears in the shop right away, and orders for it show up in My sales.",
    link: { label: "Add product", href: "/sell/new" },
  },
  {
    q: "What's the wishlist for?",
    a: "Tap the heart on any product to save it for later. Your saved products are in the wishlist.",
    link: { label: "Wishlist", href: "/wishlist" },
  },
];

/** Questions and answers (used to be its own Help page). */
export function HelpSettings() {
  const { t } = useT();
  return (
    <SettingsCard title="Help" text="Answers to the most common questions">
      <div className="divide-y divide-line rounded-lg border border-line bg-raised">
        {FAQ.map((item) => (
          <details key={item.q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {t(item.q)}
              <span className="text-xl text-muted transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-muted">{t(item.a)}</p>
            {item.link && (
              <Link href={item.link.href} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                {t(item.link.label)} <Icon name="arrowRight" className="size-3.5" />
              </Link>
            )}
          </details>
        ))}
      </div>
    </SettingsCard>
  );
}
