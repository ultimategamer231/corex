import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@corex/ui/components/card";
import { cn } from "@corex/ui/lib/utils";
import { Mail, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActivityForm, EditLeadDialog, QuoteForm, StatusForm } from "@/components/leads/lead-forms";
import { StageBadge } from "@/components/leads/stage-badge";
import { formatDateTime, formatDay } from "@/lib/format";
import {
  activityLabel,
  planLabel,
  productLabel,
  STAGES,
  stageLabel,
  whatsappLink,
} from "@/lib/leads";
import {
  findDuplicates,
  LEAD_COLUMNS,
  type LeadRow,
  quoteText,
  teamMembers,
} from "@/lib/leads-data";
import { getAdminSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

async function loadLead(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await getAdminSession();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  return { supabase, lead: data as unknown as LeadRow };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lead } = await loadLead((await params).id);
  return { title: `${lead.organization} | Leads` };
}

type Entry = {
  id: string;
  type: string;
  body: string;
  admin_id: string | null;
  created_at: string;
};

export default async function LeadPage({ params }: Props) {
  const { supabase, lead } = await loadLead((await params).id);
  const [timeline, team, duplicates] = await Promise.all([
    supabase
      .from("lead_activities")
      .select("id, type, body, admin_id, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
    teamMembers(supabase),
    findDuplicates(supabase, lead),
  ]);
  if (timeline.error) throw new Error(timeline.error.message);
  const entries = (timeline.data ?? []) as Entry[];
  const names = new Map(team.map((a) => [a.id, a.name]));
  const whatsapp = whatsappLink(lead.phone, lead.country);
  const website = lead.source === "website";
  const quote = quoteText(lead);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
        <Link
          href="/leads"
          className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary hover:underline"
        >
          Leads
        </Link>{" "}
        / {lead.organization}
      </nav>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              {lead.organization}
            </h1>
            <StageBadge stage={lead.stage} />
          </div>
          <p className="text-[15px] text-ink-soft">
            {lead.name}
            {lead.country ? ` · ${lead.country}` : ""} · Received {formatDay(lead.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "secondary" })}
            >
              <MessageCircle aria-hidden="true" />
              WhatsApp
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className={buttonVariants({ variant: "secondary" })}>
              <Mail aria-hidden="true" />
              Email
            </a>
          ) : null}
        </div>
      </header>

      {duplicates.length > 0 ? (
        <Alert tone="warning" className="flex flex-col gap-1">
          <p className="font-bold">This may be a duplicate</p>
          <ul className="flex flex-col gap-1">
            {duplicates.map((d) => (
              <li key={d.id}>
                Same {d.matched_on === "phone" ? "phone number" : "email"} as{" "}
                <Link href={`/leads/${d.id}`} className="font-semibold underline">
                  {d.organization} ({d.name})
                </Link>
                , {stageLabel(d.stage)}.
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <StageSteps stage={lead.stage} lostReason={lead.lost_reason} />

      {/* Phones: request, then status and quote, then the timeline. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card className="min-w-0 lg:col-start-1 lg:row-start-1">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>{website ? "Original request" : "Lead details"}</CardTitle>
              <p className="text-sm text-muted">
                {website
                  ? `Quote form${lead.source_page ? ` on ${lead.source_page}` : ""} · ${formatDateTime(lead.created_at)}`
                  : `Added by hand · ${formatDateTime(lead.created_at)}`}
              </p>
            </div>
            {website ? (
              <Badge variant="neutral">Read-only</Badge>
            ) : (
              <EditLeadDialog
                values={{
                  leadId: lead.id,
                  name: lead.name,
                  organization: lead.organization,
                  phone: lead.phone,
                  email: lead.email,
                  country: lead.country,
                  product: lead.product,
                  plan: lead.plan_interest,
                  message: lead.message,
                }}
              />
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Detail term="Contact">{lead.name}</Detail>
              <Detail term="Interested in">{productLabel(lead.product)}</Detail>
              <Detail term="Plan">{planLabel(lead.plan_interest)}</Detail>
              <Detail term="Phone / WhatsApp">{lead.phone ?? "—"}</Detail>
              <Detail term="Email">
                {lead.email ? <span className="break-all">{lead.email}</span> : "—"}
              </Detail>
              <Detail term="Country">{lead.country ?? "—"}</Detail>
              {website ? (
                <Detail term="Consent to contact">{lead.consent ? "Yes" : "No"}</Detail>
              ) : null}
            </dl>
            {lead.message ? (
              <blockquote className="rounded-lg border-l-4 border-primary bg-surface px-4 py-3 text-[15px] whitespace-pre-line text-ink">
                {lead.message}
              </blockquote>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Card id="status" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusForm
                leadId={lead.id}
                stage={lead.stage}
                lostReason={lead.lost_reason}
                assigned={lead.assigned_admin_id}
                followUp={lead.follow_up_on}
                nextStep={lead.next_step}
                team={team.filter((a) => a.status === "active" || a.id === lead.assigned_admin_id)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quote</CardTitle>
              {quote ? (
                <p className="text-sm text-muted">
                  {lead.quote_sent_on ? `Sent ${formatDay(lead.quote_sent_on)}` : "Not sent yet"}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {quote ? (
                <div className="flex flex-col gap-1">
                  <p className="font-display text-2xl font-bold text-ink">{quote}</p>
                  {lead.quote_note ? (
                    <p className="text-[15px] text-ink-soft">{lead.quote_note}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-[15px] text-muted">No quote recorded yet.</p>
              )}
              <QuoteForm
                leadId={lead.id}
                amount={quote ? quote.replace(/^(US\$|L\$)/, "") : ""}
                currency={lead.quote_currency}
                sentOn={lead.quote_sent_on}
                note={lead.quote_note}
              />
            </CardContent>
          </Card>
        </div>
        <Card className="min-w-0 lg:col-start-1 lg:row-start-2">
          <CardHeader>
            <CardTitle>Notes and activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ActivityForm leadId={lead.id} />
            <ol aria-label="Timeline" className="flex flex-col gap-4">
              {entries.map((e) => (
                <li key={e.id} className="flex gap-3 border-t border-border-subtle pt-4">
                  <Badge variant={timelineBadge(e.type)} className="h-fit shrink-0">
                    {activityLabel(e.type)}
                  </Badge>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-[15px] break-words whitespace-pre-line text-ink">{e.body}</p>
                    <p className="text-sm text-muted">
                      {e.admin_id
                        ? (names.get(e.admin_id) ?? "Former admin")
                        : e.type === "form"
                          ? "Website"
                          : "System"}{" "}
                      · {formatDateTime(e.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm font-semibold text-muted">{term}</dt>
      <dd className="text-[15px] text-ink">{children}</dd>
    </div>
  );
}

function timelineBadge(type: string) {
  if (type === "quote") return "warning" as const;
  if (type === "demo" || type === "form") return "info" as const;
  if (type === "stage_change") return "neutral" as const;
  return "brand" as const;
}

/** The stage stepper: New → Contacted → Demo booked → Quoted → Won, or Lost. */
function StageSteps({ stage, lostReason }: { stage: string; lostReason: string | null }) {
  if (stage === "lost") {
    return (
      <Alert tone="info" className="flex flex-col gap-1">
        <p className="font-bold">This lead was lost</p>
        <p>{lostReason}</p>
      </Alert>
    );
  }
  const steps = STAGES.filter(([key]) => key !== "lost");
  const at = steps.findIndex(([key]) => key === stage);
  return (
    <ol aria-label="Stage" className="grid grid-cols-5 gap-2">
      {steps.map(([key, label], i) => (
        <li
          key={key}
          aria-current={i === at ? "step" : undefined}
          className="flex flex-col gap-2 text-sm"
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 rounded-full",
              i < at ? "bg-primary" : i === at ? "bg-accent" : "bg-border",
            )}
          />
          <span
            className={cn(
              "leading-tight",
              i === at ? "font-bold text-ink" : i < at ? "text-ink" : "text-muted",
            )}
          >
            {label}
            {i === at ? <span className="sr-only"> (current stage)</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
