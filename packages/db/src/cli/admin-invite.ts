// pnpm admin:invite --name "Name" --username name --email you@example.com \
//   --admin-url https://corex-admin.vercel.app [--project web] [--schema corex_web]
// Creates the first Corex Admin account and prints its 72-hour set-up link. With
// RESEND_API_KEY and EMAIL_FROM set, the link is also emailed. Later admins are invited
// from Settings → Team.
import { z } from "zod";
import { createFirstAdmin } from "../admin/team.ts";
import { connect } from "../db.ts";
import { databaseUrl } from "../env.ts";
import { supabaseAdmin, supabaseAdminConfig } from "../supabase-admin.ts";
import { parseOptions, run } from "./args.ts";

const options = parseOptions(
  'admin:invite --name "Name" --username <name> [--email <email>] --admin-url <url> [--project <label>] [--schema corex_web]',
  {
    name: z.string(),
    username: z.string(),
    email: z.string().optional(),
    "admin-url": z.url(),
    project: z.string().default("web"),
    schema: z.string().default("corex_web"),
  },
);

async function emailLink(to: string, name: string, link: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Set up your Corex Admin account",
      text: `Hello ${name},\n\nOpen this link within 72 hours to choose a password and set up an authenticator app for Corex Admin:\n${link}\n`,
    }),
  });
  return response.ok;
}

run(async () => {
  const sql = connect(databaseUrl(options.project));
  try {
    const auth = supabaseAdmin(supabaseAdminConfig(options.project));
    const { link } = await createFirstAdmin(sql, auth, {
      schema: options.schema,
      name: options.name,
      username: options.username,
      email: options.email ?? null,
      adminUrl: options["admin-url"],
    });
    const emailed = options.email ? await emailLink(options.email, options.name, link) : false;
    console.log(
      emailed
        ? `Set-up link emailed to ${options.email}. It works once, for 72 hours.`
        : `Set-up link (works once, for 72 hours):\n${link}`,
    );
  } finally {
    await sql.end();
  }
});
