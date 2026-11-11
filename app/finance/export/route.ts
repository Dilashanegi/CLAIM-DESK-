import { CATEGORIES, STATUSES, listClaims, toCsv, type Category, type Status } from "@/lib/claims";
import { isFinanceUser } from "@/lib/finance-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isFinanceUser())) {
    return new Response("Log in at /finance first.", { status: 401 });
  }
  const url = new URL(request.url);
  const s = url.searchParams.get("status");
  const c = url.searchParams.get("category");
  const m = url.searchParams.get("month");
  const claims = await listClaims({
    status: STATUSES.includes(s as Status) ? (s as Status) : undefined,
    category: CATEGORIES.includes(c as Category) ? (c as Category) : undefined,
    month: m && /^\d{4}-\d{2}$/.test(m) ? m : undefined,
  });
  const name = `claimdesk-${m || "all"}${s ? `-${s}` : ""}.csv`;
  return new Response(toCsv(claims), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
