import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Edit } from "lucide-react";
import RegenerateTokenButton from "./regenerate-token-button";
import CopyLinkButton from "./copy-link-button";

export const dynamic = "force-dynamic";

async function getMember(id: string) {
  const svc = createServiceRoleClient();
  const { data: member } = await svc
    .from("members")
    .select("*")
    .eq("id", id)
    .single();
  if (!member) return null;

  const [{ data: subs }, { data: payments }, { data: orders }, { data: audit }] =
    await Promise.all([
      svc.from("subscriptions").select("*").eq("member_id", id).order("start_date", { ascending: false }),
      svc.from("payments").select("*").eq("member_id", id).order("received_at", { ascending: false }),
      svc.from("orders").select("*").eq("member_id", id).order("created_at", { ascending: false }),
      svc
        .from("audit_log")
        .select("id, action, entity_type, before_json, after_json, created_at, admin_id")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  return { member, subs: subs ?? [], payments: payments ?? [], orders: orders ?? [], audit: audit ?? [] };
}

function formatRupees(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function subStatusBadge(sub: { type: string; status: string; end_date: string | null }) {
  if (sub.status === "cancelled") return <Badge variant="muted">Cancelled</Badge>;
  if (sub.status === "expired") return <Badge variant="danger">Expired</Badge>;
  if (sub.type === "life_member") return <Badge variant="success">Life</Badge>;
  const today = new Date().toISOString().slice(0, 10);
  if (sub.end_date && sub.end_date < today) return <Badge variant="danger">Expired</Badge>;
  return <Badge variant="success">Active</Badge>;
}

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getMember(id);
  if (!data) notFound();
  const { member, subs, payments, orders, audit } = data;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const statusLink = `${siteUrl}/m/${member.access_token}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {member.title} {member.full_name}
            </h1>
            <span className="font-mono text-sm text-[var(--color-muted-foreground)]">
              {member.member_code}
            </span>
            <Badge variant={member.status === "active" ? "success" : "muted"}>
              {member.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Created {new Date(member.created_at).toLocaleDateString("en-IN")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/admin/payments/new?member=${member.id}`}>
              <CreditCard className="h-4 w-4" />
              Record payment
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/members/${member.id}/edit`}>
              <Edit className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: overview */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Contact & address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Phone" value={member.phone} />
              <Row label="Email" value={member.email} />
              <Row
                label="Address"
                value={
                  [member.address_line1, member.address_line2, member.address_line3]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
              <Row
                label="City / State / PIN"
                value={`${member.city ?? "—"} / ${member.state ?? "—"} / ${member.pin_code ?? "—"}`}
              />
              <Row label="Country" value={member.country} />
              <Row label="Preferred language" value={member.default_language} />
              <Row label="Copies per issue" value={member.diary_copies?.toString()} />
              <Row
                label="PAN"
                value={member.pan_last4 ? `XXXXX XX${member.pan_last4}` : "—"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {subs.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  No subscriptions yet. Record a payment to create one.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b text-left">
                    <tr>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Start</th>
                      <th className="pb-2 font-medium">End</th>
                      <th className="pb-2 font-medium">Years</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2">{s.type === "life_member" ? "Life" : "Annual"}</td>
                        <td className="py-2">{new Date(s.start_date).toLocaleDateString("en-IN")}</td>
                        <td className="py-2">
                          {s.end_date ? new Date(s.end_date).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="py-2">{s.years_paid}</td>
                        <td className="py-2">{formatRupees(s.amount_paid_inr)}</td>
                        <td className="py-2">{subStatusBadge(s)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment history</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">No payments recorded.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b text-left">
                    <tr>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Method</th>
                      <th className="pb-2 font-medium">Purpose</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">{new Date(p.received_at).toLocaleDateString("en-IN")}</td>
                        <td className="py-2">{p.method}</td>
                        <td className="py-2">{p.purpose}</td>
                        <td className="py-2">{formatRupees(p.amount_inr)}</td>
                        <td className="py-2 font-mono text-xs">{p.receipt_number ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {member.internal_notes && (
            <Card>
              <CardHeader>
                <CardTitle>Internal notes</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {member.internal_notes}
                </pre>
              </CardContent>
            </Card>
          )}

          {member.legacy_raw_text && (
            <Card>
              <CardHeader>
                <CardTitle>Legacy import source</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs font-mono text-[var(--color-muted-foreground)]">
                  {member.legacy_raw_text}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: actions and audit */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status page link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md bg-[var(--color-muted)] p-2 font-mono text-xs break-all">
                {statusLink}
              </div>
              <div className="flex gap-2">
                <CopyLinkButton link={statusLink} />
                <RegenerateTokenButton memberId={member.id} />
              </div>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Share this link with the member via SMS or email. Anyone with this link can
                view status and renew online. Regenerating invalidates the old link.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">No book orders.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {orders.map((o) => (
                    <li key={o.id} className="flex justify-between">
                      <span className="font-mono text-xs">{o.order_code}</span>
                      <span>{formatRupees(o.total_amount_inr)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">No activity yet.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {audit.map((a) => (
                    <li key={a.id} className="border-b pb-2 last:border-0">
                      <div className="font-medium">{a.action}</div>
                      <div className="text-[var(--color-muted-foreground)]">
                        {new Date(a.created_at).toLocaleString("en-IN")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <div className="text-[var(--color-muted-foreground)]">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}
