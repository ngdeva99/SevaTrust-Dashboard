"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RazorpayCheckout } from "@/components/razorpay-checkout";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  token: string;
  memberId: string;
  publicationId: string;
  annualPriceRupees: number;
  memberName: string | null;
  memberEmail: string | null;
  memberPhone: string | null;
}

export default function RenewForm({
  token,
  memberId,
  publicationId,
  annualPriceRupees,
  memberName,
  memberEmail,
  memberPhone,
}: Props) {
  const router = useRouter();
  const [years, setYears] = useState(1);
  const [receipt, setReceipt] = useState<string | null>(null);

  const totalAmount = annualPriceRupees * years;

  if (receipt) {
    return (
      <div className="py-6 text-center space-y-3">
        <div className="text-green-600 text-4xl">&#10003;</div>
        <h3 className="text-lg font-semibold">Payment Successful</h3>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Your subscription has been renewed for {years} year{years > 1 ? "s" : ""}.
        </p>
        <p className="font-mono text-sm">Receipt: {receipt}</p>
        <button
          onClick={() => router.push(`/m/${token}` as never)}
          className="mt-4 text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          Back to status page
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Number of years</label>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 5].map((y) => (
            <button
              key={y}
              onClick={() => setYears(y)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                years === y
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "hover:bg-[var(--color-muted)]"
              }`}
            >
              {y} year{y > 1 ? "s" : ""}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex justify-between text-sm">
            <span>Annual subscription</span>
            <span>{"\u20B9"}{annualPriceRupees.toLocaleString("en-IN")} / year</span>
          </div>
          {years > 1 && (
            <div className="flex justify-between text-sm text-[var(--color-muted-foreground)]">
              <span>{years} years</span>
              <span>{"\u20B9"}{annualPriceRupees.toLocaleString("en-IN")} x {years}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
            <span>Total</span>
            <span>{"\u20B9"}{totalAmount.toLocaleString("en-IN")}</span>
          </div>
        </CardContent>
      </Card>

      <RazorpayCheckout
        amountInr={totalAmount}
        purpose="subscription"
        memberId={memberId}
        accessToken={token}
        memberName={memberName ?? undefined}
        memberEmail={memberEmail ?? undefined}
        memberPhone={memberPhone ?? undefined}
        subscriptionType="annual"
        publicationId={publicationId}
        yearsPaid={years}
        description={`Subscription renewal - ${years} year${years > 1 ? "s" : ""}`}
        onSuccess={(receiptNum) => setReceipt(receiptNum)}
      />
    </div>
  );
}
