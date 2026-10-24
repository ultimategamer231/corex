// Shared by server actions and client forms; keep free of server-only imports.
export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Optional data for the form, for example a new record's id. */
  data?: Record<string, string>;
};

export const idleState: FormState = { status: "idle" };
