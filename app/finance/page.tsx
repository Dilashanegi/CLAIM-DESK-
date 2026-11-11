import Link from "next/link";
import {
  CATEGORIES,
  STATUSES,
  claimLinks,
  formatMoney,
  listClaims,
  totals,
  type Category,
  type Claim,
  type Status,
} from "@/lib/claims";
import { isFinanceUser } from "@/lib/finance-auth";
import { StatusBadge, formatDate } from "@/lib/ui";
import { login, logout, payClaims } from "./actions";

export const dynamic = "force-dynamic";

type Search = { status?: string; month?: string; category?: string; error?: string; ok?: string };

function sumText(claims: Claim[]): string {
  if (!claims.length) return formatMoney(0, "INR");
  const by = new Map<string, number>();
  for (const c of claims) by.set(c.currency, (by.get(c.currency) ?? 0) + c.amount);
  return [...by.entries()]
    .sort(([a], [b]) => (a === "INR" ? -1 : b === "INR" ? 1 : a.localeCompare(b)))
    .map(([cur, amt]) => formatMoney(amt, cur))
    .join(" + ");
}

function Login({ error }: { error?: string }) {
  return (
    <main className="page narrow">
      <form action={login} className="card" style={{ maxWidth: 420 }}>
        <h1>Finance dashboard</h1>
        <p className="muted">Enter the finance password to see every claim and export them.</p>
        {error ? <div className="notice notice-error">{error}</div> : null}
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoFocus />
        </div>
        <button className="btn btn-primary">Open dashboard</button>
      </form>
    </main>
  );
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  if (!(await isFinanceUser())) return <Login error={sp.error} />;

  const status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : undefined;
  const category = CATEGORIES.includes(sp.category as Category) ? (sp.category as Category) : undefined;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : undefined;

  const [claims, monthClaims] = await Promise.all([
    listClaims({ status, category, month }),
    listClaims({ month }),
  ]);
  const t = totals(monthClaims);
  const pending = monthClaims.filter((c) => c.status === "submitted");
  const toPay = monthClaims.filter((c) => c.status === "approved");
  const paid = monthClaims.filter((c) => c.status === "paid");
  const flagged = pending.filter((c) => c.policy_flags.length);

  const qs = new URLSearchParams(
    Object.entries({ status, category, month }).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <main className="page">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1>Finance dashboard</h1>
          <p className="muted" style={{ margin: 0 }}>
            {month ? `Expenses dated ${month}` : "All claims"} · totals worked out by ClaimDesk
          </p>
        </div>
        <div className="row">
          <a className="btn" href={`/finance/export${qs ? `?${qs}` : ""}`}>
            Export CSV
          </a>
          <form action={logout}>
            <button className="btn">Log out</button>
          </form>
        </div>
      </div>

      {sp.ok ? <div className="notice notice-ok">{sp.ok}</div> : null}

      <div className="grid grid-3">
        <div className="card">
          <div className="stat-label">Waiting for approval</div>
          <div className="stat-value">{sumText(pending)}</div>
          <div className="muted small">
            {pending.length} claim{pending.length === 1 ? "" : "s"}
            {flagged.length ? ` · ${flagged.length} flagged` : ""}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Approved, to pay</div>
          <div className="stat-value">{sumText(toPay)}</div>
          <div className="muted small">
            {toPay.length} claim{toPay.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Paid</div>
          <div className="stat-value">{sumText(paid)}</div>
          <div className="muted small">
            {paid.length} claim{paid.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <form className="card row" method="get" action="/finance">
        <div style={{ minWidth: 160 }}>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 180 }}>
          <label htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={category ?? ""}>
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 160 }}>
          <label htmlFor="month">Expense month</label>
          <input id="month" name="month" type="month" defaultValue={month ?? ""} />
        </div>
        <div style={{ alignSelf: "flex-end" }} className="row">
          <button className="btn btn-primary">Filter</button>
          <Link className="btn" href="/finance">
            Clear
          </Link>
        </div>
      </form>

      <form action={payClaims} className="card">
        <input type="hidden" name="qs" value={qs} />
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Claims ({claims.length})</h2>
          <button className="btn btn-primary">Mark selected as paid</button>
        </div>
        {claims.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th aria-label="Select" />
                  <th>Claim</th>
                  <th>Employee</th>
                  <th>Merchant</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.status === "approved" ? (
                        <input type="checkbox" name="ids" value={c.id} aria-label={`Select ${c.code}`} style={{ width: "auto" }} />
                      ) : null}
                    </td>
                    <td>
                      <Link href={`/claims/${c.id}`}>{c.code}</Link>
                      {c.status === "submitted" ? (
                        <div className="small">
                          <a href={claimLinks(c).approval_url.replace(/^https?:\/\/[^/]+/, "")}>Review →</a>
                        </div>
                      ) : null}
                    </td>
                    <td>{c.employee_name}</td>
                    <td>{c.merchant}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(c.expense_date)}</td>
                    <td>{c.category}</td>
                    <td className="num">{formatMoney(c.amount, c.currency)}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="small">
                      {c.policy_flags.length ? (
                        <span title={c.policy_flags.join("\n")} style={{ color: "var(--warn)" }}>
                          ⚠ {c.policy_flags.length}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            No claims yet. File one from Claude and it will show up here.
          </p>
        )}
      </form>

      <div className="card">
        <h2>Spend by category</h2>
        <p className="muted small">
          {month ? `Expenses dated ${month}` : "All time"}, excluding rejected claims.
        </p>
        {t.currencies.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  {t.currencies.map((cur) => (
                    <th key={cur} className="num">
                      {cur}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.filter((c) => t.byCategory.has(c)).map((cat) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    {t.currencies.map((cur) => (
                      <td key={cur} className="num">
                        {t.byCategory.get(cat)?.get(cur) ? formatMoney(t.byCategory.get(cat)!.get(cur)!, cur) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Nothing to total yet.</p>
        )}
      </div>
    </main>
  );
}
