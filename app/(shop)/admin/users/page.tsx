"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatDateTime, SOURCE_LABELS } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { AdminUser, AdminUserDetail, Page, Role, Source } from "@/lib/shoplink";
import { AdminGate } from "@/components/admin";
import { Icon } from "@/components/icons";
import { BUTTON, EmptyState, ErrorBox, INPUT, PageTitle, Pagination, Skeleton } from "@/components/ui";

type Sort = "newest" | "oldest" | "lastLogin" | "mostLogins" | "name";
const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "lastLogin", label: "Last login" },
  { value: "mostLogins", label: "Most logins" },
  { value: "name", label: "Name" },
];
const SELECT = "h-11 rounded-lg border border-line bg-surface px-3 outline-none focus:border-brand";

function UserDetails({ id }: { id: number }) {
  const { t, locale } = useT();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.users.get(id).then(setDetail, (err) => setError(errorMessage(err)));
  }, [id]);
  if (error) return <ErrorBox message={error} />;
  if (!detail) return <Skeleton className="h-24 w-full" />;
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <dl className="space-y-1.5">
        <div>
          <dt className="inline text-muted">{t("Phone")}: </dt>
          <dd className="inline">{detail.phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline text-muted">{t("Username")}: </dt>
          <dd className="inline">{detail.socialUsername ? `@${detail.socialUsername}` : "—"}</dd>
        </div>
        <div>
          <dt className="inline text-muted">{t("Registered")}: </dt>
          <dd className="inline">{formatDate(detail.createdAt, locale)}</dd>
        </div>
      </dl>
      <div>
        <p className="mb-1.5 font-medium">{t("Recent logins")}</p>
        {detail.recentLogins.length === 0 ? (
          <p className="text-muted">{t("None")}</p>
        ) : (
          <ul className="space-y-1">
            {detail.recentLogins.slice(0, 8).map((l) => (
              <li key={l.id} className="flex justify-between gap-4">
                <span>{formatDateTime(l.createdAt, locale)}</span>
                <span className="text-muted">{t(l.method === "register" ? "Registered" : l.method === "password" ? "Password" : l.method)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Users() {
  const { t, tn, locale } = useT();
  // ?search=…&open=<id> comes from picking a user in the top search bar.
  const params = useSearchParams();
  const [filters, setFilters] = useState<{ search?: string; source?: Source; role?: Role; sort: Sort }>(() => ({
    sort: "newest",
    search: params.get("search") || undefined,
  }));
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<AdminUser> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(() => Number(params.get("open")) || null);

  useEffect(() => {
    api.users.list({ ...filters, page, limit: 20 }).then(setResult, (err) => setError(errorMessage(err)));
  }, [filters, page]);

  const change = (next: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          change({ search: String(new FormData(e.currentTarget).get("search")).trim() || undefined });
        }}
        className="mb-5 flex flex-wrap gap-2"
      >
        <div className="flex min-w-64 flex-1 gap-2">
          <input name="search" defaultValue={filters.search} placeholder={t("Name, email or phone")} aria-label={t("Search users")} className={INPUT} />
          <button type="submit" className={BUTTON} aria-label={t("Search")}>
            <Icon name="search" className="size-5" />
          </button>
        </div>
        <select aria-label={t("Platform")} value={filters.source ?? ""} onChange={(e) => change({ source: (e.target.value || undefined) as Source })} className={SELECT}>
          <option value="">{t("All platforms")}</option>
          {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
            <option key={s} value={s}>
              {t(SOURCE_LABELS[s])}
            </option>
          ))}
        </select>
        <select aria-label={t("Role")} value={filters.role ?? ""} onChange={(e) => change({ role: (e.target.value || undefined) as Role })} className={SELECT}>
          <option value="">{t("Everyone")}</option>
          <option value="customer">{t("Customers")}</option>
          <option value="admin">{t("Admins")}</option>
        </select>
        <select aria-label={t("Sort")} value={filters.sort} onChange={(e) => change({ sort: e.target.value as Sort })} className={SELECT}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.label)}
            </option>
          ))}
        </select>
      </form>

      <ErrorBox message={error} />
      {!result ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : result.items.length === 0 ? (
        <EmptyState icon="users" title="No users found" />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-raised">
          {result.items.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setOpenId(openId === u.id ? null : u.id)}
                aria-expanded={openId === u.id}
                className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3.5 text-left hover:bg-soft"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={api.assetUrl(u.avatarUrl)} alt="" className="size-10 rounded-full object-cover" />
                <div className="min-w-48 flex-1">
                  <p className="font-medium">
                    {u.name} {u.role === "admin" && <span className="ml-1 rounded bg-brand/10 px-1.5 py-0.5 text-xs font-semibold text-brand">{t("Admin")}</span>}
                  </p>
                  <p className="text-sm text-muted">{u.email ?? u.phone ?? "—"}</p>
                </div>
                <span className="w-24 text-sm">{t(SOURCE_LABELS[u.source])}</span>
                <span className="w-28 text-sm tabular-nums">
                  {tn(u.ordersCount, "{n} order", "{n} orders")}
                </span>
                <span className="w-44 text-sm text-muted">{u.lastLoginAt ? t("Last login {date}", { date: formatDateTime(u.lastLoginAt, locale) }) : t("Never logged in")}</span>
              </button>
              {openId === u.id && (
                <div className="border-t border-line bg-soft/50 px-5 py-4">
                  <UserDetails id={u.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {result && <Pagination page={result.page} pages={result.pages} onPage={setPage} />}
    </>
  );
}

/** Starts the list over when the address changes (e.g. another user picked in the top search bar). */
function UsersFromAddress() {
  return <Users key={useSearchParams().toString()} />;
}

export default function AdminUsersPage() {
  return (
    <>
      <PageTitle sub="Everyone with an account, their logins and orders">Admin</PageTitle>
      <AdminGate>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
          <UsersFromAddress />
        </Suspense>
      </AdminGate>
    </>
  );
}
