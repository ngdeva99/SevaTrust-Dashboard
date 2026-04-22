import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRazorpayOrder } from "@/lib/razorpay/client";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const Schema = z.object({
  purpose: z.enum(["subscription", "book_order", "donation"]),
  amount_inr: z.number().int().min(1),
  member_id: z.string().uuid().optional(),
  access_token: z.string().optional(),
  order_id: z.string().uuid().optional(),
  subscription_type: z.enum(["life_member", "annual"]).optional(),
  publication_id: z.string().uuid().optional(),
  years_paid: z.number().int().min(1).max(50).optional(),
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

    // If access_token provided, resolve member_id
    let memberId = v.member_id;
    if (v.access_token && !memberId) {
      const svc = createServiceRoleClient();
      const { data: member } = await svc
        .from("members")
        .select("id")
        .eq("access_token", v.access_token)
        .single();
      if (!member) {
        return NextResponse.json({ error: "Invalid member token" }, { status: 401 });
      }
      memberId = member.id;
    }

    const amountPaise = v.amount_inr * 100;
    const receipt = `${v.purpose}_${Date.now()}`;
    const notes: Record<string, string> = { purpose: v.purpose };
    if (memberId) notes.member_id = memberId;
    if (v.order_id) notes.order_id = v.order_id;
    if (v.subscription_type) notes.subscription_type = v.subscription_type;
    if (v.years_paid) notes.years_paid = String(v.years_paid);

    const order = await createRazorpayOrder({ amountPaise, receipt, notes });

    return NextResponse.json({
      razorpay_order_id: order.id,
      amount: amountPaise,
      currency: "INR",
      key_id: process.env.RAZORPAY_KEY_ID,
      member_id: memberId,
    });
  } catch (err) {
    console.error("Razorpay create-order error:", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
