import Link from "next/link";
import type { Route } from "next";
import { Users, Clock, IndianRupee, Package } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function getStats() {
  const svc = createServiceRoleClient();

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const [activeMembers, expiringSoon, monthPayments, pendingOrders] = await Promise.all([
    svc.from("members").select("id", { count: "exact", head: true }).eq("status", "active"),
    svc
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("type", "annual")
      .gte("end_date", today)
      .lte("end_date", in30),
    svc
      .from("payments")
      .select("amount_inr")
      .gte("received_at", firstOfMonth.toISOString()),
    svc
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "paid"),
  ]);

  const monthTotalPaise =
    monthPayments.data?.reduce((sum, p) => sum + (p.amount_inr ?? 0), 0) ?? 0;

  return {
    activeMembers: activeMembers.count ?? 0,
    expiringSoon: expiringSoon.count ?? 0,
    monthTotalRupees: Math.round(monthTotalPaise / 100),
    pendingOrders: pendingOrders.count ?? 0,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active members"
          value={stats.activeMembers.toString()}
          icon={<Users className="h-4 w-4" />}
          href="/admin/members"
        />
        <StatCard
          label="Expiring in 30 days"
          value={stats.expiringSoon.toString()}
          icon={<Clock className="h-4 w-4" />}
          href="/admin/members?filter=expiring"
        />
        <StatCard
          label="Collected this month"
          value={`₹${stats.monthTotalRupees.toLocaleString("en-IN")}`}
          icon={<IndianRupee className="h-4 w-4" />}
          href="/admin/payments"
        />
        <StatCard
          label="Orders to ship"
          value={stats.pendingOrders.toString()}
          icon={<Package className="h-4 w-4" />}
          href="/admin/books"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Run the schema migrations in Supabase (see <code>README.md</code>).</li>
            <li>
              Import the legacy member list: run the Python parser, review the CSV,
              then run <code>pnpm import-members</code>.
            </li>
            <li>Open the <Link className="underline" href="/admin/members">members list</Link> and verify the import.</li>
            <li>Record payments for any new members as they come in.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  href: Route;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-[var(--color-accent)]">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--color-muted-foreground)]">{label}</div>
            {icon}
          </div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
