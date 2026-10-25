"use server";

import { AuthError, requireMember, SESSION_HOURS } from "@corex/core/auth";
import { type ItemHandler, receiveOutboxItem, SyncError } from "@corex/core/offline/server";
import type { SyncResponse } from "@corex/core/offline/transport";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { dbMessage, demoWriteAllowed } from "@/lib/action";
import { clinicEnv } from "@/lib/env";
import { CLINICAL, FRONT_DESK, hasAnyRole, type Role } from "@/lib/roles";
import { patientForm, patientRow, vitalsSchema } from "@/lib/schemas";
import { asAuthClient, getSupabase } from "@/lib/supabase";

/**
 * Stores one record saved on a device while offline (SPEC.md 10.2). The member's
 * current access is checked for every item, so someone suspended while offline cannot
 * sync (OFF-03); the insert ignores a record that is already there (OFF-02).
 */
export async function syncOutbox(form: FormData): Promise<SyncResponse> {
  const supabase = await getSupabase();
  let roles: string[];
  let userId: string;
  try {
    const member = await requireMember(asAuthClient(supabase), {
      sessionHours: SESSION_HOURS.clinic,
    });
    roles = member.roles;
    userId = member.userId;
  } catch (error) {
    if (error instanceof AuthError) return { status: "error", message: error.message };
    throw error;
  }
  if (clinicEnv().demo && !(await demoWriteAllowed(supabase))) {
    return { status: "error", message: "Too many changes in a short time. Try again in a minute." };
  }

  const allowed = (needed: readonly Role[]) => {
    if (!hasAnyRole(roles, needed)) throw new SyncError("Your role cannot save this record.");
  };
  const stored = (result: {
    data: unknown[] | null;
    error: { message: string; code?: string } | null;
  }) => {
    if (result.error) throw new SyncError(dbMessage(result.error));
    return (result.data?.length ?? 0) > 0 ? "created" : "exists";
  };
  const parse = <T>(schema: z.ZodType<T>, payload: unknown): T => {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new SyncError(parsed.error.issues[0]?.message ?? "Some values are not valid.");
    }
    return parsed.data;
  };

  const handlers: Record<string, ItemHandler> = {
    // The database numbers the patient and flags a possible duplicate (CLN-08).
    patients: async ({ payload }) => {
      allowed(FRONT_DESK);
      const d = parse(patientForm, payload);
      return stored(
        await supabase
          .from("patients")
          .upsert(
            { id: d.id, patient_number: "", ...patientRow(d) },
            { onConflict: "id", ignoreDuplicates: true },
          )
          .select("id"),
      );
    },
    vitals: async ({ payload }) => {
      allowed(CLINICAL);
      const d = parse(vitalsSchema, payload);
      return stored(
        await supabase
          .from("vitals")
          .upsert({ ...d, recorded_by: userId }, { onConflict: "id", ignoreDuplicates: true })
          .select("id"),
      );
    },
  };

  const result = await receiveOutboxItem(form, handlers);
  if (result.status === "created") {
    for (const path of ["/patients", "/queue", "/encounters", "/"]) revalidatePath(path, "layout");
  }
  return result;
}
