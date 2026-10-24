"use server";

import { z } from "zod";
import { must, requiredText, runAction, uuid } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { REGISTRAR, ROLES } from "@/lib/roles";

const schema = z.object({
  title: requiredText("a title", 160),
  body: requiredText("the message", 4000),
  audience_roles: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]))
    .pipe(z.array(z.enum(ROLES))),
  publish: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export async function createAnnouncement(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: REGISTRAR, schema, revalidate: ["/announcements", "/"] },
    async (d, { supabase }) => {
      must(
        await supabase.from("announcements").insert({
          title: d.title,
          body: d.body,
          audience_roles: d.audience_roles,
          published_at: d.publish ? new Date().toISOString() : null,
        }),
      );
      return d.publish ? "Announcement published." : "Announcement saved as a draft.";
    },
  );
}

export async function publishAnnouncement(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: REGISTRAR, schema: z.object({ id: uuid() }), revalidate: ["/announcements", "/"] },
    async ({ id }, { supabase }) => {
      must(
        await supabase
          .from("announcements")
          .update({ published_at: new Date().toISOString() })
          .eq("id", id),
      );
      return "Announcement published.";
    },
  );
}
