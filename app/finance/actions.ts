"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { markPaid } from "@/lib/claims";
import { FINANCE_COOKIE, isFinanceUser, passwordMatches, sessionToken } from "@/lib/finance-auth";

export async function login(form: FormData): Promise<void> {
  const password = String(form.get("password") ?? "");
  if (!passwordMatches(password)) redirect("/finance?error=Wrong+password");
  const jar = await cookies();
  jar.set(FINANCE_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/finance");
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(FINANCE_COOKIE);
  redirect("/finance");
}

export async function payClaims(form: FormData): Promise<void> {
  if (!(await isFinanceUser())) redirect("/finance");
  const ids = form.getAll("ids").map(String).filter(Boolean);
  const qs = String(form.get("qs") ?? "");
  const count = await markPaid(ids, "Finance");
  const params = new URLSearchParams(qs);
  params.set("ok", count ? `${count} claim${count === 1 ? "" : "s"} marked paid.` : "Select approved claims to mark paid.");
  redirect(`/finance?${params.toString()}`);
}
