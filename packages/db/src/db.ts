import postgres, { type Sql } from "postgres";

/** Postgres client for scripts. Notices (for example "already exists") are silenced. */
export function connect(url: string): Sql {
  return postgres(url, {
    max: 1,
    onnotice: () => undefined,
    connection: { application_name: "corex-db" },
  });
}
