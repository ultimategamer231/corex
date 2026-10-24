import { notFound } from "next/navigation";
import { type Edition, schoolEnv } from "./env";

/** This instance's edition (EDITION), read at request time. */
export function edition(): Edition {
  return schoolEnv().edition;
}

/** Pages that exist in one edition only are a 404 in the other. */
export function requireEdition(wanted: Edition): void {
  if (edition() !== wanted) notFound();
}
