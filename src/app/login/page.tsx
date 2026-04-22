import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-[var(--color-muted)]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Sign In</CardTitle>
          <CardDescription>Trust Management System</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next ?? "/admin"} />
        </CardContent>
      </Card>
    </div>
  );
}
