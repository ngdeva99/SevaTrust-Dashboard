import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { MembersTable } from "./members-table";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  status?: string;
  filter?: string;
  page?: string;
  sort?: string;
  dir?: string;
};

const PAGE_SIZE = 50;

const SORTABLE_COLUMNS: Record<string, string> = {
  name: "full_name",
  code: "member_code",
  city: "city",
  expiry: "current_subscription_end",
};

async function fetchMembers(sp: SearchParams) {
  const svc = createServiceRoleClient();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const sortCol = SORTABLE_COLUMNS[sp.sort ?? ""] ?? "full_name";
  const ascending = (sp.dir ?? "asc") === "asc";

  let query = svc
    .from("members_with_sub_status")
    .select("*", { count: "exact" })
    .order(sortCol, { ascending })
    .range(from, to);

  if (sp.q) {
    const term = sp.q.replace(/%/g, "");
    query = query.or(
      `full_name.ilike.%${term}%,phone.ilike.%${term}%,member_code.ilike.%${term}%,city.ilike.%${term}%,pin_code.ilike.%${term}%,address_line1.ilike.%${term}%,address_line2.ilike.%${term}%,address_line3.ilike.%${term}%,state.ilike.%${term}%`
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

  if (sp.filter === "life") {
    query = query.eq("current_subscription_type", "life_member");
  }

  if (sp.filter === "expired") {
    query = query.eq("effective_status", "annual_expired");
  }

  if (sp.filter === "no_sub") {
    query = query.eq("effective_status", "no_subscription");
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0, page };
}

function buildParams(sp: SearchParams, overrides: Record<string, string>): string {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v && v !== "all" && v !== "") params.set(k, v);
  }
  return params.toString();
}

function SortHeader({
  label,
  field,
  sp,
}: {
  label: string;
  field: string;
  sp: SearchParams;
}) {
  const isActive = (sp.sort ?? "name") === field;
  const currentDir = sp.dir ?? "asc";
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";
  const arrow = isActive ? (currentDir === "asc" ? " \u2191" : " \u2193") : "";

  return (
    <th className="p-3 font-medium">
      <Link
        href={`/admin/members?${buildParams(sp, { sort: field, dir: nextDir, page: "1" })}`}
        className="hover:underline"
      >
        {label}{arrow}
      </Link>
    </th>
  );
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
            {/* Preserve sort params */}
            {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
            {sp.dir && <input type="hidden" name="dir" value={sp.dir} />}

            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium">Search</label>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Name, phone, code, city, PIN, address, state..."
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
                <option value="life">Life members</option>
                <option value="expiring">Expiring in 30 days</option>
                <option value="expired">Expired</option>
                <option value="no_sub">No subscription</option>
              </select>
            </div>
            <Button type="submit" size="sm">Apply</Button>
            {(sp.q || sp.status || sp.filter) && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/admin/members?${buildParams({}, { sort: sp.sort ?? "", dir: sp.dir ?? "" })}`}>
                  Clear
                </Link>
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
                  <SortHeader label="Code" field="code" sp={sp} />
                  <SortHeader label="Name" field="name" sp={sp} />
                  <SortHeader label="City" field="city" sp={sp} />
                  <th className="p-3 font-medium">PIN</th>
                  <th className="p-3 font-medium">Phone</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Sub</th>
                  <SortHeader label="Expiry" field="expiry" sp={sp} />
                </tr>
              </thead>
            <tbody>
              <MembersTable rows={rows} />
            </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-[var(--color-muted-foreground)]">
            Page {page} of {totalPages} ({total.toLocaleString("en-IN")} members)
          </div>
          <div className="flex gap-1">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/members?${buildParams(sp, { page: "1" })}`}>
                  First
                </Link>
              </Button>
            )}
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/members?${buildParams(sp, { page: String(page - 1) })}`}>
                  Prev
                </Link>
              </Button>
            )}
            {/* Page number buttons */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <Button
                  key={p}
                  asChild={p !== page}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                >
                  {p === page ? (
                    <span>{p}</span>
                  ) : (
                    <Link href={`/admin/members?${buildParams(sp, { page: String(p) })}`}>
                      {p}
                    </Link>
                  )}
                </Button>
              );
            })}
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/members?${buildParams(sp, { page: String(page + 1) })}`}>
                  Next
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/members?${buildParams(sp, { page: String(totalPages) })}`}>
                  Last
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
