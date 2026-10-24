import type * as React from "react";
import { SubNav } from "@/components/sub-nav";
import { edition } from "@/lib/edition";

const COLLEGE = [
  { href: "/academics", label: "Overview" },
  { href: "/academics/calendar", label: "Years and terms" },
  { href: "/academics/departments", label: "Departments" },
  { href: "/academics/programs", label: "Programs" },
  { href: "/academics/courses", label: "Courses" },
  { href: "/academics/offerings", label: "Offerings" },
  { href: "/academics/grade-scale", label: "Grade scale" },
];

const HIGH_SCHOOL = [
  { href: "/academics", label: "Overview" },
  { href: "/academics/calendar", label: "Years and terms" },
  { href: "/academics/grade-levels", label: "Grade levels" },
  { href: "/academics/sections", label: "Sections" },
  { href: "/academics/subjects", label: "Subjects" },
  { href: "/academics/marking-periods", label: "Marking periods" },
];

export default function AcademicsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav label="Academics" items={edition() === "college" ? COLLEGE : HIGH_SCHOOL} />
      {children}
    </>
  );
}
