import { NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireAdmin, UnauthorizedError } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { MailingListPdf, type MailingMember } from "@/lib/pdf/mailing-list";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const url = new URL(request.url);
  const language = url.searchParams.get("language") ?? "";
  const onlyActive = url.searchParams.get("only_active") !== "false";
  const country = url.searchParams.get("country") ?? "";
  const publicationId = url.searchParams.get("publication") ?? "";

  const svc = createServiceRoleClient();

  let query = svc
    .from("members_with_sub_status")
    .select(
      "member_code, title, full_name, address_line1, address_line2, address_line3, city, state, pin_code, country, diary_copies, default_language, effective_status, current_subscription_type"
    )
    .order("pin_code", { ascending: true })
    .order("member_code", { ascending: true });

  if (onlyActive) {
    // Life or current annual
    query = query.in("effective_status", ["life_active", "annual_active"]);
  }
  if (language) query = query.eq("default_language", language);
  if (country) query = query.eq("country", country);

  // publicationId is informational for the subtitle only, since our view
  // doesn't pivot by publication. When multiple publications exist, add
  // a join here; for now one publication is the default.
  void publicationId;

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const members = (data ?? []) as MailingMember[];

  const subtitleParts: string[] = [];
  if (language) subtitleParts.push(`Language: ${language}`);
  if (country) subtitleParts.push(`Country: ${country}`);
  subtitleParts.push(`${members.length} recipients`);

  const buffer = await renderToBuffer(
    createElement(MailingListPdf, {
      members,
      title: "Mailing List",
      subtitle: subtitleParts.join("  ·  "),
    })
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mailing-list-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
