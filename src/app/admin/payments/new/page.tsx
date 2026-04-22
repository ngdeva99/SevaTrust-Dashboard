import { createServiceRoleClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RecordPaymentForm from "./record-form";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member } = await searchParams;
  const svc = createServiceRoleClient();

  const [{ data: memberRow }, { data: publications }] = await Promise.all([
    member
      ? svc
          .from("members")
          .select("id, member_code, title, full_name")
          .eq("id", member)
          .single()
      : Promise.resolve({ data: null }),
    svc.from("publications").select("id, name, annual_price_inr, life_member_price_inr").eq("is_active", true),
  ]);

  // For autocomplete: load a small set of recent members
  const { data: recentMembers } = await svc
    .from("members")
    .select("id, member_code, title, full_name, phone, city")
    .order("updated_at", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Record payment</h1>
      <Card>
        <CardHeader>
          <CardTitle>Payment details</CardTitle>
        </CardHeader>
        <CardContent>
          <RecordPaymentForm
            prefilledMember={memberRow ?? null}
            allMembers={recentMembers ?? []}
            publications={publications ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
