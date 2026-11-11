import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  CATEGORIES,
  CURRENCIES,
  POLICY_LIMITS_INR,
  STATUSES,
  ClaimError,
  claimLinks,
  createClaim,
  formatMoney,
  getClaimByCode,
  listClaims,
  updateClaim,
  type Claim,
} from "@/lib/claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const limitsText = CATEGORIES.map((c) => `${c} ${formatMoney(POLICY_LIMITS_INR[c], "INR")}`).join(", ");

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function fail(err: unknown) {
  const message = err instanceof ClaimError ? err.message : "Something went wrong on the ClaimDesk server. Try again.";
  if (!(err instanceof ClaimError)) console.error(err);
  return { ...text(`Error: ${message}`), isError: true };
}

function summary(c: Claim) {
  return {
    claim: c.code,
    status: c.status,
    employee: `${c.employee_name} <${c.employee_email}>`,
    merchant: c.merchant,
    expense_date: c.expense_date,
    amount: formatMoney(c.amount, c.currency),
    tax: formatMoney(c.tax_amount, c.currency),
    category: c.category,
    description: c.description,
    policy_flags: c.policy_flags,
    approver_note: c.approver_note || undefined,
    claim_url: claimLinks(c).claim_url,
  };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "submit_claim",
      {
        title: "Submit expense claim",
        description:
          "File an expense claim in ClaimDesk from a receipt. Read the receipt (photo or PDF) yourself and pass the fields. " +
          "Ask the user for their name and work email if you don't already know them. " +
          `category must be exactly one of: ${CATEGORIES.join(", ")}. ` +
          "amount is the total paid including tax, as a plain number with no currency symbol or commas. " +
          "tax_amount is the GST/VAT shown on the receipt (0 if none). expense_date is the receipt date as YYYY-MM-DD. " +
          `Company policy limits per claim (INR): ${limitsText}. ClaimDesk flags anything over a limit, duplicates and old receipts. ` +
          "Returns the claim number, any policy flags, the employee's claim link and the manager's approval link. " +
          "Show the user both links.",
        inputSchema: z.object({
          employee_name: z.string().min(1).describe("Full name of the person claiming"),
          employee_email: z.string().email().describe("Their work email"),
          merchant: z.string().min(1).describe("Business name on the receipt"),
          expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Receipt date, YYYY-MM-DD"),
          amount: z.number().positive().describe("Total paid including tax"),
          currency: z.enum(CURRENCIES).default("INR"),
          tax_amount: z.number().min(0).default(0).describe("GST/VAT on the receipt, 0 if none"),
          category: z.enum(CATEGORIES),
          description: z.string().default("").describe("One line: what it was for, e.g. 'Client lunch with Acme'"),
        }),
      },
      async (args) => {
        try {
          const claim = await createClaim(args);
          const links = claimLinks(claim);
          return text({
            ...summary(claim),
            approval_url: links.approval_url,
            next_step: "Send the approval_url to the employee's manager. They can edit, approve or reject it there.",
          });
        } catch (err) {
          return fail(err);
        }
      },
    );

    server.registerTool(
      "list_claims",
      {
        title: "List expense claims",
        description:
          "List claims in ClaimDesk, newest first, to answer questions like 'what's still pending?' or " +
          "'how much did we spend on travel this month?'. All filters are optional. " +
          `status is one of: ${STATUSES.join(", ")}. month is YYYY-MM (by expense date).`,
        inputSchema: z.object({
          status: z.enum(STATUSES).optional(),
          employee_email: z.string().optional().describe("Only this person's claims"),
          month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM"),
          category: z.enum(CATEGORIES).optional(),
        }),
      },
      async (args) => {
        try {
          const claims = await listClaims(args);
          return text({ count: claims.length, claims: claims.map(summary) });
        } catch (err) {
          return fail(err);
        }
      },
    );

    server.registerTool(
      "update_claim",
      {
        title: "Update expense claim",
        description:
          "Correct a claim that has not been approved or rejected yet, for example 'change CLM-1004 to Travel'. " +
          "Identify it by its claim number (e.g. CLM-1004). Only pass the fields that change. " +
          "Policy checks run again after the edit.",
        inputSchema: z.object({
          claim: z.string().min(1).describe("Claim number, e.g. CLM-1004"),
          merchant: z.string().min(1).optional(),
          expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          amount: z.number().positive().optional(),
          currency: z.enum(CURRENCIES).optional(),
          tax_amount: z.number().min(0).optional(),
          category: z.enum(CATEGORIES).optional(),
          description: z.string().optional(),
        }),
      },
      async ({ claim: ref, ...edits }) => {
        try {
          const existing = await getClaimByCode(ref);
          if (!existing) throw new ClaimError(`No claim found for ${ref}.`);
          const updated = await updateClaim(existing.id, edits, `${existing.employee_name} (via Claude)`);
          return text(summary(updated));
        } catch (err) {
          return fail(err);
        }
      },
    );
  },
  { serverInfo: { name: "ClaimDesk", version: "1.0.0" } },
);

export { handler as GET, handler as POST, handler as DELETE };
