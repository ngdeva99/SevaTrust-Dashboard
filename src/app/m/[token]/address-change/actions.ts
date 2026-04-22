"use server";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const AddressChangeSchema = z.object({
  access_token: z.string().min(1),
  new_address_line1: z.string().max(200).optional().or(z.literal("")),
  new_address_line2: z.string().max(200).optional().or(z.literal("")),
  new_address_line3: z.string().max(200).optional().or(z.literal("")),
  new_city: z.string().max(120).optional().or(z.literal("")),
  new_state: z.string().max(120).optional().or(z.literal("")),
  new_pin_code: z.string().max(20).optional().or(z.literal("")),
  new_country: z.string().max(80).optional().or(z.literal("")),
  new_phone: z.string().max(40).optional().or(z.literal("")),
  new_email: z.string().max(200).optional().or(z.literal("")),
});

export async function submitAddressChange(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = AddressChangeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const v = parsed.data;

  const svc = createServiceRoleClient();

  // Authenticate by token
  const { data: member } = await svc
    .from("members")
    .select("id")
    .eq("access_token", v.access_token)
    .single();
  if (!member) return { error: "Invalid link. Please use the link shared by the trust." };

  // Check for existing pending request
  const { data: existing } = await svc
    .from("address_change_requests")
    .select("id")
    .eq("member_id", member.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return { error: "You already have a pending address change request. Please wait for it to be reviewed." };
  }

  const { error } = await svc.from("address_change_requests").insert({
    member_id: member.id,
    new_address_line1: v.new_address_line1 || null,
    new_address_line2: v.new_address_line2 || null,
    new_address_line3: v.new_address_line3 || null,
    new_city: v.new_city || null,
    new_state: v.new_state || null,
    new_pin_code: v.new_pin_code || null,
    new_country: v.new_country || null,
    new_phone: v.new_phone || null,
    new_email: v.new_email || null,
    status: "pending",
  });

  if (error) return { error: error.message };
  return { ok: true };
}
