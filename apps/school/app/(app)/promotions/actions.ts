"use server";

import { z } from "zod";
import { ActionError, must, runAction, uuid } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { REGISTRAR } from "@/lib/roles";

const DECISIONS = ["promoted", "repeat", "conditional"] as const;

const decisionsSchema = z.looseObject({ academic_year_id: uuid() });

/** Saves the year-end decision for each student of a section (SPEC.md 7.4). */
export async function saveDecisions(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: REGISTRAR, schema: decisionsSchema, revalidate: ["/promotions"] },
    async (d, { supabase, member }) => {
      const values = d as Record<string, unknown>;
      const rows = Object.entries(values)
        .filter(([key, value]) => key.startsWith("decision_") && value)
        .map(([key, value]) => {
          const studentId = key.slice("decision_".length);
          const decision = DECISIONS.find((x) => x === value);
          const note = values[`note_${studentId}`];
          if (!decision || !z.uuid().safeParse(studentId).success)
            throw new ActionError("The list is incomplete. Reload the page and try again.");
          return {
            student_id: studentId,
            academic_year_id: d.academic_year_id,
            decision,
            note: typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : null,
            decided_by: member.userId,
          };
        });
      if (rows.length === 0) throw new ActionError("Choose a decision for at least one student.");
      must(
        await supabase
          .from("promotions")
          .upsert(rows, { onConflict: "student_id,academic_year_id" }),
      );
      return `${rows.length} decision${rows.length === 1 ? "" : "s"} saved.`;
    },
  );
}

const applySchema = z.object({ from_year_id: uuid(), to_year_id: uuid("the next year") });

/** Places students in next year's sections from the decisions; top grade promoted = graduated. */
export async function applyPromotions(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    {
      roles: REGISTRAR,
      schema: applySchema,
      revalidate: ["/promotions", "/students", "/academics"],
    },
    async (d, { supabase }) => {
      const n = must(
        await supabase.rpc("apply_promotions", {
          p_from_year_id: d.from_year_id,
          p_to_year_id: d.to_year_id,
        }),
      );
      return n === 0
        ? "No students to place: they are already placed or have no decision."
        : `${n} student${n === 1 ? "" : "s"} placed in the new year.`;
    },
  );
}
