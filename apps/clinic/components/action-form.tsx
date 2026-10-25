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
  useState,
  useTransition,
} from "react";
import { useOptionalOffline } from "@corex/core/offline/react";
import { formObject } from "@/lib/fields";
import { type FormState, idleState } from "@/lib/form-state";
import { OFFLINE_FORMS, type OfflineForm, type OfflineFormName } from "@/lib/offline-forms";

type Ctx = { state: FormState; pending: boolean };
const FormContext = createContext<Ctx>({ state: idleState, pending: false });

export type ActionFormProps = {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  /** Clear the inputs after a successful save (default true). */
  resetOnSuccess?: boolean;
  onSuccess?: (state: FormState) => void;
  /** Without a connection, keep the record on this device for later sync (SPEC.md 10). */
  offline?: OfflineFormName;
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
  offline,
  ...rest
}: ActionFormProps) {
  const [serverState, formAction] = useActionState(action, idleState);
  const [pending, startTransition] = useTransition();
  // The result of the last offline save, until the next submit.
  const [localState, setLocalState] = useState<FormState | null>(null);
  const state = localState ?? serverState;
  const formRef = useRef<HTMLFormElement>(null);
  const device = useOptionalOffline();
  const succeeded = useEffectEvent((result: FormState) => {
    if (resetOnSuccess) formRef.current?.reset();
    onSuccess?.(result);
  });

  useEffect(() => {
    if (serverState.status === "success") succeeded(serverState);
  }, [serverState]);

  async function saveOnDevice(form: HTMLFormElement, data: FormData, name: OfflineFormName) {
    const config: OfflineForm = OFFLINE_FORMS[name];
    const raw: Record<string, unknown> = formObject(data);
    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
      // A rule about the whole form (an incomplete register) is the message itself.
      setLocalState({
        status: "error",
        message: fieldErrors.form ?? "Please check the highlighted fields.",
        fieldErrors,
      });
      return;
    }
    // Files (a receipt photo) are kept on the device with the record.
    for (const [key, value] of data.entries()) {
      if (!(value instanceof File) || value.size === 0) continue;
      if (value.size > (config.maxFileBytes ?? 0)) {
        const mb = (config.maxFileBytes ?? 0) / 1_000_000;
        setLocalState({
          status: "error",
          message: "Please check the highlighted fields.",
          fieldErrors: { [key]: `Offline, files can be up to ${mb} MB.` },
        });
        return;
      }
      raw[key] = value;
    }
    const id = typeof raw.id === "string" ? raw.id : crypto.randomUUID();
    if (!device) return;
    await device.save(config.table, raw, id);
    setLocalState({ status: "success", message: config.saved(raw) });
    if (!config.keepValues) form.reset();
    // The next record gets its own id.
    const idInput = form.elements.namedItem("id");
    if (idInput instanceof HTMLInputElement) idInput.value = crypto.randomUUID();
  }

  return (
    <FormContext value={{ state, pending }}>
      <form
        ref={formRef}
        noValidate
        className={cn("flex flex-col gap-4", className)}
        aria-label={rest["aria-label"]}
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          if (offline && device && !navigator.onLine) {
            void saveOnDevice(form, data, offline);
            return;
          }
          setLocalState(null);
          startTransition(() => formAction(data));
        }}
      >
        {state.status === "error" && state.message ? (
          <Alert tone="danger" className="w-full">
            {state.message}
          </Alert>
        ) : null}
        {state.status === "success" && state.message ? (
          <Alert tone="success" className="w-full">
            {state.message}
          </Alert>
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
