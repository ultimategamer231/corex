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
import { Select } from "@corex/ui/components/select";
import { toast } from "@corex/ui/components/sonner";
import { Textarea } from "@corex/ui/components/textarea";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { LeadForm, type LeadFormValues } from "@/components/leads/lead-form";
import { addLeadActivity, editLead, saveLeadStatus, saveQuote } from "@/app/(app)/leads/actions";
import { ACTIVITY_TYPES, STAGES } from "@/lib/leads";

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
  amount,
  currency,
  sentOn,
  note,
}: {
  leadId: string;
  amount: string;
  currency: string | null;
  sentOn: string | null;
  note: string | null;
}) {
  return (
    <ActionForm action={saveQuote} resetOnSuccess={false} aria-label="Quote">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid grid-cols-[6.5rem_1fr] gap-3">
        <FormField name="currency" label="Currency">
          <Select defaultValue={currency ?? "USD"}>
            <option value="USD">USD</option>
            <option value="LRD">LRD</option>
          </Select>
        </FormField>
        <FormField name="amount" label="Amount" required>
          <Input inputMode="decimal" defaultValue={amount} placeholder="4,000.00" />
        </FormField>
      </div>
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
