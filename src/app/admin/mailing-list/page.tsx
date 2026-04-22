import { createServiceRoleClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MailingListPage({
  searchParams,
}: {
  searchParams: Promise<{ language?: string; country?: string; only_active?: string }>;
}) {
  const sp = await searchParams;
  const svc = createServiceRoleClient();

  let q = svc
    .from("members_with_sub_status")
    .select("id", { count: "exact", head: true });

  const onlyActive = sp.only_active !== "false";
  if (onlyActive) q = q.in("effective_status", ["life_active", "annual_active"]);
  if (sp.language) q = q.eq("default_language", sp.language);
  if (sp.country) q = q.eq("country", sp.country);

  const { count } = await q;

  const pdfUrl = `/api/admin/mailing-list-pdf?${new URLSearchParams({
    ...(sp.language ? { language: sp.language } : {}),
    ...(sp.country ? { country: sp.country } : {}),
    only_active: String(onlyActive),
  })}`;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mailing list</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" method="get" action="/admin/mailing-list">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Language</label>
                <select name="language" defaultValue={sp.language ?? ""} className="mt-1 h-10 w-full rounded-md border px-3 text-sm">
                  <option value="">All</option>
                  <option value="TAMIL">Tamil</option>
                  <option value="TELUGU">Telugu</option>
                  <option value="ENGLISH">English</option>
                  <option value="SANSKRIT">Sanskrit</option>
                  <option value="KANNADA">Kannada</option>
                  <option value="HINDI">Hindi</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Country</label>
                <select name="country" defaultValue={sp.country ?? ""} className="mt-1 h-10 w-full rounded-md border px-3 text-sm">
                  <option value="">All</option>
                  <option value="India">India</option>
                  <option value="USA">USA</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Only active subscribers</label>
                <select name="only_active" defaultValue={onlyActive ? "true" : "false"} className="mt-1 h-10 w-full rounded-md border px-3 text-sm">
                  <option value="true">Yes</option>
                  <option value="false">No (all members)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Apply filters</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-semibold">{(count ?? 0).toLocaleString("en-IN")}</div>
              <div className="text-sm text-[var(--color-muted-foreground)]">
                members will be in the printed list
              </div>
            </div>
            <Button asChild size="lg">
              <a href={pdfUrl} target="_blank" rel="noopener">
                <Printer className="h-4 w-4" />
                Generate PDF
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
