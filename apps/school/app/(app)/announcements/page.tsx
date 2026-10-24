import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Textarea } from "@corex/ui/components/textarea";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { AnnouncementList } from "@/components/announcement-list";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { schoolEnv } from "@/lib/env";
import { rows } from "@/lib/queries";
import { EDITION_ROLES, REGISTRAR, ROLE_LABEL } from "@/lib/roles";
import { getSession, memberHas } from "@/lib/session";
import { createAnnouncement, publishAnnouncement } from "./actions";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const { supabase, member } = await getSession();
  const registrar = memberHas(member, REGISTRAR);
  const drafts = registrar
    ? rows(
        await supabase
          .from("announcements")
          .select("id, title, body")
          .is("published_at", null)
          .order("created_at", { ascending: false }),
      )
    : [];
  return (
    <>
      <PageHeader title="Announcements" />
      <div className={registrar ? "grid gap-8 lg:grid-cols-[1fr_380px]" : ""}>
        <div className="flex flex-col gap-8">
          {drafts.length > 0 ? (
            <Section title="Drafts" id="drafts">
              <ul className="flex flex-col gap-3">
                {drafts.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-2 rounded-xl border border-dashed border-border-strong bg-background p-5"
                  >
                    <h3 className="text-lg font-bold">{d.title}</h3>
                    <p className="whitespace-pre-line text-ink-soft">{d.body}</p>
                    <div>
                      <ConfirmAction
                        action={publishAnnouncement}
                        fields={{ id: d.id }}
                        triggerLabel={`Publish ${d.title}`}
                        title="Publish this announcement?"
                        description="Members in its audience will see it on their dashboard."
                        confirmLabel="Publish"
                        variant="primary"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          <Section title="Published" id="published">
            <AnnouncementList db={supabase} />
          </Section>
        </div>
        {registrar ? (
          <Section title="New announcement" id="new">
            <ActionForm
              action={createAnnouncement}
              aria-label="New announcement"
              className="rounded-xl border border-border bg-background p-5"
            >
              <FormField name="title" label="Title" required>
                <Input />
              </FormField>
              <FormField name="body" label="Message" required>
                <Textarea rows={5} />
              </FormField>
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-semibold">Audience</legend>
                <p className="text-sm text-muted">Leave all unticked for everyone.</p>
                {EDITION_ROLES[schoolEnv().edition].map((role) => (
                  <label key={role} className="flex min-h-11 items-center gap-3">
                    <input type="checkbox" name="audience_roles" value={role} className="size-5" />
                    {ROLE_LABEL[role]}
                  </label>
                ))}
              </fieldset>
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name="publish" defaultChecked className="size-5" />
                Publish now
              </label>
              <div>
                <SubmitButton>Save announcement</SubmitButton>
              </div>
            </ActionForm>
          </Section>
        ) : null}
      </div>
    </>
  );
}
