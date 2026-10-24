"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { cn } from "@corex/ui/lib/utils";
import { CircleCheck, MessageCircle } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { submitQuote, type QuoteState } from "@/app/contact/actions";
import { contactCopy, planOptions, productOptions } from "@/content/contact";
import { whatsappLink } from "@/lib/contact";
import { quoteSchema, type QuoteInput } from "@/lib/leads/schema";

const fieldClass = "flex flex-col gap-2";
const errorClass = "text-sm font-medium text-danger";
const selectClass =
  "min-h-11 w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base text-ink focus-visible:border-primary aria-invalid:border-danger";

function Required() {
  return (
    <span className="text-danger" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

type QuoteFormProps = { defaultProduct?: string; sourcePage: string };

/** Quote request form (SPEC.md 6.6). "Send another request" starts a fresh form. */
export function QuoteForm(props: QuoteFormProps) {
  const [round, setRound] = useState(0);
  return <QuoteFormRound key={round} {...props} onAnother={() => setRound((r) => r + 1)} />;
}

function QuoteFormRound({
  defaultProduct,
  sourcePage,
  onAnother,
}: QuoteFormProps & { onAnother: () => void }) {
  const [state, action] = useActionState<QuoteState, FormData>(submitQuote, { status: "idle" });
  const [pending, startTransition] = useTransition();
  const successRef = useRef<HTMLDivElement>(null);
  const known = productOptions.some((o) => o.value === defaultProduct);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<QuoteInput>({
    resolver: zodResolver(quoteSchema),
    mode: "onTouched",
    defaultValues: {
      product: known ? defaultProduct : "",
      plan: "unsure",
      email: "",
      country: "Liberia",
    },
  });

  useEffect(() => {
    if (state.status === "error" && state.fieldErrors) {
      for (const [name, message] of Object.entries(state.fieldErrors)) {
        setError(name as keyof QuoteInput, { message });
      }
    }
    if (state.status === "success") successRef.current?.focus();
  }, [state, setError]);

  const onValid = (_values: QuoteInput, event?: React.BaseSyntheticEvent) => {
    const form = event?.target as HTMLFormElement | undefined;
    if (!form) return;
    startTransition(() => action(new FormData(form)));
  };

  if (state.status === "success") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-tint p-6 outline-none md:p-8"
      >
        <CircleCheck className="size-10 text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-bold">{contactCopy.success.title}</h2>
        <p className="text-[15px] leading-relaxed text-ink-soft">{contactCopy.success.text}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="primary">
            <a href={whatsappLink()}>Open WhatsApp</a>
          </Button>
          <Button variant="secondary" onClick={onAnother}>
            Send another request
          </Button>
        </div>
      </div>
    );
  }

  const describe = (name: keyof QuoteInput, hint?: string) =>
    [errors[name] ? `${name}-error` : null, hint].filter(Boolean).join(" ") || undefined;

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(onValid)(e)}
      className="flex flex-col gap-6 rounded-2xl border border-border bg-background p-[clamp(20px,3vw,32px)]"
      aria-describedby="form-required-note"
    >
      {state.status === "error" ? (
        <p
          role="alert"
          className="rounded-lg bg-danger-subtle px-4 py-3 text-[15px] font-medium text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className={fieldClass}>
          <Label htmlFor="f-name">
            Your name
            <Required />
          </Label>
          <Input
            id="f-name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describe("name")}
            {...register("name")}
          />
          {errors.name ? (
            <p id="name-error" className={errorClass}>
              {errors.name.message}
            </p>
          ) : null}
        </div>
        <div className={fieldClass}>
          <Label htmlFor="f-org">
            Organization
            <Required />
          </Label>
          <Input
            id="f-org"
            autoComplete="organization"
            aria-invalid={Boolean(errors.organization)}
            aria-describedby={describe("organization")}
            {...register("organization")}
          />
          {errors.organization ? (
            <p id="organization-error" className={errorClass}>
              {errors.organization.message}
            </p>
          ) : null}
        </div>
        <div className={fieldClass}>
          <Label htmlFor="f-country">
            Country
            <Required />
          </Label>
          <Input
            id="f-country"
            autoComplete="country-name"
            aria-invalid={Boolean(errors.country)}
            aria-describedby={describe("country")}
            {...register("country")}
          />
          {errors.country ? (
            <p id="country-error" className={errorClass}>
              {errors.country.message}
            </p>
          ) : null}
        </div>
        <div className={fieldClass}>
          <Label htmlFor="f-product">
            What do you need?
            <Required />
          </Label>
          <select
            id="f-product"
            className={selectClass}
            aria-invalid={Boolean(errors.product)}
            aria-describedby={describe("product")}
            {...register("product")}
          >
            <option value="">Choose one</option>
            {productOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {errors.product ? (
            <p id="product-error" className={errorClass}>
              {errors.product.message}
            </p>
          ) : null}
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-ink">Which plan interests you?</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {planOptions.map((o) => (
            <label
              key={o.value}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]"
            >
              <input
                type="radio"
                value={o.value}
                className="size-5 accent-primary"
                {...register("plan")}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className={fieldClass}>
          <Label htmlFor="f-phone">
            Phone or WhatsApp
            <Required />
          </Label>
          <Input
            id="f-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+231 ..."
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={describe("phone")}
            {...register("phone")}
          />
          {errors.phone ? (
            <p id="phone-error" className={errorClass}>
              {errors.phone.message}
            </p>
          ) : null}
        </div>
        <div className={fieldClass}>
          <Label htmlFor="f-email">
            Email <span className="font-normal text-muted">(optional)</span>
          </Label>
          <Input
            id="f-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describe("email")}
            {...register("email")}
          />
          {errors.email ? (
            <p id="email-error" className={errorClass}>
              {errors.email.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className={fieldClass}>
        <Label htmlFor="f-msg">
          Tell us about your needs
          <Required />
        </Label>
        <textarea
          id="f-msg"
          rows={5}
          className={cn(selectClass, "min-h-32 resize-y")}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describe("message", "f-msg-hint")}
          {...register("message")}
        />
        <p id="f-msg-hint" className="text-sm text-muted">
          {contactCopy.messageHint}
        </p>
        {errors.message ? (
          <p id="message-error" className={errorClass}>
            {errors.message.message}
          </p>
        ) : null}
      </div>

      {/* Honeypot for bots: hidden from people and assistive technology. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="f-website">Website</label>
        <input
          id="f-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      <input type="hidden" name="sourcePage" value={sourcePage} />

      <div className={fieldClass}>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] leading-relaxed">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-primary"
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={describe("consent")}
            {...register("consent")}
          />
          <span>
            {contactCopy.consent} <Required />{" "}
            <Link href="/legal/privacy" className="font-semibold text-primary underline">
              Privacy policy
            </Link>
          </span>
        </label>
        {errors.consent ? (
          <p id="consent-error" className={errorClass}>
            {errors.consent.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="accent" size="lg" disabled={pending}>
          {pending ? "Sending..." : "Send request"}
        </Button>
        <p id="form-required-note" className="text-sm text-muted">
          Fields marked * are required.
        </p>
      </div>
      <p className="text-sm text-muted">
        Prefer WhatsApp?{" "}
        <a
          href={whatsappLink("Hello Corex, I would like a quote.")}
          className="inline-flex items-center gap-1 font-semibold text-primary underline"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          Message us directly
        </a>
      </p>
    </form>
  );
}
