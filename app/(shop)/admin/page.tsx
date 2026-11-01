"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { SOURCE_LABELS } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Source, UserStats } from "@/lib/shoplink";
import { AdminGate, CountBars, DailyChart, StatTile } from "@/components/admin";
import { useSession } from "@/components/session";
import { ErrorBox, PageTitle, Skeleton } from "@/components/ui";

function Overview() {
  const { t, tn } = useT();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.users.stats(30).then(setStats, (err) => setError(errorMessage(err)));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!stats) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Users" value={stats.totalUsers} sub={t("{customers} customers · {admins} admins", { customers: stats.customers, admins: stats.admins })} />
        <StatTile label="New today" value={stats.registered.today} sub={t("{week} in 7 days · {month} in 30", { week: stats.registered.last7Days, month: stats.registered.last30Days })} />
        <StatTile label="Active today" value={stats.activeUsers.today} sub={t("{week} in 7 days · {month} in 30", { week: stats.activeUsers.last7Days, month: stats.activeUsers.last30Days })} />
        <StatTile label="Logins today" value={stats.logins.today} sub={t("{n} in total", { n: stats.logins.total })} />
      </div>
      <DailyChart daily={stats.daily} />
      <div className="grid gap-6 md:grid-cols-2">
        <CountBars
          title="Where users came from"
          counts={(Object.keys(SOURCE_LABELS) as Source[]).map((s) => ({ label: SOURCE_LABELS[s], value: stats.bySource[s] }))}
        />
        <CountBars
          title="How people log in"
          counts={[
            { label: "Registered", value: stats.loginsByMethod.register },
            { label: "Password", value: stats.loginsByMethod.password },
            { label: "Telegram", value: stats.loginsByMethod.telegram },
            { label: "TikTok", value: stats.loginsByMethod.tiktok },
            { label: "Instagram", value: stats.loginsByMethod.instagram },
          ]}
        />
      </div>
      <p className="text-sm text-muted">
        {tn(stats.neverLoggedIn, "{n} user has never logged in after registering.", "{n} users have never logged in after registering.")}{" "}
        {t("Days are counted in {zone}.", { zone: stats.timeZone })}
      </p>
    </div>
  );
}

export default function AdminPage() {
  const { t } = useT();
  const { user } = useSession();
  return (
    <>
      <PageTitle sub={user ? t("Signed in as {name}", { name: user.name }) : undefined}>Admin</PageTitle>
      <AdminGate>
        <Overview />
      </AdminGate>
    </>
  );
}
