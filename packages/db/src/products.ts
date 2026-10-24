export const PRODUCTS = ["school", "clinic", "finance"] as const;
export type Product = (typeof PRODUCTS)[number];

/**
 * Role given to the first user of a new schema. Each product names its top
 * role differently (SPEC.md 7.1, 8.1, 9.1).
 */
export const FIRST_ADMIN_ROLE: Record<Product, string> = {
  school: "super_admin",
  clinic: "admin",
  finance: "owner",
};

/** Roles treated as administrators by the core policies (settings, users, audit log). */
export const ADMIN_ROLES = ["super_admin", "admin", "owner"] as const;
