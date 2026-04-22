import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  status?: string;
  filter?: string;
  page?: string;
};

const PAGE_SIZE = 50;

async function fetchMembers(sp: SearchParams) {
  const svc = createServiceRoleClient();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = svc
    .from("members_with_sub_status")
    .select("*", { count: "exact" })
    .order("member_code", { ascending: true })
    .range(from, to);

  if (sp.q) {
    // ILIKE on name + phone + member_code
    query = query.or(
      `full_name.ilike.%${sp.q}%,phone.ilike.%${sp.q}%,member_code.ilike.%${sp.q}%,city.ilike.%${sp.q}%,pin_code.ilike.%${sp.q}%`
    );
  }

  if (sp.status && sp.status !== "all") {
    query = query.eq("status", sp.status);
  }

  if (sp.filter === "expiring") {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    query = query
      .eq("current_subscription_type", "annual")
      .gte("current_subscription_end", today)
      .lte("current_subscription_end", in30);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0, page };
}

function statusBadge(effective: string | null) {
  switch (effective) {
    case "life_active":
      return <Badge variant="success">Life member</Badge>;
    case "annual_active":
      return <Badge variant="success">Active</Badge>;
    case "annual_expired":
      return <Badge variant="danger">Expired</Badge>;
    case "no_subscription":
      return <Badge variant="muted">No subscription</Badge>;
    case "cancelled":
      return <Badge variant="muted">Cancelled</Badge>;
    default:
      return <Badge variant="muted">{effective ?? "—"}</Badge>;
  }
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { rows, total, page } = await fetchMembers(sp);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {total.toLocaleString("en-IN")} total
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/members/new">
            <Plus className="h-4 w-4" />
            New member
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3" action="/admin/members" method="get">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium">Search</label>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Name, phone, code, city, PIN…"
                className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Status</label>
              <select
                name="status"
                defaultValue={sp.status ?? "all"}
                className="mt-1 h-9 rounded-md border px-3 text-sm"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="deceased">Deceased</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Filter</label>
              <select
                name="filter"
                defaultValue={sp.filter ?? ""}
                className="mt-1 h-9 rounded-md border px-3 text-sm"
              >
                <option value="">None</option>
                <option value="expiring">Expiring in 30 days</option>
              </select>
            </div>
            <Button type="submit" size="sm">Apply</Button>
            {(sp.q || sp.status || sp.filter) && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/members">Clear</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-[var(--color-muted)]">
                <tr className="text-left">
                  <th className="p-3 font-medium">Code</th>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">City</th>
                  <th className="p-3 font-medium">PIN</th>
                  <th className="p-3 font-medium">Phone</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Expiry</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[var(--color-muted-foreground)]">
                      No members found.
                    </td>
                  </tr>
                )}
                {rows.map((m: Record<string, unknown>) => (
                  <tr key={m.id as string} className="border-b hover:bg-[var(--color-accent)]">
                    <td className="p-3 font-mono text-xs">{m.member_code as string}</td>
                    <td className="p-3">
                      <Link
                        href={`/admin/members/${m.id}`}
                        className="font-medium hover:underline"
                      >
                        {(m.title as string) ?? ""} {m.full_name as string}
                      </Link>
                    </td>
                    <td className="p-3">{(m.city as string) ?? "—"}</td>
                    <td className="p-3">{(m.pin_code as string) ?? "—"}</td>
                    <td className="p-3">{(m.phone as string) ?? "—"}</td>
                    <td className="p-3">{statusBadge(m.effective_status as string)}</td>
                    <td className="p-3">
                      {m.current_subscription_end
                        ? new Date(m.current_subscription_end as string).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-[var(--color-muted-foreground)]">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/members?${new URLSearchParams({ ...sp, page: String(page - 1) } as Record<string, string>)}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/members?${new URLSearchParams({ ...sp, page: String(page + 1) } as Record<string, string>)}`}>
                  Next
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
