import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import RenewForm from "./renew-form";

export const dynamic = "force-dynamic";

async function getData(token: string) {
  const svc = createServiceRoleClient();
  const { data: member } = await svc
    .from("members")
    .select("id, full_name, phone, email, member_code, access_token")
    .eq("access_token", token)
    .single();
  if (!member) return null;

  const { data: pub } = await svc
    .from("publications")
    .select("id, name, annual_price_inr, life_member_price_inr")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .single();

  const { data: activeSub } = await svc
    .from("subscriptions")
    .select("type, end_date")
    .eq("member_id", member.id)
    .eq("status", "active")
    .order("end_date", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return { member, publication: pub, activeSub };
}

function displayName(fullName: string): string {
  return fullName
    .replace(/^(Sri\.?\s*|Smt\.?\s*|Shri\.?\s*|Dr\.?\s*|Ms\.?\s*|Mrs\.?\s*|Mr\.?\s*)/i, "")
    .trim();
}

export default async function RenewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getData(token);
  if (!data) notFound();

  const { member, publication, activeSub } = data;

  if (activeSub?.type === "life_member") {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/m/${token}` as never}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-lg font-medium">You are a Life Member</p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              No renewal is needed. Your membership is valid for life.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!publication) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/m/${token}` as never}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Online renewal is not available at this time. Please contact the trust office.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Annual price is stored in paise
  const annualPriceRupees = publication.annual_price_inr / 100;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/m/${token}` as never}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </Button>

      <h2 className="text-xl font-semibold">Renew Subscription</h2>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {displayName(member.full_name)} ({member.member_code})
      </p>

      <Card>
        <CardHeader>
          <CardTitle>{publication.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <RenewForm
            token={token}
            memberId={member.id}
            publicationId={publication.id}
            annualPriceRupees={annualPriceRupees}
            memberName={member.full_name}
            memberEmail={member.email}
            memberPhone={member.phone}
          />
        </CardContent>
      </Card>
    </div>
  );
}
