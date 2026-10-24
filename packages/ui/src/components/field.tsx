"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { Label } from "./label";

type ControlProps = {
  id?: string;
  name?: string;
  required?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export type FieldProps = {
  /** Form field name; also the start of the control's generated id. */
  name: string;
  label: React.ReactNode;
  /** One control element (Input, Select, Textarea). It receives id, name and aria props. */
  children: React.ReactElement<ControlProps>;
  error?: string | null;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  id?: string;
};

/**
 * Label, control, hint and inline error wired together for screen readers
 * (SPEC.md 5.4: inline validation messages).
 */
export function Field({ name, label, children, error, hint, required, className, id }: FieldProps) {
  // Unique per field, so two forms on one page never share an id.
  const autoId = React.useId();
  const controlId = id ?? `${name}-${autoId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const describedBy = [error ? `${controlId}-error` : null, hint ? `${controlId}-hint` : null]
    .filter(Boolean)
    .join(" ");
  const control = React.cloneElement(children, {
    id: controlId,
    name,
    required: required ?? children.props.required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  });
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={controlId}>
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {control}
      {hint ? (
        <p id={`${controlId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${controlId}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
