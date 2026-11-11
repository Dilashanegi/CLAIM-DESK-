import { notFound } from "next/navigation";
import { CATEGORIES, CURRENCIES, formatMoney, getClaim, getEvents } from "@/lib/claims";
import { ClaimFields, PolicyFlags, StatusBadge, Timeline } from "@/lib/ui";
import { approveAction, rejectAction, saveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ApprovePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string; error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { key = "", error, ok } = await searchParams;
  const claim = await getClaim(id);
  if (!claim) notFound();

  if (claim.approval_key !== key) {
    return (
      <main className="page narrow">
        <div className="card">
          <h1>Link not valid</h1>
          <p className="muted">
            This approval link is missing its key or has been changed. Use the full link that came
            with the claim.
          </p>
        </div>
      </main>
    );
  }

  const events = await getEvents(id);
  const open = claim.status === "submitted";

  return (
    <main className="page narrow">
      {error ? <div className="notice notice-error">{error}</div> : null}
      {ok ? <div className="notice notice-ok">{ok}</div> : null}

      <div className="card">
        <div className="claim-head">
          <div>
            <div className="muted small">
              {claim.code} · {open ? "waiting for your review" : `already ${claim.status}`}
            </div>
            <div className="amount-big">{formatMoney(claim.amount, claim.currency)}</div>
            <div className="muted">
              {claim.employee_name} · {claim.merchant}
            </div>
          </div>
          <StatusBadge status={claim.status} />
        </div>
        <div style={{ marginTop: 16 }}>
          <PolicyFlags flags={claim.policy_flags} />
        </div>
        {!open ? <ClaimFields claim={claim} /> : null}
      </div>

      {open ? (
        <form action={approveAction} className="card">
          <h2>Review and edit</h2>
          <p className="muted small">
            Fix anything Claude read wrong, then approve or reject. Every change is logged.
          </p>
          <input type="hidden" name="id" value={claim.id} />
          <input type="hidden" name="key" value={key} />

          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="merchant">Merchant</label>
              <input id="merchant" name="merchant" defaultValue={claim.merchant} required />
            </div>
            <div className="field">
              <label htmlFor="expense_date">Expense date</label>
              <input id="expense_date" name="expense_date" type="date" defaultValue={claim.expense_date} required />
            </div>
            <div className="field">
              <label htmlFor="amount">Amount (incl. tax)</label>
              <input id="amount" name="amount" type="number" step="0.01" min="0.01" defaultValue={claim.amount} required />
            </div>
            <div className="field">
              <label htmlFor="tax_amount">Tax (GST/VAT)</label>
              <input id="tax_amount" name="tax_amount" type="number" step="0.01" min="0" defaultValue={claim.tax_amount} />
            </div>
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" name="category" defaultValue={claim.category}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="currency">Currency</label>
              <select id="currency" name="currency" defaultValue={claim.currency}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">What it was for</label>
            <input id="description" name="description" defaultValue={claim.description} />
          </div>
          <div className="field">
            <label htmlFor="reviewer">Your name</label>
            <input id="reviewer" name="reviewer" placeholder="e.g. Priya (Team lead)" />
          </div>
          <div className="field">
            <label htmlFor="note">Note to the employee (required to reject)</label>
            <textarea id="note" name="note" placeholder="e.g. Approved, but keep client lunches under ₹2,000 next time." />
          </div>
          <div className="row">
            <button className="btn btn-ok" formAction={approveAction} data-intent="approve">
              Approve
            </button>
            <button className="btn btn-bad" formAction={rejectAction} formNoValidate data-intent="reject">
              Reject
            </button>
            <button className="btn" formAction={saveAction} data-intent="save">
              Save changes only
            </button>
          </div>
        </form>
      ) : null}

      <div className="card">
        <h2>History</h2>
        <Timeline events={events} />
      </div>
    </main>
  );
}
