import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay/client";
import { generateReceipt } from "@/lib/razorpay/payment-helpers";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event as string;

    if (eventType === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (!payment) return NextResponse.json({ ok: true });

      const rzOrderId = payment.order_id;
      const rzPaymentId = payment.id;
      const amountPaise = payment.amount;
      const notes = payment.notes ?? {};

      const svc = createServiceRoleClient();

      // Check if payment already recorded (from client-side verify)
      const { data: existing } = await svc
        .from("payments")
        .select("id")
        .eq("razorpay_order_id", rzOrderId)
        .maybeSingle();

      if (existing) {
        // Already processed via client-side verify
        return NextResponse.json({ ok: true, already_processed: true });
      }

      // Fallback: record the payment
      const { receipt_number, financial_year, received_at } = await generateReceipt(svc);

      await svc.from("payments").insert({
        member_id: notes.member_id ?? null,
        amount_inr: amountPaise,
        method: "razorpay",
        reference: rzPaymentId,
        purpose: notes.purpose ?? "donation",
        received_at,
        receipt_number,
        financial_year,
        razorpay_order_id: rzOrderId,
        order_id: notes.order_id ?? null,
      });
    }

    if (eventType === "payment.failed") {
      const payment = event.payload?.payment?.entity;
      console.error("Razorpay payment failed:", payment?.id, payment?.error_description);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Razorpay webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
