"use server";

import type { Route } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

function safePostLoginRedirect(raw: string): Route {
  const path = (raw.trim() || "/admin").split("#")[0] ?? "/admin";
  if (!path.startsWith("/admin") || path.startsWith("//")) return "/admin";
  return path as Route;
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safePostLoginRedirect(String(formData.get("next") ?? "/admin"));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Invalid email or password." };
  }

  // Check this user has an active admin record
  const svc = createServiceRoleClient();
  const { data: admin } = await svc
    .from("admins")
    .select("id, is_active")
    .eq("id", data.user.id)
    .single();

  if (!admin || !admin.is_active) {
    await supabase.auth.signOut();
    return { error: "Your account has no admin access. Contact the trust." };
  }

  // Touch last_login_at (best-effort; ignore errors)
  await svc.from("admins").update({ last_login_at: new Date().toISOString() }).eq("id", admin.id);

  redirect(next);
}

export async function signOutAction() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
