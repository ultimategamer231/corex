// School roles (SPEC.md 7.1).
export const ROLES = [
  "super_admin",
  "registrar",
  "instructor",
  "teacher",
  "bursar",
  "student",
  "parent",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  registrar: "Registrar",
  instructor: "Instructor",
  teacher: "Teacher",
  bursar: "Bursar",
  student: "Student",
  parent: "Parent",
};

/** Roles an administrator can give in each edition. */
export const EDITION_ROLES = {
  college: ["super_admin", "registrar", "instructor", "bursar", "student"],
  highschool: ["super_admin", "registrar", "teacher", "bursar", "student", "parent"],
} as const satisfies Record<string, readonly Role[]>;

export const OFFICE: readonly Role[] = ["super_admin", "registrar", "bursar"];
export const REGISTRAR: readonly Role[] = ["super_admin", "registrar"];
export const BURSAR: readonly Role[] = ["super_admin", "bursar"];
export const TEACHING: readonly Role[] = ["instructor", "teacher"];

export function hasAnyRole(roles: readonly string[], allowed: readonly Role[]): boolean {
  return allowed.some((r) => roles.includes(r));
}

export function roleLabel(roles: readonly string[]): string {
  const known = ROLES.filter((r) => roles.includes(r));
  return known.map((r) => ROLE_LABEL[r]).join(", ") || "Member";
}
