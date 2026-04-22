import { createServiceRoleClient } from "@/lib/supabase/admin";

export function nextReceiptNumber(fy: string, count: number) {
  return `RCT/${fy}/${String(count).padStart(5, "0")}`;
}

export function indianFy(d: Date) {
  const year = d.getFullYear();
  const isPostMarch = d.getMonth() >= 3;
  const y = isPostMarch ? year : year - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

export async function generateReceipt(svc: ReturnType<typeof createServiceRoleClient>) {
  const now = new Date();
  const fy = indianFy(now);
  const { count: fyCount } = await svc
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("financial_year", fy);
  return {
    receipt_number: nextReceiptNumber(fy, (fyCount ?? 0) + 1),
    financial_year: fy,
    received_at: now.toISOString(),
  };
}
