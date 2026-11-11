import { randomBytes } from "node:crypto";
import { ensureSchema, sql } from "./db";

// ---------- Fixed lists the app enforces (no AI involved) ----------

export const CATEGORIES = [
  "Travel",
  "Meals",
  "Software",
  "Office",
  "Client entertainment",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "SGD", "AED"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const STATUSES = ["submitted", "approved", "rejected", "paid"] as const;
export type Status = (typeof STATUSES)[number];

// Company policy: the most one claim may be in each category (INR).
export const POLICY_LIMITS_INR: Record<Category, number> = {
  Travel: 15000,
  Meals: 2000,
  Software: 10000,
  Office: 5000,
  "Client entertainment": 5000,
  Other: 3000,
};
const MAX_AGE_DAYS = 60;

// ---------- Types ----------

export type Claim = {
  id: string;
  number: number;
  code: string; // e.g. CLM-1004
  employee_name: string;
  employee_email: string;
  merchant: string;
  expense_date: string; // YYYY-MM-DD
  amount: number;
  currency: Currency;
  tax_amount: number;
  category: Category;
  description: string;
  status: Status;
  policy_flags: string[];
  approver_note: string;
  approval_key: string;
  created_at: string;
  updated_at: string;
};

export type ClaimEvent = {
  action: string;
  actor: string;
  note: string;
  created_at: string;
};

export type ClaimInput = {
  employee_name: string;
  employee_email: string;
  merchant: string;
  expense_date: string;
  amount: number;
  currency?: Currency;
  tax_amount?: number;
  category: Category;
  description?: string;
};

export type ClaimEdits = Partial<
  Pick<
    ClaimInput,
    "merchant" | "expense_date" | "amount" | "currency" | "tax_amount" | "category" | "description"
  >
>;

export class ClaimError extends Error {}

// ---------- Helpers ----------

function newId(): string {
  return randomBytes(6).toString("base64url"); // short, hard to guess
}

function newKey(): string {
  return randomBytes(18).toString("base64url");
}

function toDateString(d: unknown): string {
  if (d instanceof Date) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}

function rowToClaim(r: Record<string, unknown>): Claim {
  return {
    id: r.id as string,
    number: r.number as number,
    code: `CLM-${1000 + (r.number as number)}`,
    employee_name: r.employee_name as string,
    employee_email: r.employee_email as string,
    merchant: r.merchant as string,
    expense_date: toDateString(r.expense_date),
    amount: Number(r.amount),
    currency: r.currency as Currency,
    tax_amount: Number(r.tax_amount),
    category: r.category as Category,
    description: r.description as string,
    status: r.status as Status,
    policy_flags: (r.policy_flags as string[]) ?? [],
    approver_note: r.approver_note as string,
    approval_key: r.approval_key as string,
    created_at: new Date(r.created_at as string).toISOString(),
    updated_at: new Date(r.updated_at as string).toISOString(),
  };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function validate(c: ClaimInput): void {
  if (!c.employee_name?.trim()) throw new ClaimError("employee_name is required.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.employee_email ?? "")) {
    throw new ClaimError("employee_email must be a valid email address.");
  }
  if (!c.merchant?.trim()) throw new ClaimError("merchant is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.expense_date ?? "") || isNaN(Date.parse(c.expense_date))) {
    throw new ClaimError("expense_date must be a date in YYYY-MM-DD format.");
  }
  if (!(c.amount > 0)) throw new ClaimError("amount must be greater than 0.");
  if ((c.tax_amount ?? 0) < 0) throw new ClaimError("tax_amount cannot be negative.");
  if ((c.tax_amount ?? 0) > c.amount) throw new ClaimError("tax_amount cannot be more than amount.");
  if (!CATEGORIES.includes(c.category)) {
    throw new ClaimError(`category must be one of: ${CATEGORIES.join(", ")}.`);
  }
  if (c.currency && !CURRENCIES.includes(c.currency)) {
    throw new ClaimError(`currency must be one of: ${CURRENCIES.join(", ")}.`);
  }
}

// Policy checks: plain rules, run every time a claim is created or edited.
async function policyFlags(c: ClaimInput & { currency: Currency }, excludeId?: string): Promise<string[]> {
  const flags: string[] = [];
  if (c.currency === "INR") {
    const limit = POLICY_LIMITS_INR[c.category];
    if (c.amount > limit) {
      flags.push(`Over policy: ${c.category} limit is ${formatMoney(limit, "INR")} per claim`);
    }
  }
  const today = new Date(new Date().toISOString().slice(0, 10));
  const spent = new Date(c.expense_date);
  const ageDays = Math.floor((today.getTime() - spent.getTime()) / 86_400_000);
  if (ageDays < 0) flags.push("Expense date is in the future");
  else if (ageDays > MAX_AGE_DAYS) flags.push(`Submitted ${ageDays} days after the expense (limit ${MAX_AGE_DAYS})`);

  const dupes = await sql()`
    SELECT number FROM claims
    WHERE lower(employee_email) = lower(${c.employee_email})
      AND lower(merchant) = lower(${c.merchant})
      AND expense_date = ${c.expense_date}
      AND amount = ${c.amount}
      AND status <> 'rejected'
      AND (${excludeId ?? null}::text IS NULL OR id <> ${excludeId ?? null})
    LIMIT 1`;
  if (dupes.length) flags.push(`Possible duplicate of CLM-${1000 + (dupes[0].number as number)}`);
  return flags;
}

async function logEvent(claimId: string, action: string, actor: string, note = ""): Promise<void> {
  await sql()`INSERT INTO claim_events (claim_id, action, actor, note) VALUES (${claimId}, ${action}, ${actor}, ${note})`;
}

// ---------- Public operations ----------

export async function createClaim(input: ClaimInput): Promise<Claim> {
  await ensureSchema();
  const c = {
    ...input,
    employee_name: input.employee_name.trim(),
    employee_email: input.employee_email.trim().toLowerCase(),
    merchant: input.merchant.trim(),
    currency: input.currency ?? "INR",
    tax_amount: input.tax_amount ?? 0,
    description: (input.description ?? "").trim(),
  };
  validate(c);
  const flags = await policyFlags(c);
  const id = newId();
  const rows = await sql()`
    INSERT INTO claims (id, employee_name, employee_email, merchant, expense_date, amount, currency,
                        tax_amount, category, description, policy_flags, approval_key)
    VALUES (${id}, ${c.employee_name}, ${c.employee_email}, ${c.merchant}, ${c.expense_date}, ${c.amount},
            ${c.currency}, ${c.tax_amount}, ${c.category}, ${c.description}, ${sql().json(flags)}, ${newKey()})
    RETURNING *`;
  await logEvent(id, "submitted", c.employee_name, "Filed from Claude");
  return rowToClaim(rows[0]);
}

export async function getClaim(id: string): Promise<Claim | null> {
  await ensureSchema();
  const rows = await sql()`SELECT * FROM claims WHERE id = ${id}`;
  return rows.length ? rowToClaim(rows[0]) : null;
}

export async function getClaimByCode(codeOrId: string): Promise<Claim | null> {
  await ensureSchema();
  const m = /^CLM-(\d+)$/i.exec(codeOrId.trim());
  const rows = m
    ? await sql()`SELECT * FROM claims WHERE number = ${Number(m[1]) - 1000}`
    : await sql()`SELECT * FROM claims WHERE id = ${codeOrId.trim()}`;
  return rows.length ? rowToClaim(rows[0]) : null;
}

export async function getEvents(id: string): Promise<ClaimEvent[]> {
  await ensureSchema();
  const rows = await sql()`SELECT action, actor, note, created_at FROM claim_events WHERE claim_id = ${id} ORDER BY id`;
  return rows.map((r) => ({
    action: r.action as string,
    actor: r.actor as string,
    note: r.note as string,
    created_at: new Date(r.created_at as string).toISOString(),
  }));
}

export async function listClaims(filters: {
  status?: Status;
  employee_email?: string;
  month?: string; // YYYY-MM
  category?: Category;
} = {}): Promise<Claim[]> {
  await ensureSchema();
  const db = sql();
  const status = filters.status ?? null;
  const email = filters.employee_email?.trim().toLowerCase() || null;
  const category = filters.category ?? null;
  const month = filters.month && /^\d{4}-\d{2}$/.test(filters.month) ? `${filters.month}-01` : null;
  const rows = await db`
    SELECT * FROM claims
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (${email}::text IS NULL OR lower(employee_email) = ${email})
      AND (${category}::text IS NULL OR category = ${category})
      AND (${month}::date IS NULL OR date_trunc('month', expense_date) = ${month}::date)
    ORDER BY number DESC
    LIMIT 500`;
  return rows.map(rowToClaim);
}

// Edits are only allowed before a decision is made.
export async function updateClaim(id: string, edits: ClaimEdits, actor: string): Promise<Claim> {
  const current = await getClaim(id);
  if (!current) throw new ClaimError("Claim not found.");
  if (current.status !== "submitted") {
    throw new ClaimError(`${current.code} is already ${current.status} and can no longer be edited.`);
  }
  const next = {
    employee_name: current.employee_name,
    employee_email: current.employee_email,
    merchant: edits.merchant?.trim() ?? current.merchant,
    expense_date: edits.expense_date ?? current.expense_date,
    amount: edits.amount ?? current.amount,
    currency: edits.currency ?? current.currency,
    tax_amount: edits.tax_amount ?? current.tax_amount,
    category: edits.category ?? current.category,
    description: edits.description?.trim() ?? current.description,
  };
  validate(next);

  const changed = (Object.keys(edits) as (keyof ClaimEdits)[])
    .filter((k) => edits[k] !== undefined && String(edits[k]) !== String(current[k]))
    .map((k) => `${k.replace("_", " ")}: ${current[k]} → ${next[k]}`);
  if (!changed.length) return current;

  const flags = await policyFlags(next, id);
  const rows = await sql()`
    UPDATE claims SET merchant = ${next.merchant}, expense_date = ${next.expense_date}, amount = ${next.amount},
      currency = ${next.currency}, tax_amount = ${next.tax_amount}, category = ${next.category},
      description = ${next.description}, policy_flags = ${sql().json(flags)}, updated_at = now()
    WHERE id = ${id} RETURNING *`;
  await logEvent(id, "edited", actor, changed.join("; "));
  return rowToClaim(rows[0]);
}

export async function decideClaim(
  id: string,
  decision: "approved" | "rejected",
  actor: string,
  note: string,
): Promise<Claim> {
  const current = await getClaim(id);
  if (!current) throw new ClaimError("Claim not found.");
  if (current.status !== "submitted") {
    throw new ClaimError(`${current.code} is already ${current.status}.`);
  }
  if (decision === "rejected" && !note.trim()) {
    throw new ClaimError("Add a note saying why the claim is rejected.");
  }
  const rows = await sql()`
    UPDATE claims SET status = ${decision}, approver_note = ${note.trim()}, updated_at = now()
    WHERE id = ${id} AND status = 'submitted' RETURNING *`;
  if (!rows.length) throw new ClaimError("The claim changed while you were looking at it. Reload and try again.");
  await logEvent(id, decision, actor, note.trim());
  return rowToClaim(rows[0]);
}

export async function markPaid(ids: string[], actor: string): Promise<number> {
  await ensureSchema();
  if (!ids.length) return 0;
  const rows = await sql()`
    UPDATE claims SET status = 'paid', updated_at = now()
    WHERE id IN ${sql()(ids)} AND status = 'approved' RETURNING id`;
  for (const r of rows) await logEvent(r.id as string, "paid", actor);
  return rows.length;
}

// Totals per category and currency, worked out by the app.
export function totals(claims: Claim[]) {
  const byCategory = new Map<string, Map<string, number>>();
  const byStatus = new Map<string, Map<string, number>>();
  for (const c of claims) {
    if (c.status === "rejected") continue;
    const cat = byCategory.get(c.category) ?? new Map<string, number>();
    cat.set(c.currency, (cat.get(c.currency) ?? 0) + c.amount);
    byCategory.set(c.category, cat);
  }
  for (const c of claims) {
    const st = byStatus.get(c.status) ?? new Map<string, number>();
    st.set(c.currency, (st.get(c.currency) ?? 0) + c.amount);
    byStatus.set(c.status, st);
  }
  const currencies = [...new Set(claims.map((c) => c.currency))].sort((a, b) =>
    a === "INR" ? -1 : b === "INR" ? 1 : a.localeCompare(b),
  );
  return { byCategory, byStatus, currencies };
}

export function toCsv(claims: Claim[]): string {
  const header = [
    "Claim", "Status", "Employee", "Email", "Merchant", "Expense date", "Category",
    "Amount", "Tax", "Currency", "Description", "Policy flags", "Approver note", "Submitted at",
  ];
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = claims.map((c) =>
    [
      c.code, c.status, c.employee_name, c.employee_email, c.merchant, c.expense_date, c.category,
      c.amount.toFixed(2), c.tax_amount.toFixed(2), c.currency, c.description,
      c.policy_flags.join(" | "), c.approver_note, c.created_at,
    ].map(esc).join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function claimLinks(c: Claim) {
  const base = appUrl();
  return {
    claim_url: `${base}/claims/${c.id}`,
    approval_url: `${base}/approve/${c.id}?key=${c.approval_key}`,
  };
}
