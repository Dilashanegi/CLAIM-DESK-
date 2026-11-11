import postgres from "postgres";

// One connection pool per server instance (reused across hot reloads in dev).
const globalForDb = globalThis as unknown as {
  sql?: postgres.Sql;
  schemaReady?: Promise<void>;
};

function makeClient(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add your Postgres connection string.");
  }
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    prepare: false, // works with Neon / PgBouncer poolers
    types: {
      // Return NUMERIC columns as JS numbers instead of strings.
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
    },
  });
}

export function sql(): postgres.Sql {
  if (!globalForDb.sql) globalForDb.sql = makeClient();
  return globalForDb.sql;
}

// Creates the tables on first use, so there is no separate migration step.
export function ensureSchema(): Promise<void> {
  if (!globalForDb.schemaReady) {
    const db = sql();
    globalForDb.schemaReady = (async () => {
      await db`
        CREATE TABLE IF NOT EXISTS claims (
          id             TEXT PRIMARY KEY,
          number         SERIAL UNIQUE,
          employee_name  TEXT NOT NULL,
          employee_email TEXT NOT NULL,
          merchant       TEXT NOT NULL,
          expense_date   DATE NOT NULL,
          amount         NUMERIC(12,2) NOT NULL,
          currency       TEXT NOT NULL DEFAULT 'INR',
          tax_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
          category       TEXT NOT NULL,
          description    TEXT NOT NULL DEFAULT '',
          status         TEXT NOT NULL DEFAULT 'submitted',
          policy_flags   JSONB NOT NULL DEFAULT '[]'::jsonb,
          approver_note  TEXT NOT NULL DEFAULT '',
          approval_key   TEXT NOT NULL,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS claim_events (
          id         SERIAL PRIMARY KEY,
          claim_id   TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
          action     TEXT NOT NULL,
          actor      TEXT NOT NULL,
          note       TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await db`CREATE INDEX IF NOT EXISTS claim_events_claim_idx ON claim_events (claim_id)`;
    })().catch((err) => {
      globalForDb.schemaReady = undefined; // retry on next request
      throw err;
    });
  }
  return globalForDb.schemaReady;
}
