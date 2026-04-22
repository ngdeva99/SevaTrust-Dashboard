"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type MemberFormDefaults = {
  title?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  country?: string;
  default_language?: string;
  diary_copies?: number;
  pan_last4?: string;
  internal_notes?: string;
};

export function MemberForm({
  defaults,
  submitLabel,
  onSubmit,
}: {
  defaults?: MemberFormDefaults;
  submitLabel: string;
  onSubmit: (fd: FormData) => Promise<{ ok?: boolean; error?: string; id?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await onSubmit(fd);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <form onSubmit={handle} className="space-y-6">
      {/* Identity */}
      <Section title="Identity">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[120px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Select id="title" name="title" defaultValue={defaults?.title ?? "SRI"}>
              <option value="SRI">SRI</option>
              <option value="SMT">SMT</option>
              <option value="MS">MS</option>
              <option value="DR">DR</option>
              <option value="OTHER">(none)</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name *</Label>
            <Input id="full_name" name="full_name" defaultValue={defaults?.full_name ?? ""} required />
          </div>
        </div>
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={defaults?.phone ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={defaults?.email ?? ""} />
          </div>
        </div>
      </Section>

      {/* Address */}
      <Section title="Address">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address_line1">Line 1</Label>
            <Input id="address_line1" name="address_line1" defaultValue={defaults?.address_line1 ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_line2">Line 2</Label>
            <Input id="address_line2" name="address_line2" defaultValue={defaults?.address_line2 ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_line3">Line 3</Label>
            <Input id="address_line3" name="address_line3" defaultValue={defaults?.address_line3 ?? ""} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={defaults?.city ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" defaultValue={defaults?.state ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin_code">PIN</Label>
              <Input id="pin_code" name="pin_code" defaultValue={defaults?.pin_code ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" defaultValue={defaults?.country ?? "India"} />
            </div>
          </div>
        </div>
      </Section>

      {/* Preferences */}
      <Section title="Preferences">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default_language">Preferred language</Label>
            <Select
              id="default_language"
              name="default_language"
              defaultValue={defaults?.default_language ?? ""}
            >
              <option value="">(none)</option>
              <option value="TAMIL">Tamil</option>
              <option value="TELUGU">Telugu</option>
              <option value="ENGLISH">English</option>
              <option value="SANSKRIT">Sanskrit</option>
              <option value="KANNADA">Kannada</option>
              <option value="HINDI">Hindi</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="diary_copies">Copies per issue</Label>
            <Input
              id="diary_copies"
              name="diary_copies"
              type="number"
              min={1}
              max={50}
              defaultValue={defaults?.diary_copies ?? 1}
            />
          </div>
        </div>
      </Section>

      {/* PAN */}
      <Section
        title="PAN (for 80G receipts)"
        subtitle="Encrypted at rest. Only last 4 characters are stored in plaintext for display."
      >
        <div className="space-y-2">
          <Label htmlFor="pan">PAN</Label>
          <Input
            id="pan"
            name="pan"
            maxLength={10}
            placeholder="ABCDE1234F"
            defaultValue=""
            className="uppercase font-mono"
          />
          {defaults?.pan_last4 && (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Currently on file: XXXXX XX{defaults.pan_last4}. Leave blank to keep unchanged.
            </p>
          )}
        </div>
      </Section>

      {/* Notes */}
      <Section title="Internal notes" subtitle="Not visible to members.">
        <textarea
          name="internal_notes"
          defaultValue={defaults?.internal_notes ?? ""}
          rows={4}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Anything to remember about this member…"
        />
      </Section>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--color-muted-foreground)]">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
