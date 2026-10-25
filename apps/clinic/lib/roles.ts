// Clinic roles (SPEC.md 8.1).
export const ROLES = ["admin", "clinician", "nurse", "receptionist", "cashier"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  clinician: "Clinician",
  nurse: "Nurse",
  receptionist: "Receptionist",
  cashier: "Cashier",
};

export const ADMIN: readonly Role[] = ["admin"];
/** Notes and full history. */
export const CLINICIAN: readonly Role[] = ["clinician"];
/** Vitals, intake and patient attachments. */
export const CLINICAL: readonly Role[] = ["clinician", "nurse"];
/** Patients, appointments and the queue. */
export const FRONT_DESK: readonly Role[] = ["receptionist", "clinician", "nurse"];
/** Bills, payments and receipts. */
export const BILLING: readonly Role[] = ["cashier"];
/** Operational reports: the Admin and the Cashier. */
export const REPORTS: readonly Role[] = ["admin", "cashier"];
/** Everyone: patient lists and the day's appointments. */
export const MEMBERS: readonly Role[] = ROLES;

export function hasAnyRole(roles: readonly string[], allowed: readonly Role[]): boolean {
  return allowed.some((r) => roles.includes(r));
}

export function roleLabel(roles: readonly string[]): string {
  const known = ROLES.filter((r) => roles.includes(r));
  return known.map((r) => ROLE_LABEL[r]).join(", ") || "Member";
}
