import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPaymentSignature } from "@/lib/razorpay/client";
import { generateReceipt } from "@/lib/razorpay/payment-helpers";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const Schema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  purpose: z.enum(["subscription", "book_order", "donation"]),
  member_id: z.string().uuid().optional(),
  amount_inr: z.number().int().min(1),
  // Subscription fields
  subscription_type: z.enum(["life_member", "annual"]).optional(),
  publication_id: z.string().uuid().optional(),
  years_paid: z.number().int().min(1).max(50).optional(),
  // Book order fields
  order_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const v = parsed.data;

    // Verify signature
    const valid = verifyPaymentSignature(
      v.razorpay_order_id,
      v.razorpay_payment_id,
      v.razorpay_signature
    );
    if (!valid) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    const svc = createServiceRoleClient();
    const amountPaise = v.amount_inr * 100;
    const { receipt_number, financial_year, received_at } = await generateReceipt(svc);

    // Handle subscription creation
    let subscriptionId: string | null = null;
    if (v.purpose === "subscription" && v.member_id && v.subscription_type) {
      const { data: pub } = v.publication_id
        ? await svc.from("publications").select("id").eq("id", v.publication_id).single()
        : await svc.from("publications").select("id").eq("is_active", true).order("created_at").limit(1).single();
      if (!pub) {
        return NextResponse.json({ error: "No publication found" }, { status: 400 });
      }

      // Find current subscription to chain from
      const { data: current } = await svc
        .from("subscriptions")
        .select("end_date")
        .eq("member_id", v.member_id)
        .eq("publication_id", pub.id)
        .eq("status", "active")
        .order("end_date", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      const today = new Date().toISOString().slice(0, 10);
      let start = today;
      if (current?.end_date && current.end_date > today) {
        start = current.end_date;
      }

      let endDate: string | null = null;
      let years = v.years_paid ?? 1;
      if (v.subscription_type === "annual") {
        const s = new Date(start);
        s.setFullYear(s.getFullYear() + years);
        endDate = s.toISOString().slice(0, 10);
      } else {
        years = 0;
        endDate = null;
      }

      const { data: sub, error: subErr } = await svc
        .from("subscriptions")
        .insert({
          member_id: v.member_id,
          publication_id: pub.id,
          type: v.subscription_type,
          start_date: start,
          end_date: endDate,
          years_paid: years,
          amount_paid_inr: amountPaise,
          status: "active",
        })
        .select("id")
        .single();
      if (subErr) {
        return NextResponse.json({ error: subErr.message }, { status: 500 });
      }
      subscriptionId = sub.id;
    }

    // Update book order status if applicable
    if (v.purpose === "book_order" && v.order_id) {
      await svc
        .from("orders")
        .update({ status: "paid" })
        .eq("id", v.order_id);
    }

    // Insert the payment row
    const { data: payment, error: payErr } = await svc
      .from("payments")
      .insert({
        member_id: v.member_id ?? null,
        amount_inr: amountPaise,
        method: "razorpay",
        reference: v.razorpay_payment_id,
        purpose: v.purpose,
        subscription_id: subscriptionId,
        order_id: v.order_id ?? null,
        received_at,
        receipt_number,
        financial_year,
        razorpay_order_id: v.razorpay_order_id,
        razorpay_signature: v.razorpay_signature,
      })
      .select()
      .single();
    if (payErr) {
      return NextResponse.json({ error: payErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      receipt_number,
      payment_id: payment.id,
    });
  } catch (err) {
    console.error("Razorpay verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
