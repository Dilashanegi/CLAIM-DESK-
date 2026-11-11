import type { Claim, ClaimEvent } from "./claims";
import { formatMoney } from "./claims";

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export function formatDate(d: string): string {
  const date = new Date(d.length === 10 ? `${d}T00:00:00Z` : d);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(d: string): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function PolicyFlags({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <div>
      {flags.map((f) => (
        <div className="flag" key={f}>
          <span aria-hidden>⚠</span>
          <span>{f}</span>
        </div>
      ))}
    </div>
  );
}

export function ClaimFields({ claim }: { claim: Claim }) {
  return (
    <dl className="fields">
      <dt>Employee</dt>
      <dd>
        {claim.employee_name} <span className="muted small">({claim.employee_email})</span>
      </dd>
      <dt>Merchant</dt>
      <dd>{claim.merchant}</dd>
      <dt>Expense date</dt>
      <dd>{formatDate(claim.expense_date)}</dd>
      <dt>Category</dt>
      <dd>{claim.category}</dd>
      <dt>Tax (GST/VAT)</dt>
      <dd>{formatMoney(claim.tax_amount, claim.currency)}</dd>
      <dt>What for</dt>
      <dd>{claim.description || <span className="muted">No description</span>}</dd>
      {claim.approver_note ? (
        <>
          <dt>Manager's note</dt>
          <dd>{claim.approver_note}</dd>
        </>
      ) : null}
    </dl>
  );
}

const ACTION_LABEL: Record<string, string> = {
  submitted: "Submitted",
  edited: "Edited",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Marked paid",
};

export function Timeline({ events }: { events: ClaimEvent[] }) {
  return (
    <ul className="timeline">
      {events.map((e, i) => (
        <li key={i}>
          <div>
            <strong>{ACTION_LABEL[e.action] ?? e.action}</strong> by {e.actor}
          </div>
          {e.note ? <div className="small">{e.note}</div> : null}
          <div className="when">{formatDateTime(e.created_at)}</div>
        </li>
      ))}
    </ul>
  );
}
