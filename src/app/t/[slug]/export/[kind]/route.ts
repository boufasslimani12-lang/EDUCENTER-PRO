import { NextResponse, type NextRequest } from "next/server";
import { getWorkspace } from "@/lib/session";

function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "﻿";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\r\n");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await params;
  const ws = await getWorkspace(slug);
  if (ws.role !== "admin" || !ws.operational) return new NextResponse("Forbidden", { status: 403 });
  const { supabase, tenant } = ws;
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? "1900-01-01";
  const to = sp.get("to") ?? "2999-12-31";
  let rows: Record<string, unknown>[] = [];

  if (kind === "students") {
    const { data } = await supabase.from("students").select("code, last_name, first_name, birth_date, gender, phone, email, guardian_name, guardian_phone, archived_at, enrollments(status, classes(name), academic_years(name))").eq("tenant_id", tenant.id).order("last_name");
    rows = (data ?? []).map((s: any) => {
      const e = (s.enrollments ?? []).find((x: any) => x.status === "active");
      const { enrollments, ...rest } = s;
      return { ...rest, academic_year: e?.academic_years?.name ?? "", class: e?.classes?.name ?? "" };
    });
  } else if (kind === "installments") {
    let q = supabase.from("installment_balances").select("invoice_no, period, amount_due, discount, amount_paid, balance, payment_status, students(code, last_name, first_name)").eq("tenant_id", tenant.id).order("period");
    if (sp.get("period")) q = q.eq("period", sp.get("period")!);
    if (sp.get("open") === "1") q = q.gt("balance", 0);
    const { data } = await q;
    rows = (data ?? []).map(({ students, ...r }: any) => ({ code: students?.code, student: `${students?.last_name} ${students?.first_name}`, ...r }));
  } else if (kind === "payments") {
    const { data } = await supabase.from("payments").select("receipt_no, paid_on, amount, method, reference, voided_at, void_reason, students(last_name, first_name)").eq("tenant_id", tenant.id).gte("paid_on", from).lte("paid_on", to).order("paid_on");
    rows = (data ?? []).map(({ students, ...r }: any) => ({ student: `${students?.last_name} ${students?.first_name}`, ...r }));
  } else if (kind === "expenses") {
    const { data } = await supabase.from("expenses").select("spent_on, amount, beneficiary, method, reference, description, voided_at, void_reason, expense_categories(name)").eq("tenant_id", tenant.id).gte("spent_on", from).lte("spent_on", to).order("spent_on");
    rows = (data ?? []).map(({ expense_categories, ...r }: any) => ({ category: expense_categories?.name, ...r }));
  } else if (kind === "cash") {
    const { data } = await supabase.from("cash_movements").select("occurred_on, direction, amount, method, description").eq("tenant_id", tenant.id).gte("occurred_on", from).lte("occurred_on", to).order("occurred_on");
    rows = data ?? [];
  } else if (kind === "attendance") {
    const { data } = await supabase.from("attendance_records").select("session_date, status, minutes_late, note, students(last_name, first_name), classes(name), groups(name)").eq("tenant_id", tenant.id).gte("session_date", from).lte("session_date", to).order("session_date");
    rows = (data ?? []).map(({ students, classes, groups, ...r }: any) => ({ student: `${students?.last_name} ${students?.first_name}`, scope: classes?.name ?? groups?.name, ...r }));
  } else {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
