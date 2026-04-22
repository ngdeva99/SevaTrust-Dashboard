import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS.
 *
 * ⚠️  NEVER import this from a Client Component or expose to the browser.
 * Only use inside API routes and Server Actions that have already
 * verified the caller is an authenticated admin.
 */
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
