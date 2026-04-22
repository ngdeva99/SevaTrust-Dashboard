import { createServerSupabase } from "./server";
import { createServiceRoleClient } from "./admin";

export type AdminContext = {
  authUserId: string;
  adminId: string;
  name: string;
  email: string;
  role: "super_admin" | "editor" | "viewer";
};

/**
 * Call this at the top of every admin-only server action or API route.
 * Returns the admin record, or throws if not authorised.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError("Not signed in");
  }

  // Look up the admin record using service role so RLS can't hide it from us
  const svc = createServiceRoleClient();
  const { data: admin, error: adminErr } = await svc
    .from("admins")
    .select("id, name, email, role, is_active")
    .eq("id", user.id)
    .single();

  if (adminErr || !admin) {
    throw new UnauthorizedError("No admin record for this user");
  }
  if (!admin.is_active) {
    throw new UnauthorizedError("Admin account is disabled");
  }

  return {
    authUserId: user.id,
    adminId: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };
}

export function requireSuperAdmin(ctx: AdminContext) {
  if (ctx.role !== "super_admin") {
    throw new UnauthorizedError("Super admin required");
  }
}

export class UnauthorizedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "UnauthorizedError";
  }
}
