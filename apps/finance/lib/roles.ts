// Finance roles (SPEC.md 9.1).
export const ROLES = ["owner", "admin", "accountant", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  staff: "Staff",
};

/** Owner / Admin: settings, users, payroll approval and payment. */
export const OWNER: readonly Role[] = ["owner", "admin"];
/** Owner, Admin or Accountant: everything except users and payroll approval. */
export const MANAGER: readonly Role[] = ["owner", "admin", "accountant"];
/** Everyone who records entries. */
export const RECORDERS: readonly Role[] = ["owner", "admin", "accountant", "staff"];

export function hasAnyRole(roles: readonly string[], allowed: readonly Role[]): boolean {
  return allowed.some((r) => roles.includes(r));
}

export function roleLabel(roles: readonly string[]): string {
  const known = ROLES.filter((r) => roles.includes(r));
  return known.map((r) => ROLE_LABEL[r]).join(", ") || "Member";
}
