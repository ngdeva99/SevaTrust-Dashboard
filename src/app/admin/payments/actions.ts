"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { nextReceiptNumber, indianFy } from "@/lib/razorpay/payment-helpers";

const PaymentSchema = z.object({
  member_id: z.string().uuid(),
  amount_inr: z.coerce.number().int().min(1), // rupees, converted to paise below
  method: z.enum(["razorpay", "cheque", "cash", "upi_manual", "bank_transfer", "historical"]),
  reference: z.string().max(200).optional().or(z.literal("")),
  purpose: z.enum(["subscription", "book_order", "donation"]),
  received_at: z.string().min(1),
  notes: z.string().max(2000).optional().or(z.literal("")),

  // Subscription-specific (only used when purpose == 'subscription')
  publication_id: z.string().uuid().optional().or(z.literal("")),
  sub_type: z.enum(["life_member", "annual"]).optional(),
  years_paid: z.coerce.number().int().min(1).max(50).optional(),
});

export async function recordPayment(formData: FormData) {
  const admin = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = PaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const v = parsed.data;

  const svc = createServiceRoleClient();

  // Convert rupees to paise
  const amount_paise = Math.round(v.amount_inr * 100);
  const receivedDate = new Date(v.received_at);
  const fy = indianFy(receivedDate);

  // Generate a receipt number by counting existing payments in this FY
  const { count: fyCount } = await svc
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("financial_year", fy);
  const receipt_number = nextReceiptNumber(fy, (fyCount ?? 0) + 1);

  // If this is a subscription payment, create the subscription row first
  let subscription_id: string | null = null;
  if (v.purpose === "subscription") {
    if (!v.sub_type) return { error: "Subscription type is required" };

    const { data: pub } = v.publication_id
      ? await svc.from("publications").select("id").eq("id", v.publication_id).single()
      : await svc.from("publications").select("id").eq("is_active", true).order("created_at").limit(1).single();
    if (!pub) return { error: "No publication configured. Seed a publication first." };

    // Find current active subscription to chain from
    const { data: current } = await svc
      .from("subscriptions")
      .select("end_date")
      .eq("member_id", v.member_id)
      .eq("publication_id", pub.id)
      .eq("status", "active")
      .order("end_date", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const today = receivedDate.toISOString().slice(0, 10);
    let start = today;
    if (current?.end_date && current.end_date > today) {
      start = current.end_date; // extend from current end
    }

    let end_date: string | null = null;
    let years = v.years_paid ?? 1;
    if (v.sub_type === "annual") {
      const s = new Date(start);
      s.setFullYear(s.getFullYear() + years);
      end_date = s.toISOString().slice(0, 10);
    } else {
      // life_member
      years = 0;
      end_date = null;
    }

    const { data: sub, error: subErr } = await svc
      .from("subscriptions")
      .insert({
        member_id: v.member_id,
        publication_id: pub.id,
        type: v.sub_type,
        start_date: start,
        end_date,
        years_paid: years,
        amount_paid_inr: amount_paise,
        status: "active",
      })
      .select("id")
      .single();
    if (subErr || !sub) return { error: subErr?.message ?? "Failed to create subscription" };
    subscription_id = sub.id;
  }

  // Insert the payment
  const { data: payment, error: payErr } = await svc
    .from("payments")
    .insert({
      member_id: v.member_id,
      amount_inr: amount_paise,
      method: v.method,
      reference: v.reference || null,
      purpose: v.purpose,
      subscription_id,
      received_at: receivedDate.toISOString(),
      recorded_by_admin_id: admin.adminId,
      receipt_number,
      financial_year: fy,
      notes: v.notes || null,
    })
    .select()
    .single();
  if (payErr) return { error: payErr.message };

  await svc.from("audit_log").insert({
    admin_id: admin.adminId,
    action: "record_payment",
    entity_type: "payment",
    entity_id: payment.id,
    after_json: payment,
  });

  revalidatePath(`/admin/members/${v.member_id}`);
  revalidatePath("/admin/payments");

  return { ok: true, payment_id: payment.id, receipt_number };
}
