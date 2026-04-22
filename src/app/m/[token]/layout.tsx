import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Member Status | Seva Trust",
  description: "View your membership status and manage your subscription",
};

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Seva Trust</h1>
          <p className="text-xs text-[var(--color-muted-foreground)]">Member Portal</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-3xl px-4 py-4 text-xs text-[var(--color-muted-foreground)]">
          If you have questions, contact the trust office.
        </div>
      </footer>
    </div>
  );
}
