import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EditForm from "./edit-form";

export const dynamic = "force-dynamic";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const svc = createServiceRoleClient();
  const { data: m } = await svc.from("members").select("*").eq("id", id).single();
  if (!m) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Edit {m.title} {m.full_name}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EditForm
            memberId={m.id}
            defaults={{
              title: m.title,
              full_name: m.full_name,
              phone: m.phone,
              email: m.email,
              address_line1: m.address_line1,
              address_line2: m.address_line2,
              address_line3: m.address_line3,
              city: m.city,
              state: m.state,
              pin_code: m.pin_code,
              country: m.country,
              default_language: m.default_language,
              diary_copies: m.diary_copies,
              pan_last4: m.pan_last4,
              internal_notes: m.internal_notes,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
