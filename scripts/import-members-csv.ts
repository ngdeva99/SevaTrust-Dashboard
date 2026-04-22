/**
 * Import the CSV produced by scripts/parse_members_doc.py into the members table.
 *
 *   pnpm import-members path/to/members_parsed.csv
 *
 * Every row becomes an active life_member with a fresh access token.
 * Rows with parse_confidence=needs_review are still imported but tagged
 * so admin can find them in the UI.
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
  title: string;
  full_name: string;
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

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: pnpm import-members path/to/members_parsed.csv");
    process.exit(1);
  }

  const raw = readFileSync(path, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true }) as Row[];
  console.log(`Read ${rows.length} rows from ${path}`);

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

  // Find highest existing LM-#### code to avoid collisions
  const { data: existing } = await svc
    .from("members")
    .select("member_code")
    .like("member_code", "LM-%")
    .order("member_code", { ascending: false })
    .limit(1);
  let seq = existing?.[0]?.member_code
    ? parseInt(existing[0].member_code.split("-")[1], 10) + 1
    : 1;

  let imported = 0;
  let skipped = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const r of rows) {
    if (!r.full_name?.trim()) {
      skipped++;
      continue;
    }

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

    const code = `LM-${String(seq).padStart(4, "0")}`;
    seq++;

    const member = {
      member_code: code,
      access_token: randomBytes(32).toString("base64url"),
      title,
      full_name: r.full_name.trim(),
      address_line1: norm(r.address_line1),
      address_line2: norm(r.address_line2),
      address_line3: norm(r.address_line3),
      city: norm(r.city),
      state: norm(r.state),
      pin_code: norm(r.pin_code),
      country: norm(r.country) ?? "India",
      default_language: language,
      diary_copies: parseInt(r.diary_copies || "1", 10) || 1,
      internal_notes: notesParts.join("\n"),
      status: "active",
      legacy_raw_text: r.legacy_raw_text,
      legacy_import_id: r.legacy_import_id,
    };

    const { data: inserted, error } = await svc.from("members").insert(member).select("id").single();
    if (error || !inserted) {
      console.error(`  ✗ ${code} ${r.full_name}: ${error?.message}`);
      skipped++;
      continue;
    }

    // Create a life_member subscription with no end_date
    const { error: subErr } = await svc.from("subscriptions").insert({
      member_id: inserted.id,
      publication_id: pub.id,
      type: "life_member",
      start_date: today,
      end_date: null,
      years_paid: 0,
      amount_paid_inr: 0,
      status: "active",
    });
    if (subErr) console.error(`    subscription failed: ${subErr.message}`);

    imported++;
    if (imported % 50 === 0) console.log(`  imported ${imported}…`);
  }

  console.log(`\nDone. Imported ${imported}, skipped ${skipped}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
