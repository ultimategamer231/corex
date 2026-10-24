"use client";

import { Alert } from "@corex/ui/components/alert";
import { Button, type ButtonProps } from "@corex/ui/components/button";
import { Field, type FieldProps } from "@corex/ui/components/field";
import { cn } from "@corex/ui/lib/utils";
import {
  createContext,
  use,
  useActionState,
  useEffect,
  useEffectEvent,
  useRef,
  useTransition,
} from "react";
import { type FormState, idleState } from "@/lib/form-state";

type Ctx = { state: FormState; pending: boolean };
const FormContext = createContext<Ctx>({ state: idleState, pending: false });

export type ActionFormProps = {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  /** Clear the inputs after a successful save (default true). */
  resetOnSuccess?: boolean;
  onSuccess?: (state: FormState) => void;
  "aria-label"?: string;
};

/**
 * Form bound to a server action. Errors appear inline next to each field and in a
 * message above the form; inputs keep their values when saving fails.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = true,
  onSuccess,
  ...rest
}: ActionFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = useEffectEvent((result: FormState) => {
    if (resetOnSuccess) formRef.current?.reset();
    onSuccess?.(result);
  });

  useEffect(() => {
    if (state.status === "success") succeeded(state);
  }, [state]);

  return (
    <FormContext value={{ state, pending }}>
      <form
        ref={formRef}
        noValidate
        className={cn("flex flex-col gap-4", className)}
        aria-label={rest["aria-label"]}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
      >
        {state.status === "error" && state.message ? (
          <Alert tone="danger">{state.message}</Alert>
        ) : null}
        {state.status === "success" && state.message ? (
          <Alert tone="success">{state.message}</Alert>
        ) : null}
        {children}
      </form>
    </FormContext>
  );
}

/** A Field whose error comes from the surrounding ActionForm's last result. */
export function FormField(props: Omit<FieldProps, "error">) {
  const { state } = use(FormContext);
  return <Field {...props} error={state.fieldErrors?.[props.name]} />;
}

export function SubmitButton({
  children,
  pendingLabel = "Saving...",
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = use(FormContext);
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** The surrounding ActionForm's last result, for fields that appear conditionally. */
export function useFormResult(): FormState {
  return use(FormContext).state;
}
