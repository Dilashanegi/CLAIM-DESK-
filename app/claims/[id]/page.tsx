import { notFound } from "next/navigation";
import { formatMoney, getClaim, getEvents } from "@/lib/claims";
import { ClaimFields, PolicyFlags, StatusBadge, Timeline } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claim = await getClaim(id);
  if (!claim) notFound();
  const events = await getEvents(id);

  return (
    <main className="page narrow">
      <div className="card">
        <div className="claim-head">
          <div>
            <div className="muted small">{claim.code}</div>
            <div className="amount-big">{formatMoney(claim.amount, claim.currency)}</div>
            <div className="muted">{claim.merchant}</div>
          </div>
          <StatusBadge status={claim.status} />
        </div>
        <div style={{ marginTop: 16 }}>
          <PolicyFlags flags={claim.policy_flags} />
        </div>
        <ClaimFields claim={claim} />
      </div>

      <div className="card">
        <h2>History</h2>
        <Timeline events={events} />
      </div>
      <p className="muted small">
        This is the employee's view. Your manager approves from their own link.
      </p>
    </main>
  );
}
