import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const FINANCE_COOKIE = "claimdesk_finance";

function token(password: string): string {
  return createHash("sha256").update(`claimdesk:${password}`).digest("hex");
}

export function financePassword(): string {
  return process.env.FINANCE_PASSWORD || "finance123";
}

export function passwordMatches(input: string): boolean {
  const a = Buffer.from(token(input));
  const b = Buffer.from(token(financePassword()));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionToken(): string {
  return token(financePassword());
}

export async function isFinanceUser(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(FINANCE_COOKIE)?.value === sessionToken();
}
