import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page narrow">
      <div className="card">
        <h1>Claim not found</h1>
        <p className="muted">Check the link, or ask the person who sent it for a new one.</p>
        <Link href="/">Back to ClaimDesk</Link>
      </div>
    </main>
  );
}
