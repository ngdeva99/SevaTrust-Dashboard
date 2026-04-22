import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { Users, CreditCard, Printer, LayoutDashboard, BookOpen, Inbox, LogOut } from "lucide-react";
import { requireAdmin, UnauthorizedError } from "@/lib/supabase/auth";
import { signOutAction } from "../login/actions";
import { Button } from "@/components/ui/button";

const navItems: { href: Route; label: string; icon: React.ReactNode }[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/members", label: "Members", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/payments", label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
  { href: "/admin/mailing-list", label: "Mailing list", icon: <Printer className="h-4 w-4" /> },
  { href: "/admin/books", label: "Books", icon: <BookOpen className="h-4 w-4" /> },
  { href: "/admin/address-requests", label: "Address requests", icon: <Inbox className="h-4 w-4" /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    throw e;
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-muted)]">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r bg-white">
        <div className="flex h-16 items-center px-6 border-b">
          <span className="font-semibold">Trust Admin</span>
        </div>
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-[var(--color-accent)]"
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b bg-white px-6">
          <div className="flex-1 max-w-md">
            {/* Global search — wired up in a later iteration */}
            <input
              type="search"
              placeholder="Search members, payments, orders… (coming soon)"
              disabled
              className="h-9 w-full rounded-md border bg-[var(--color-muted)] px-3 text-sm text-[var(--color-muted-foreground)]"
            />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="font-medium">{admin.name}</div>
              <div className="text-xs text-[var(--color-muted-foreground)]">{admin.role}</div>
            </div>
            <form action={signOutAction}>
              <Button variant="ghost" size="icon" type="submit" title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
