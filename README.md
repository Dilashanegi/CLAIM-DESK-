# ClaimDesk

Expense claims filed from Claude and approved by people. There is **no AI inside this app**: the customer's own Claude reads the receipt, and ClaimDesk handles everything after that.

- **Employee (in Claude):** shares a receipt and says "File this as an expense claim." Claude reads it and calls ClaimDesk.
- **Manager (approval link):** sees policy flags, fixes anything Claude read wrong, approves or rejects with a note.
- **Finance (`/finance`):** every claim in one place, totals by category, mark claims paid, export CSV.

## What's in the box

| Path | What it does |
|---|---|
| `app/api/mcp/route.ts` | The MCP server Claude connects to: `submit_claim`, `list_claims`, `update_claim` |
| `lib/claims.ts` | Claim rules: categories, policy limits, duplicate and date checks, status flow, totals, CSV |
| `lib/db.ts` | Postgres connection. Creates the tables on first use, so there's no migration step |
| `app/page.tsx` | Landing page with the connect steps and policy table |
| `app/claims/[id]` | Employee's read-only claim view with history |
| `app/approve/[id]` | Manager's review page (needs the secret `key` from the approval link) |
| `app/finance` | Password-protected finance dashboard and CSV export |

Claude can connect at either `https://YOUR-APP/mcp` or `https://YOUR-APP/api/mcp`.

## Deploy it (about 15 minutes, all free tiers)

### 1. Create the database (Neon)
1. Sign up at **neon.tech** and create a project (any name, any region; Singapore is closest to India).
2. On the project dashboard, click **Connect** and copy the connection string. It starts with `postgresql://` and ends with `?sslmode=require`.

### 2. Put the code on GitHub
1. Create a new **empty** repository on github.com, e.g. `claimdesk`.
2. Click **uploading an existing file** and drag in everything from this folder (not a `node_modules` folder if you have one). Commit.

### 3. Deploy on Vercel
1. Sign up at **vercel.com** with your GitHub account.
2. **Add New → Project**, pick the `claimdesk` repo, click **Import**.
3. Open **Environment Variables** and add:
   - `DATABASE_URL` = the Neon connection string from step 1
   - `FINANCE_PASSWORD` = a password for the finance dashboard (you'll send this to the reviewers)
4. Click **Deploy**. When it finishes you get a link like `https://claimdesk-xyz.vercel.app`.
5. Open that link. The landing page shows your exact MCP URL.

`APP_URL` is optional. Vercel fills in the public address itself; set it only if you add a custom domain.

### 4. Connect it to Claude
1. In Claude, go to **Settings → Connectors → Add custom connector**.
2. Name: `ClaimDesk`. URL: `https://YOUR-APP.vercel.app/mcp`. Click **Add**.
3. Start a new chat, make sure ClaimDesk is turned on in the chat's tools menu, attach a receipt photo, and say:
   > File this as an expense claim. I'm Dilasha Negi, dilasha@yourcompany.com. It was a client lunch with Acme.
4. Claude replies with the claim number, any policy flags, the claim link and the manager's approval link.

Other prompts that work well in the demo:
- "Change CLM-1001 to Client entertainment."
- "What claims are still waiting for approval this month?"
- "How much have we spent on travel in November?"

## Run it on your laptop (optional)

```bash
npm install
cp .env.example .env.local   # then put your Neon DATABASE_URL and a FINANCE_PASSWORD in it
npm run dev                  # http://localhost:3000
```

## Policy rules (edit in `lib/claims.ts`)

| Category | Limit per claim (INR) |
|---|---|
| Travel | 15,000 |
| Meals | 2,000 |
| Software | 10,000 |
| Office | 5,000 |
| Client entertainment | 5,000 |
| Other | 3,000 |

Also flagged: possible duplicates (same person, merchant, date and amount), future dates, and receipts older than 60 days. Flags warn the manager; they don't block the claim.

## Known limits of v1 (good "next steps" for the pitch)

- **One company per deployment, no sign-in on the MCP endpoint.** Anyone with the URL can file a claim. v2: a workspace per company with OAuth sign-in from Claude.
- **Receipt images aren't stored**, only the fields Claude reads off them. v2: upload the receipt on the claim page.
- **Approval links are the manager's login.** Anyone holding a link can approve that one claim. v2: manager accounts and email notifications.
- **Payouts are marked by hand.** v2: pay approved claims directly, then add cards.

## What to send Volopay

> **Video:** <link>
>
> **Live app:** https://YOUR-APP.vercel.app
> Finance dashboard: https://YOUR-APP.vercel.app/finance (password: `YOUR_FINANCE_PASSWORD`)
>
> **MCP link:** https://YOUR-APP.vercel.app/mcp
> To connect: in Claude, Settings → Connectors → Add custom connector → paste the link → Add. In a new chat, turn on ClaimDesk, attach any receipt and say "File this as an expense claim." Claude returns the claim and the manager's approval link; open it to edit and approve, then see it on the finance dashboard.
