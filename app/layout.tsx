import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimDesk",
  description: "Expense claims filed from Claude, approved by your manager in one tap.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">
              <span className="brand-mark">₹</span> ClaimDesk
            </Link>
            <nav className="nav">
              <Link href="/">How it works</Link>
              <Link href="/finance">Finance</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
