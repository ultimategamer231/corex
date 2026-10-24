"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { Label } from "./label";

/** What a Field tells its control: Input, Select and Textarea read it. */
export type FieldControl = {
  id: string;
  name: string;
  required?: boolean;
  invalid: boolean;
  describedBy?: string;
};

const FieldContext = React.createContext<FieldControl | null>(null);

/**
 * Props for a control inside a Field. Explicit props win; the rest come from the
 * Field. Context is used instead of cloning the child because a Server Component
 * child can arrive as a lazy element whose props are not readable yet.
 */
type ControlProps = {
  id?: string;
  name?: string;
  required?: boolean;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-describedby"?: string;
};

export function useFieldControlProps<P extends ControlProps>(props: P): P {
  const field = React.use(FieldContext);
  if (!field) return props;
  return {
    ...props,
    id: props.id ?? field.id,
    name: props.name ?? field.name,
    required: props.required ?? field.required,
    "aria-invalid": props["aria-invalid"] ?? (field.invalid ? true : undefined),
    "aria-describedby": props["aria-describedby"] ?? field.describedBy,
  };
}

export type FieldProps = {
  /** Form field name; also the start of the control's generated id. */
  name: string;
  label: React.ReactNode;
  /** One control (Input, Select, Textarea); it receives id, name and aria props. */
  children: React.ReactNode;
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
  const control: FieldControl = {
    id: controlId,
    name,
    required,
    invalid: Boolean(error),
    describedBy: describedBy || undefined,
  };
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
      <FieldContext value={control}>{children}</FieldContext>
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
