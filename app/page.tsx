import { CATEGORIES, POLICY_LIMITS_INR, appUrl, formatMoney } from "@/lib/claims";

export const dynamic = "force-dynamic";

export default function Home() {
  const mcpUrl = `${appUrl()}/mcp`;
  return (
    <main className="page">
      <section className="hero">
        <span className="pill">Works inside your Claude · no AI bill</span>
        <h1>Snap a receipt in Claude. Get it approved in one tap.</h1>
        <p>
          ClaimDesk turns the receipt you share with Claude into an expense claim, sends it to your
          manager, checks it against company policy, and gives finance one clean list at month-end.
        </p>
      </section>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>1. Employee asks Claude</h3>
          <p className="muted">
            “File this receipt as a claim, client lunch with Acme.” Claude reads the receipt and
            sends the details to ClaimDesk.
          </p>
        </div>
        <div className="card">
          <h3>2. Manager approves</h3>
          <p className="muted">
            They open the approval link, see any policy flags, fix the category or amount, and
            approve or reject with a note.
          </p>
        </div>
        <div className="card">
          <h3>3. Finance closes the month</h3>
          <p className="muted">
            Every claim in one dashboard, totals by category, mark claims paid and export a CSV for
            accounting.
          </p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Connect ClaimDesk to Claude</h2>
          <ol className="steps" style={{ marginTop: 16 }}>
            <li>
              In Claude, open <strong>Settings → Connectors</strong>.
            </li>
            <li>
              Choose <strong>Add custom connector</strong>, name it ClaimDesk, and paste:
              <div style={{ marginTop: 6 }}>
                <code>{mcpUrl}</code>
              </div>
            </li>
            <li>
              In a new chat, turn on ClaimDesk, attach a receipt and say{" "}
              <em>“File this as an expense claim.”</em>
            </li>
          </ol>
        </div>

        <div className="card">
          <h2>Company policy</h2>
          <p className="muted small">
            Plain rules ClaimDesk applies to every claim. Breaks are flagged for the manager, not
            blocked.
          </p>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Limit per claim</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((c) => (
                <tr key={c}>
                  <td>{c}</td>
                  <td className="num">{formatMoney(POLICY_LIMITS_INR[c], "INR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
            Also flagged: possible duplicates, future dates, and receipts older than 60 days.
          </p>
        </div>
      </div>
    </main>
  );
}
