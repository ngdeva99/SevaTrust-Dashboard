import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("payments")
    .select("id, amount_inr, method, purpose, received_at, receipt_number, reference, member_id, members(member_code, full_name, title)")
    .order("received_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <Button asChild>
          <Link href="/admin/payments/new">
            <Plus className="h-4 w-4" />
            Record payment
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-[var(--color-muted)]">
                <tr className="text-left">
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Receipt</th>
                  <th className="p-3 font-medium">Member</th>
                  <th className="p-3 font-medium">Purpose</th>
                  <th className="p-3 font-medium">Method</th>
                  <th className="p-3 font-medium">Amount</th>
                  <th className="p-3 font-medium">Ref</th>
                </tr>
              </thead>
              <tbody>
                {(!data || data.length === 0) && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[var(--color-muted-foreground)]">
                      No payments yet.
                    </td>
                  </tr>
                )}
                {data?.map((p) => {
                  const mem = (p.members as unknown) as { member_code?: string; full_name?: string; title?: string } | null;
                  return (
                    <tr key={p.id} className="border-b hover:bg-[var(--color-accent)]">
                      <td className="p-3">{new Date(p.received_at).toLocaleDateString("en-IN")}</td>
                      <td className="p-3 font-mono text-xs">{p.receipt_number ?? "—"}</td>
                      <td className="p-3">
                        {mem ? (
                          <Link className="hover:underline" href={`/admin/members/${p.member_id}`}>
                            <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
                              {mem.member_code}
                            </span>{" "}
                            {mem.title} {mem.full_name}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="p-3">
                        <Badge variant="muted">{p.purpose}</Badge>
                      </td>
                      <td className="p-3">{p.method}</td>
                      <td className="p-3">₹{(p.amount_inr / 100).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-xs">{p.reference ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
