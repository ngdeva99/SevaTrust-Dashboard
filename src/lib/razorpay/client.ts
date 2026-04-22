import Razorpay from "razorpay";
import crypto from "crypto";

let instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!instance) {
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return instance;
}

export async function createRazorpayOrder(opts: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const rz = getRazorpay();
  return rz.orders.create({
    amount: opts.amountPaise,
    currency: "INR",
    receipt: opts.receipt,
    notes: opts.notes ?? {},
  });
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}
