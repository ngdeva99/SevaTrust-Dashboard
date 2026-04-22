import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AddressRequestsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Address change requests</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming in Phase 3</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted-foreground)]">
          When the member status page and online renewals go live in Phase 2, members
          will be able to submit address-change requests from their personal link.
          Those requests will appear here for admin approval before the member record
          is updated.
        </CardContent>
      </Card>
    </div>
  );
}
