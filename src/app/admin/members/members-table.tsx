"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Check, Pencil, X } from "lucide-react";
import { inlineUpdateMember, updateSubscriptionEnd } from "./actions";

type Member = {
  id: string;
  member_code: string;
  full_name: string;
  city: string | null;
  pin_code: string | null;
  phone: string | null;
  status: string | null;
  effective_status: string | null;
  current_subscription_end: string | null;
  current_subscription_id: string | null;
  current_subscription_type: string | null;
};

function displayName(fullName: string): string {
  // Strip common honorific prefixes to show the meaningful name
  return fullName
    .replace(/^(Sri\.?\s*|Smt\.?\s*|Shri\.?\s*|Dr\.?\s*|Ms\.?\s*|Mrs\.?\s*|Mr\.?\s*)/i, "")
    .trim();
}

function statusBadge(effective: string | null) {
  switch (effective) {
    case "life_active":
      return <Badge variant="success">Life</Badge>;
    case "annual_active":
      return <Badge variant="success">Active</Badge>;
    case "annual_expired":
      return <Badge variant="danger">Expired</Badge>;
    case "no_subscription":
      return <Badge variant="muted">No sub</Badge>;
    case "cancelled":
      return <Badge variant="muted">Cancelled</Badge>;
    default:
      return <Badge variant="muted">{effective ?? "—"}</Badge>;
  }
}

function InlineEditCell({
  value,
  onSave,
  type = "text",
}: {
  value: string;
  onSave: (v: string) => Promise<{ ok?: boolean; error?: string }>;
  type?: "text" | "date" | "select";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <span className="group flex items-center gap-1">
        <span>{value || "—"}</span>
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          aria-label="Edit"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </span>
    );
  }

  const save = () => {
    startTransition(async () => {
      const r = await onSave(draft);
      if (r?.ok) setEditing(false);
    });
  };

  const cancel = () => setEditing(false);

  return (
    <span className="flex items-center gap-1">
      <input
        type={type === "date" ? "date" : "text"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
        className="h-7 w-full min-w-[80px] rounded border px-1.5 text-sm"
        autoFocus
        disabled={pending}
      />
      <button onClick={save} disabled={pending} className="text-green-600 hover:text-green-800" aria-label="Save">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={cancel} disabled={pending} className="text-red-500 hover:text-red-700" aria-label="Cancel">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function InlineStatusCell({
  memberId,
  currentStatus,
}: {
  memberId: string;
  currentStatus: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const statuses = ["active", "paused", "deceased", "cancelled"];

  if (!editing) {
    return (
      <span className="group flex items-center gap-1">
        <StatusLabel status={currentStatus} />
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          aria-label="Edit status"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <select
        defaultValue={currentStatus}
        onChange={(e) => {
          startTransition(async () => {
            await inlineUpdateMember(memberId, "status", e.target.value);
            setEditing(false);
          });
        }}
        className="h-7 rounded border px-1 text-xs"
        autoFocus
        disabled={pending}
      >
        {statuses.map((s) => (
          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
        ))}
      </select>
      <button onClick={() => setEditing(false)} className="text-red-500" aria-label="Cancel">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function StatusLabel({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-900",
    paused: "bg-amber-100 text-amber-900",
    deceased: "bg-gray-100 text-gray-700",
    cancelled: "bg-red-100 text-red-900",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function MembersTable({ rows }: { rows: Member[] }) {
  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={7} className="p-8 text-center text-[var(--color-muted-foreground)]">
          No members found.
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((m) => (
        <tr key={m.id} className="border-b hover:bg-[var(--color-accent)]">
          <td className="p-3 font-mono text-xs">{m.member_code}</td>
          <td className="p-3">
            <Link
              href={`/admin/members/${m.id}`}
              className="font-medium hover:underline"
            >
              {displayName(m.full_name)}
            </Link>
          </td>
          <td className="p-3">{m.city ?? "—"}</td>
          <td className="p-3">
            <InlineEditCell
              value={m.phone ?? ""}
              onSave={(v) => inlineUpdateMember(m.id, "phone", v)}
            />
          </td>
          <td className="p-3">
            <InlineStatusCell
              memberId={m.id}
              currentStatus={m.status ?? "active"}
            />
          </td>
          <td className="p-3">{statusBadge(m.effective_status)}</td>
          <td className="p-3">
            {m.current_subscription_type === "life_member" ? (
              "Lifetime"
            ) : m.current_subscription_end && m.current_subscription_id ? (
              <InlineEditCell
                value={m.current_subscription_end}
                type="date"
                onSave={(v) =>
                  updateSubscriptionEnd(m.id, m.current_subscription_id!, v)
                }
              />
            ) : (
              "—"
            )}
          </td>
        </tr>
      ))}
    </>
  );
}
