"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}

interface RazorpayInstance {
  open(): void;
}

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface Props {
  amountInr: number;
  purpose: "subscription" | "book_order" | "donation";
  memberId?: string;
  accessToken?: string;
  memberName?: string;
  memberEmail?: string;
  memberPhone?: string;
  orderId?: string;
  subscriptionType?: "life_member" | "annual";
  publicationId?: string;
  yearsPaid?: number;
  description?: string;
  onSuccess: (receipt_number: string, payment_id: string) => void;
  onFailure?: (error: string) => void;
}

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function RazorpayCheckout({
  amountInr,
  purpose,
  memberId,
  accessToken,
  memberName,
  memberEmail,
  memberPhone,
  orderId,
  subscriptionType,
  publicationId,
  yearsPaid,
  description,
  onSuccess,
  onFailure,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = useCallback(async () => {
    setLoading(true);
    setError(null);

    const loaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!loaded) {
      setError("Failed to load Razorpay. Check your connection.");
      setLoading(false);
      return;
    }

    // Step 1: Create Razorpay order
    const createRes = await fetch("/api/razorpay/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose,
        amount_inr: amountInr,
        member_id: memberId,
        access_token: accessToken,
        order_id: orderId,
        subscription_type: subscriptionType,
        publication_id: publicationId,
        years_paid: yearsPaid,
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok || !createData.razorpay_order_id) {
      setError(createData.error || "Failed to create payment order");
      setLoading(false);
      onFailure?.(createData.error || "Failed to create payment order");
      return;
    }

    // Step 2: Open Razorpay modal
    const options: RazorpayOptions = {
      key: createData.key_id,
      amount: createData.amount,
      currency: createData.currency,
      order_id: createData.razorpay_order_id,
      name: "Seva Trust",
      description: description ?? purpose.replace("_", " "),
      prefill: {
        name: memberName,
        email: memberEmail,
        contact: memberPhone,
      },
      handler: async (response: RazorpayResponse) => {
        // Step 3: Verify payment
        const verifyRes = await fetch("/api/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...response,
            purpose,
            member_id: createData.member_id ?? memberId,
            amount_inr: amountInr,
            subscription_type: subscriptionType,
            publication_id: publicationId,
            years_paid: yearsPaid,
            order_id: orderId,
          }),
        });
        const verifyData = await verifyRes.json();
        setLoading(false);
        if (verifyData.ok) {
          onSuccess(verifyData.receipt_number, verifyData.payment_id);
        } else {
          const msg = verifyData.error || "Payment verification failed";
          setError(msg);
          onFailure?.(msg);
        }
      },
      modal: {
        ondismiss: () => {
          setLoading(false);
        },
      },
      theme: { color: "#16a34a" },
    };

    const rz = new window.Razorpay(options);
    rz.open();
  }, [amountInr, purpose, memberId, accessToken, orderId, subscriptionType, publicationId, yearsPaid, memberName, memberEmail, memberPhone, description, onSuccess, onFailure]);

  return (
    <div>
      <Button onClick={handlePay} disabled={loading} className="w-full">
        {loading ? "Processing..." : `Pay \u20B9${amountInr.toLocaleString("en-IN")}`}
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
