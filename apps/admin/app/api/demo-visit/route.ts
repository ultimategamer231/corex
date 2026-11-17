import { z } from "zod";
import { cronRoute } from "@/lib/cron";
import { getServiceSupabase } from "@/lib/supabase";

const visitSchema = z.object({
  demo: z.enum(["college", "highschool", "clinic", "finance"]),
  role: z.string().regex(/^[a-z][a-z0-9_]{0,30}$/),
});

/**
 * Demo visits (audit round F3): each public demo posts `{ demo, role }` here after a
 * sign-in, with `Authorization: Bearer <DEMO_VISITS_SECRET>`. Only a count per day,
 * demo and role is kept.
 */
export const POST = cronRoute(
  "demo visit",
  async (context, request) => {
    const parsed = visitSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new Error("Send a demo and a role.");
    const { error } = await getServiceSupabase(context).rpc("record_demo_visit", {
      p_demo: parsed.data.demo,
      p_role: parsed.data.role,
    });
    if (error) throw new Error(error.message);
    return {};
  },
  "DEMO_VISITS_SECRET",
);
