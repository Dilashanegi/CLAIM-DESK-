"use server";

import { redirect } from "next/navigation";
import {
  CATEGORIES,
  CURRENCIES,
  ClaimError,
  decideClaim,
  getClaim,
  updateClaim,
  type Category,
  type ClaimEdits,
  type Currency,
} from "@/lib/claims";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export async function approveAction(form: FormData): Promise<void> {
  return reviewClaim("approve", form);
}

export async function rejectAction(form: FormData): Promise<void> {
  return reviewClaim("reject", form);
}

export async function saveAction(form: FormData): Promise<void> {
  return reviewClaim("save", form);
}

async function reviewClaim(intent: "approve" | "reject" | "save", form: FormData): Promise<void> {
  const id = str(form, "id");
  const key = str(form, "key");
  const reviewer = str(form, "reviewer") || "Manager";
  const note = str(form, "note");
  const back = (params: Record<string, string>) =>
    `/approve/${encodeURIComponent(id)}?${new URLSearchParams({ key, ...params }).toString()}`;

  const claim = await getClaim(id);
  if (!claim || claim.approval_key !== key) redirect(back({ error: "This approval link is not valid." }));

  let message = "";
  try {
    if (intent === "save" || intent === "approve") {
      const category = str(form, "category") as Category;
      const currency = str(form, "currency") as Currency;
      const edits: ClaimEdits = {
        merchant: str(form, "merchant"),
        expense_date: str(form, "expense_date"),
        amount: Number(str(form, "amount")),
        tax_amount: Number(str(form, "tax_amount") || "0"),
        category: CATEGORIES.includes(category) ? category : undefined,
        currency: CURRENCIES.includes(currency) ? currency : undefined,
        description: str(form, "description"),
      };
      if (Number.isNaN(edits.amount)) throw new ClaimError("Amount must be a number.");
      if (Number.isNaN(edits.tax_amount)) throw new ClaimError("Tax must be a number.");
      await updateClaim(id, edits, reviewer);
      message = "Changes saved.";
    }
    if (intent === "approve") {
      await decideClaim(id, "approved", reviewer, note);
      message = "Claim approved. Finance can now pay it.";
    } else if (intent === "reject") {
      await decideClaim(id, "rejected", reviewer, note);
      message = "Claim rejected.";
    }
  } catch (err) {
    const msg = err instanceof ClaimError ? err.message : "Something went wrong. Try again.";
    if (!(err instanceof ClaimError)) console.error(err);
    redirect(back({ error: msg }));
  }
  redirect(back({ ok: message || "Nothing changed." }));
}
