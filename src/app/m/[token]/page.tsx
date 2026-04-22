import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function getMemberByToken(token: string) {
  const svc = createServiceRoleClient();
  const { data: member } = await svc
    .from("members")
    .select("*")
    .eq("access_token", token)
    .single();
  if (!member) return null;

  const [{ data: subs }, { data: payments }] = await Promise.all([
    svc
      .from("subscriptions")
      .select("*")
      .eq("member_id", member.id)
      .eq("status", "active")
      .order("start_date", { ascending: false }),
    svc
      .from("payments")
      .select("*")
      .eq("member_id", member.id)
      .order("received_at", { ascending: false })
      .limit(20),
  ]);

  return { member, subs: subs ?? [], payments: payments ?? [] };
}

function formatRupees(paise: number) {
  return "\u20B9" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function displayName(fullName: string): string {
  return fullName
    .replace(/^(Sri\.?\s*|Smt\.?\s*|Shri\.?\s*|Dr\.?\s*|Ms\.?\s*|Mrs\.?\s*|Mr\.?\s*)/i, "")
    .trim();
}

export default async function MemberStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getMemberByToken(token);
  if (!data) notFound();

  const { member, subs, payments } = data;
  const activeSub = subs[0] ?? null;
  const isLife = activeSub?.type === "life_member";
  const today = new Date().toISOString().slice(0, 10);
  const isExpired = activeSub && !isLife && activeSub.end_date && activeSub.end_date < today;
  const expiringIn60 =
    activeSub &&
    !isLife &&
    activeSub.end_date &&
    activeSub.end_date >= today &&
    new Date(activeSub.end_date).getTime() - Date.now() < 60 * 86400_000;
  const canRenew = !isLife && (isExpired || expiringIn60 || !activeSub);

  return (
    <div className="space-y-6">
      {/* Member info */}
      <div>
        <h2 className="text-xl font-semibold">{displayName(member.full_name)}</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {member.member_code}
        </p>
      </div>

      {/* Subscription status */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!activeSub ? (
            <div className="text-center py-4">
              <Badge variant="muted" className="text-sm">No active subscription</Badge>
              <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
                You don&apos;t have an active subscription. Renew to continue receiving publications.
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted-foreground)]">Type</span>
                <Badge variant={isLife ? "success" : isExpired ? "danger" : "success"}>
                  {isLife ? "Life Member" : isExpired ? "Expired" : "Annual - Active"}
                </Badge>
              </div>
              {!isLife && activeSub.end_date && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-muted-foreground)]">Valid until</span>
                  <span className={isExpired ? "text-red-600 font-medium" : ""}>
                    {new Date(activeSub.end_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              {isLife && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-muted-foreground)]">Valid until</span>
                  <span className="text-green-700 font-medium">Lifetime</span>
                </div>
              )}
            </div>
          )}

          {canRenew && (
            <div className="pt-2">
              <Button asChild className="w-full">
                <Link href={`/m/${token}/renew` as never}>Renew Subscription</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Your Details</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href={`/m/${token}/address-change` as never}>Request Change</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Phone" value={member.phone} />
          <Row label="Email" value={member.email} />
          <Row
            label="Address"
            value={
              [member.address_line1, member.address_line2, member.address_line3, member.city, member.state, member.pin_code]
                .filter(Boolean)
                .join(", ") || "\u2014"
            }
          />
          <Row label="Country" value={member.country} />
          <Row label="Language" value={member.default_language} />
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">No payments recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left">
                  <tr>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Purpose</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2">{new Date(p.received_at).toLocaleDateString("en-IN")}</td>
                      <td className="py-2 capitalize">{p.purpose.replace("_", " ")}</td>
                      <td className="py-2">{formatRupees(p.amount_inr)}</td>
                      <td className="py-2 font-mono text-xs">{p.receipt_number ?? "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span>{value || "\u2014"}</span>
    </div>
  );
}
