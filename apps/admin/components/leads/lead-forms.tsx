"use client";

import { Button } from "@corex/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@corex/ui/components/dialog";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { Select } from "@corex/ui/components/select";
import { toast } from "@corex/ui/components/sonner";
import { Textarea } from "@corex/ui/components/textarea";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { ActionForm, FormField, SubmitButton, useFormResult } from "@/components/action-form";
import { LeadForm, type LeadFormValues } from "@/components/leads/lead-form";
import { addLeadActivity, editLead, saveLeadStatus, saveQuote } from "@/app/(app)/leads/actions";
import { ACTIVITY_TYPES, QUOTE_ROWS, STAGES } from "@/lib/leads";

type Member = { id: string; name: string };

/** LEAD-04: stage, assignment and follow-up. Choosing Lost asks for the reason. */
export function StatusForm({
  leadId,
  stage,
  lostReason,
  assigned,
  followUp,
  nextStep,
  team,
}: {
  leadId: string;
  stage: string;
  lostReason: string | null;
  assigned: string | null;
  followUp: string | null;
  nextStep: string | null;
  team: Member[];
}) {
  const [chosen, setChosen] = useState(stage);
  return (
    <ActionForm action={saveLeadStatus} resetOnSuccess={false} aria-label="Lead status">
      <input type="hidden" name="leadId" value={leadId} />
      <FormField name="stage" label="Stage">
        <Select value={chosen} onChange={(e) => setChosen(e.target.value)}>
          {STAGES.map(([key, label]) => (
            <option key={key} value={key}>
              {key === "lost" ? "Lost (reason required)" : label}
            </option>
          ))}
        </Select>
      </FormField>
      {chosen === "lost" ? (
        <FormField name="lostReason" label="Why was it lost?" required>
          <Textarea rows={2} defaultValue={lostReason ?? ""} />
        </FormField>
      ) : null}
      <FormField name="assigned" label="Assigned to">
        <Select defaultValue={assigned ?? ""}>
          <option value="">Unassigned</option>
          {team.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField name="followUp" label="Next follow-up">
        <Input type="date" defaultValue={followUp ?? ""} />
      </FormField>
      <FormField name="nextStep" label="Next step">
        <Input defaultValue={nextStep ?? ""} placeholder="For example: book a demo" />
      </FormField>
      <div>
        <SubmitButton variant="primary">Save status</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** The quote sent to the lead. Each save adds a Quote entry to the timeline. */
export function QuoteForm({
  leadId,
  lines,
  currency,
  sentOn,
  note,
}: {
  leadId: string;
  /** Rows to show, prices in major units as text. */
  lines: { description: string; quantity: string; price: string }[];
  currency: string | null;
  sentOn: string | null;
  note: string | null;
}) {
  const rows = Array.from({ length: QUOTE_ROWS }, (_, i) => lines[i] ?? null);
  return (
    <ActionForm action={saveQuote} resetOnSuccess={false} aria-label="Quote">
      <input type="hidden" name="leadId" value={leadId} />
      <FormField name="currency" label="Currency">
        <Select defaultValue={currency ?? "USD"} className="w-32">
          <option value="USD">USD</option>
          <option value="LRD">LRD</option>
        </Select>
      </FormField>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-ink">
          Items <span className="font-normal text-muted">(empty rows are left out)</span>
        </legend>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_4.5rem] gap-2 sm:grid-cols-[1fr_4.5rem_8rem]">
            <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
              <Label htmlFor={`quote-item-${i}`}>Item {i + 1}</Label>
              <Input
                id={`quote-item-${i}`}
                name="lineDescription"
                defaultValue={row?.description ?? ""}
                placeholder={i === 0 ? "Clinic Management, first year" : undefined}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`quote-qty-${i}`}>
                Qty<span className="sr-only"> {i + 1}</span>
              </Label>
              <Input
                id={`quote-qty-${i}`}
                name="lineQuantity"
                inputMode="numeric"
                defaultValue={row?.quantity ?? "1"}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`quote-price-${i}`}>
                Price<span className="sr-only"> {i + 1}</span>
              </Label>
              <Input
                id={`quote-price-${i}`}
                name="linePrice"
                inputMode="decimal"
                defaultValue={row?.price ?? ""}
                placeholder="0.00"
              />
            </div>
          </div>
        ))}
        <QuoteLineErrors />
      </fieldset>
      <FormField name="sentOn" label="Sent on" hint="Leave empty while the quote is a draft">
        <Input type="date" defaultValue={sentOn ?? ""} />
      </FormField>
      <FormField name="note" label="What it covers">
        <Textarea rows={2} defaultValue={note ?? ""} />
      </FormField>
      <div>
        <SubmitButton variant="secondary">Save quote</SubmitButton>
      </div>
    </ActionForm>
  );
}

function QuoteLineErrors() {
  const { fieldErrors } = useFormResult();
  const messages = ["lineDescription", "lineQuantity", "linePrice"]
    .map((k) => fieldErrors?.[k])
    .filter(Boolean);
  return messages.length > 0 ? (
    <ul className="text-sm font-semibold text-danger">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  ) : null;
}

/** LEAD-05: adds an entry to the timeline. Entries cannot be edited afterwards. */
export function ActivityForm({ leadId }: { leadId: string }) {
  return (
    <ActionForm action={addLeadActivity} aria-label="Add to timeline">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <FormField name="type" label="Activity type">
          <Select defaultValue="note">
            {ACTIVITY_TYPES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField name="body" label="What happened" required>
          <Textarea rows={3} />
        </FormField>
      </div>
      <p className="text-sm text-muted">Entries cannot be edited or removed once added.</p>
      <div>
        <SubmitButton variant="primary">Add to timeline</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Corrects a lead added by hand; website requests stay as sent (LEAD-01). */
export function EditLeadDialog({ values }: { values: LeadFormValues }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Pencil aria-hidden="true" />
          Edit details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="pr-10 text-xl font-bold">Edit lead details</DialogTitle>
        <DialogDescription className="text-[15px] text-ink-soft">
          Changes are recorded in the activity log.
        </DialogDescription>
        <LeadForm
          action={editLead}
          values={values}
          submitLabel="Save details"
          onSaved={() => {
            setOpen(false);
            toast.success("Details saved.");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
