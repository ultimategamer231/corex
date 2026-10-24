import type * as React from "react";
import { SubNav } from "@/components/sub-nav";

const ITEMS = [
  { href: "/academics", label: "Overview" },
  { href: "/academics/calendar", label: "Years and terms" },
  { href: "/academics/departments", label: "Departments" },
  { href: "/academics/programs", label: "Programs" },
  { href: "/academics/courses", label: "Courses" },
  { href: "/academics/offerings", label: "Offerings" },
  { href: "/academics/grade-scale", label: "Grade scale" },
];

export default function AcademicsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav label="Academics" items={ITEMS} />
      {children}
    </>
  );
}
