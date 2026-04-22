"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { recordPayment } from "../actions";

type Member = { id: string; member_code: string; title: string; full_name: string; phone?: string | null; city?: string | null };
type Publication = { id: string; name: string; annual_price_inr: number; life_member_price_inr: number };

export default function RecordPaymentForm({
  prefilledMember,
  allMembers,
  publications,
}: {
  prefilledMember: Member | null;
  allMembers: Member[];
  publications: Publication[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [memberId, setMemberId] = useState(prefilledMember?.id ?? "");
  const [memberQuery, setMemberQuery] = useState(
    prefilledMember ? `${prefilledMember.member_code} — ${prefilledMember.title} ${prefilledMember.full_name}` : ""
  );
  const [purpose, setPurpose] = useState<"subscription" | "book_order" | "donation">("subscription");
  const [subType, setSubType] = useState<"life_member" | "annual">("annual");
  const [method, setMethod] = useState("cheque");
  const [years, setYears] = useState(1);
  const [publicationId, setPublicationId] = useState(publications[0]?.id ?? "");

  const suggestions = useMemo(() => {
    if (memberId) return [];
    const q = memberQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return allMembers
      .filter(
        (m) =>
          m.member_code.toLowerCase().includes(q) ||
          m.full_name.toLowerCase().includes(q) ||
          (m.phone ?? "").toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [memberQuery, allMembers, memberId]);

  const selectedPublication = publications.find((p) => p.id === publicationId);
  const suggestedAmount =
    purpose === "subscription" && selectedPublication
      ? subType === "life_member"
        ? selectedPublication.life_member_price_inr / 100
        : (selectedPublication.annual_price_inr * years) / 100
      : 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!memberId) {
      setError("Please select a member.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("member_id", memberId);
    start(async () => {
      const r = await recordPayment(fd);
      if (r?.error) setError(r.error);
      else if (r?.ok) router.push(`/admin/members/${memberId}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Member */}
      <div className="space-y-2">
        <Label>Member *</Label>
        {memberId ? (
          <div className="flex items-center justify-between rounded-md border bg-[var(--color-muted)] px-3 py-2 text-sm">
            <span>{memberQuery}</span>
            <button
              type="button"
              onClick={() => {
                setMemberId("");
                setMemberQuery("");
              }}
              className="text-xs text-[var(--color-muted-foreground)] underline"
            >
              change
            </button>
          </div>
        ) : (
          <div className="relative">
            <Input
              placeholder="Type name, code, or phone…"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-sm">
                {suggestions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMemberId(m.id);
                      setMemberQuery(`${m.member_code} — ${m.title} ${m.full_name}`);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--color-accent)]"
                  >
                    <span>
                      <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
                        {m.member_code}
                      </span>{" "}
                      {m.title} {m.full_name}
                    </span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">{m.city}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Purpose */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="purpose">Purpose *</Label>
          <Select
            id="purpose"
            name="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as typeof purpose)}
          >
            <option value="subscription">Subscription</option>
            <option value="donation">Donation</option>
            <option value="book_order">Book order</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="method">Method *</Label>
          <Select id="method" name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
            <option value="upi_manual">UPI (manual)</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="razorpay">Razorpay (online)</option>
            <option value="historical">Historical (pre-migration)</option>
          </Select>
        </div>
      </div>

      {/* Subscription-specific */}
      {purpose === "subscription" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 rounded-md border border-dashed p-4">
          <div className="space-y-2">
            <Label htmlFor="publication_id">Publication</Label>
            <Select
              id="publication_id"
              name="publication_id"
              value={publicationId}
              onChange={(e) => setPublicationId(e.target.value)}
            >
              {publications.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub_type">Subscription type *</Label>
            <Select
              id="sub_type"
              name="sub_type"
              value={subType}
              onChange={(e) => setSubType(e.target.value as typeof subType)}
            >
              <option value="annual">Annual</option>
              <option value="life_member">Life member</option>
            </Select>
          </div>
          {subType === "annual" && (
            <div className="space-y-2">
              <Label htmlFor="years_paid">Years</Label>
              <Input
                id="years_paid"
                name="years_paid"
                type="number"
                min={1}
                max={50}
                value={years}
                onChange={(e) => setYears(parseInt(e.target.value) || 1)}
              />
            </div>
          )}
        </div>
      )}

      {/* Amount + date */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="amount_inr">Amount (₹) *</Label>
          <Input
            id="amount_inr"
            name="amount_inr"
            type="number"
            min={1}
            step="0.01"
            defaultValue={suggestedAmount > 0 ? suggestedAmount : undefined}
            required
          />
          {suggestedAmount > 0 && (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Suggested based on publication: ₹{suggestedAmount}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="received_at">Received on *</Label>
          <Input
            id="received_at"
            name="received_at"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reference">Reference</Label>
          <Input
            id="reference"
            name="reference"
            placeholder={method === "cheque" ? "Cheque #" : method === "upi_manual" ? "UPI txn ID" : "Reference"}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Anything worth remembering about this payment…"
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record payment"}
      </Button>
    </form>
  );
}
