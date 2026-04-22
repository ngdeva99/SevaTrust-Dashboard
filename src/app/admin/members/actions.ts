"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { encryptPan, validatePanFormat } from "@/lib/crypto/pan";

const AddressSchema = z.object({
  title: z.enum(["SRI", "SMT", "MS", "DR", "OTHER"]).default("SRI"),
  full_name: z.string().min(1, "Name is required").max(200),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  address_line1: z.string().max(200).optional().or(z.literal("")),
  address_line2: z.string().max(200).optional().or(z.literal("")),
  address_line3: z.string().max(200).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  state: z.string().max(120).optional().or(z.literal("")),
  pin_code: z.string().max(20).optional().or(z.literal("")),
  country: z.string().max(80).default("India"),
  default_language: z
    .enum(["TAMIL", "TELUGU", "ENGLISH", "SANSKRIT", "KANNADA", "HINDI"])
    .optional()
    .or(z.literal("")),
  diary_copies: z.coerce.number().int().min(1).max(50).default(1),
  pan: z.string().max(10).optional().or(z.literal("")),
  internal_notes: z.string().max(5000).optional().or(z.literal("")),
});

function newAccessToken() {
  return randomBytes(32).toString("base64url");
}

async function nextMemberCode(svc: ReturnType<typeof createServiceRoleClient>, prefix: string) {
  // Find the highest existing code with this prefix. Sorting by member_code
  // descending works because our codes are zero-padded to 4 digits.
  const { data: rows } = await svc
    .from("members")
    .select("member_code")
    .like("member_code", `${prefix}-%`)
    .order("member_code", { ascending: false })
    .limit(1);
  const last = rows?.[0]?.member_code?.split("-")[1];
  const n = last ? parseInt(last, 10) + 1 : 1;
  return `${prefix}-${n.toString().padStart(4, "0")}`;
}

export async function createMember(formData: FormData, opts: { as: "life_member" | "annual" }) {
  const admin = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = AddressSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const v = parsed.data;

  if (v.pan && !validatePanFormat(v.pan)) {
    return { error: "Invalid PAN format. Expected ABCDE1234F." };
  }

  const svc = createServiceRoleClient();
  const prefix = opts.as === "life_member" ? "LM" : "AS";
  const member_code = await nextMemberCode(svc, prefix);

  const row: Record<string, unknown> = {
    member_code,
    access_token: newAccessToken(),
    title: v.title,
    full_name: v.full_name.trim(),
    phone: v.phone || null,
    email: v.email || null,
    address_line1: v.address_line1 || null,
    address_line2: v.address_line2 || null,
    address_line3: v.address_line3 || null,
    city: v.city || null,
    state: v.state || null,
    pin_code: v.pin_code || null,
    country: v.country || "India",
    default_language: v.default_language || null,
    diary_copies: v.diary_copies,
    internal_notes: v.internal_notes || "",
    status: "active",
  };

  if (v.pan) {
    const { ciphertext, last4 } = encryptPan(v.pan);
    row.pan_encrypted = ciphertext;
    row.pan_last4 = last4;
  }

  const { data: inserted, error } = await svc.from("members").insert(row).select().single();
  if (error) return { error: error.message };

  await svc.from("audit_log").insert({
    admin_id: admin.adminId,
    action: "create_member",
    entity_type: "member",
    entity_id: inserted.id,
    after_json: { ...inserted, pan_encrypted: inserted.pan_encrypted ? "<redacted>" : null },
  });

  revalidatePath("/admin/members");
  return { ok: true, id: inserted.id, member_code };
}

export async function updateMember(memberId: string, formData: FormData) {
  const admin = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = AddressSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const v = parsed.data;

  if (v.pan && !validatePanFormat(v.pan)) {
    return { error: "Invalid PAN format." };
  }

  const svc = createServiceRoleClient();
  const { data: before } = await svc.from("members").select("*").eq("id", memberId).single();
  if (!before) return { error: "Member not found" };

  const updates: Record<string, unknown> = {
    title: v.title,
    full_name: v.full_name.trim(),
    phone: v.phone || null,
    email: v.email || null,
    address_line1: v.address_line1 || null,
    address_line2: v.address_line2 || null,
    address_line3: v.address_line3 || null,
    city: v.city || null,
    state: v.state || null,
    pin_code: v.pin_code || null,
    country: v.country || "India",
    default_language: v.default_language || null,
    diary_copies: v.diary_copies,
    internal_notes: v.internal_notes || "",
  };

  if (v.pan) {
    const { ciphertext, last4 } = encryptPan(v.pan);
    updates.pan_encrypted = ciphertext;
    updates.pan_last4 = last4;
  }

  const { data: after, error } = await svc
    .from("members")
    .update(updates)
    .eq("id", memberId)
    .select()
    .single();
  if (error) return { error: error.message };

  await svc.from("audit_log").insert({
    admin_id: admin.adminId,
    action: "update_member",
    entity_type: "member",
    entity_id: memberId,
    before_json: { ...before, pan_encrypted: before.pan_encrypted ? "<redacted>" : null },
    after_json: { ...after, pan_encrypted: after.pan_encrypted ? "<redacted>" : null },
  });

  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function regenerateAccessToken(memberId: string) {
  const admin = await requireAdmin();
  const svc = createServiceRoleClient();
  const token = newAccessToken();
  const { error } = await svc.from("members").update({ access_token: token }).eq("id", memberId);
  if (error) return { error: error.message };

  await svc.from("audit_log").insert({
    admin_id: admin.adminId,
    action: "regenerate_access_token",
    entity_type: "member",
    entity_id: memberId,
  });
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true, token };
}
