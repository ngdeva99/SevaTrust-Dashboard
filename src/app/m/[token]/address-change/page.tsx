import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import AddressChangeForm from "./address-change-form";

export const dynamic = "force-dynamic";

async function getMember(token: string) {
  const svc = createServiceRoleClient();
  const { data: member } = await svc
    .from("members")
    .select(
      "id, full_name, member_code, access_token, phone, email, address_line1, address_line2, address_line3, city, state, pin_code, country"
    )
    .eq("access_token", token)
    .single();
  return member;
}

function displayName(fullName: string): string {
  return fullName
    .replace(/^(Sri\.?\s*|Smt\.?\s*|Shri\.?\s*|Dr\.?\s*|Ms\.?\s*|Mrs\.?\s*|Mr\.?\s*)/i, "")
    .trim();
}

export default async function AddressChangePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMember(token);
  if (!member) notFound();

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/m/${token}` as never}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </Button>

      <h2 className="text-xl font-semibold">Request Address Change</h2>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {displayName(member.full_name)} ({member.member_code})
      </p>

      <Card>
        <CardHeader>
          <CardTitle>New Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">
            Fill in the fields you&apos;d like to change. Leave unchanged fields as they are.
            Your request will be reviewed by the trust admin.
          </p>
          <AddressChangeForm
            token={token}
            defaults={{
              phone: member.phone ?? "",
              email: member.email ?? "",
              address_line1: member.address_line1 ?? "",
              address_line2: member.address_line2 ?? "",
              address_line3: member.address_line3 ?? "",
              city: member.city ?? "",
              state: member.state ?? "",
              pin_code: member.pin_code ?? "",
              country: member.country ?? "India",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
