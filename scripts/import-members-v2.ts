/**
 * Import v2 CSVs (from parse_members_v2.py) into the database.
 *
 * This replaces ALL existing member data with the new docs.
 *
 * Usage:
 *   pnpm import-v2 docs/life-member-2026-parsed.csv docs/mailing-list-2026-parsed.csv
 *
 * What it does:
 *   1. Deletes all existing members, subscriptions, payments (fresh start)
 *   2. Imports life members (LM-XXXX) from the first CSV
 *   3. Imports annual subscribers (AS-XXXX) from the second CSV
 *   4. Creates subscriptions for each member
 *   5. Deduplicates across both files by full_name + pin_code
 */
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in .env.local`);
  return v;
}

type Row = {
  legacy_import_id: string;
  parse_confidence: string;
  parse_warnings: string;
  subscription_type: string;
  title: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  address_line3: string;
  city: string;
  state: string;
  pin_code: string;
  country: string;
  note_raw: string;
  language_hint: string;
  diary_copies: string;
  legacy_raw_text: string;
};

const validTitles = new Set(["SRI", "SMT", "MS", "DR", "OTHER"]);
const validLangs = new Set(["TAMIL", "TELUGU", "ENGLISH", "SANSKRIT", "KANNADA", "HINDI"]);

function norm(s: string): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

function normName(s: string): string {
  // Normalize name for dedup: uppercase, trim, remove dots and extra spaces
  return s.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

async function main() {
  const csvPaths = process.argv.slice(2);
  if (csvPaths.length === 0) {
    console.error("Usage: pnpm import-v2 <life-member.csv> [mailing-list.csv]");
    process.exit(1);
  }

  // Read all CSVs
  const allRows: Row[] = [];
  for (const path of csvPaths) {
    const raw = readFileSync(path, "utf8");
    const rows = parse(raw, { columns: true, skip_empty_lines: true }) as Row[];
    console.log(`Read ${rows.length} rows from ${path}`);
    allRows.push(...rows);
  }

  // Deduplicate: prefer life_member over annual if same person
  const seen = new Map<string, Row>();
  for (const r of allRows) {
    if (!r.full_name?.trim()) continue;
    const key = `${normName(r.full_name)}|${r.pin_code || ""}`;
    const existing = seen.get(key);
    if (existing) {
      // Prefer life_member
      if (r.subscription_type === "life_member") {
        seen.set(key, r);
      }
      // Otherwise keep the first occurrence
    } else {
      seen.set(key, r);
    }
  }
  const deduped = Array.from(seen.values());
  console.log(`\nAfter dedup: ${deduped.length} unique members (from ${allRows.length} total rows)`);

  const svc = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Find the default publication
  const { data: pub } = await svc
    .from("publications")
    .select("id")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .single();
  if (!pub) {
    console.error("No active publication found. Run the schema migrations first.");
    process.exit(1);
  }
  console.log(`Using publication: ${pub.id}`);

  // Clear existing data (order matters for foreign keys)
  console.log("\nClearing existing data...");
  await svc.from("audit_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await svc.from("payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await svc.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await svc.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await svc.from("subscriptions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await svc.from("address_change_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await svc.from("members").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("  Cleared.");

  let lmSeq = 1;
  let asSeq = 1;
  let imported = 0;
  let skipped = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const r of deduped) {
    if (!r.full_name?.trim()) {
      skipped++;
      continue;
    }

    // Skip noise entries
    if (r.full_name.length < 3) {
      skipped++;
      continue;
    }

    const subType = r.subscription_type === "annual" ? "annual" : "life_member";
    const prefix = subType === "life_member" ? "LM" : "AS";
    const seq = subType === "life_member" ? lmSeq++ : asSeq++;
    const code = `${prefix}-${String(seq).padStart(4, "0")}`;

    const title = validTitles.has((r.title ?? "").toUpperCase())
      ? (r.title ?? "").toUpperCase()
      : "OTHER";
    const language = validLangs.has((r.language_hint ?? "").toUpperCase())
      ? (r.language_hint ?? "").toUpperCase()
      : null;

    const notesParts: string[] = [];
    if (r.note_raw) notesParts.push(`Legacy note: ${r.note_raw}`);
    if (r.parse_confidence && r.parse_confidence !== "high")
      notesParts.push(`(Imported as ${r.parse_confidence} — review)`);
    if (r.parse_warnings) notesParts.push(`Warnings: ${r.parse_warnings}`);

    const member = {
      member_code: code,
      access_token: randomBytes(32).toString("base64url"),
      title,
      full_name: r.full_name.trim(),
      phone: norm(r.phone),
      address_line1: norm(r.address_line1),
      address_line2: norm(r.address_line2),
      address_line3: norm(r.address_line3),
      city: norm(r.city),
      state: norm(r.state),
      pin_code: norm(r.pin_code),
      country: norm(r.country) ?? "India",
      default_language: language,
      diary_copies: parseInt(r.diary_copies || "1", 10) || 1,
      internal_notes: notesParts.join("\n") || "",
      status: "active" as const,
      legacy_raw_text: r.legacy_raw_text,
      legacy_import_id: r.legacy_import_id,
    };

    const { data: inserted, error } = await svc.from("members").insert(member).select("id").single();
    if (error || !inserted) {
      console.error(`  ✗ ${code} ${r.full_name}: ${error?.message}`);
      skipped++;
      continue;
    }

    // Create subscription
    const subEndDate = subType === "annual"
      ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10)
      : null;

    const { error: subErr } = await svc.from("subscriptions").insert({
      member_id: inserted.id,
      publication_id: pub.id,
      type: subType,
      start_date: today,
      end_date: subEndDate,
      years_paid: subType === "annual" ? 1 : 0,
      amount_paid_inr: 0,
      status: "active",
    });
    if (subErr) console.error(`    subscription failed for ${code}: ${subErr.message}`);

    imported++;
    if (imported % 50 === 0) console.log(`  imported ${imported}…`);
  }

  console.log(`\nDone. Imported ${imported}, skipped ${skipped}.`);
  console.log(`  Life members: ${lmSeq - 1}`);
  console.log(`  Annual subscribers: ${asSeq - 1}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
