"use server";

import { z } from "zod";
import { runAction } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { runStatusChecks } from "@/lib/status-check";

/** System status → Check now: the same check the schedule runs every 10 minutes. */
export async function checkNow(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: z.object({}), revalidate: ["/status", "/"] },
    async (_data, session) => {
      const { checked, down } = await runStatusChecks(session.service());
      return down === 0
        ? `Checked ${checked} site${checked === 1 ? "" : "s"}: all up.`
        : `Checked ${checked} site${checked === 1 ? "" : "s"}: ${down} down.`;
    },
  );
}
