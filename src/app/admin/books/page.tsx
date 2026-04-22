import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BooksPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Books</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming in Phase 2</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted-foreground)]">
          Book catalogue management and online orders will be built in Phase 2, after
          the internal tool is in daily use and Razorpay credentials are configured.
        </CardContent>
      </Card>
    </div>
  );
}
