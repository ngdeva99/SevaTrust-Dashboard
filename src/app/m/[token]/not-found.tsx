import { Card, CardContent } from "@/components/ui/card";

export default function MemberNotFound() {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-2">
        <h2 className="text-lg font-semibold">Link Invalid or Expired</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          This member link is no longer valid. Please contact the trust office
          for an updated link.
        </p>
      </CardContent>
    </Card>
  );
}
