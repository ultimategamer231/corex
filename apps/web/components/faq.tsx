"use client";

import { Accordion } from "radix-ui";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";

export type FaqItem = { q: string; a: string; link?: { label: string; href: string } };

/** FAQ accordion: one answer open at a time, keyboard accessible (Radix). */
export function Faq({
  items,
  defaultOpen = true,
}: {
  items: readonly FaqItem[];
  defaultOpen?: boolean;
}) {
  return (
    <Accordion.Root
      type="single"
      collapsible
      defaultValue={defaultOpen ? "item-0" : undefined}
      className="border-t border-border"
    >
      {items.map((item, i) => (
        <Accordion.Item key={item.q} value={`item-${i}`} className="group border-b border-border">
          <Accordion.Header>
            <Accordion.Trigger className="flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left text-[17px] font-semibold text-ink">
              {item.q}
              <Plus
                className="size-6 shrink-0 text-primary group-data-[state=open]:hidden"
                aria-hidden="true"
              />
              <Minus
                className="hidden size-6 shrink-0 text-primary group-data-[state=open]:block"
                aria-hidden="true"
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="max-w-[720px] pb-5 text-[15px] leading-relaxed text-muted">
            {item.a}
            {item.link ? (
              <>
                {" "}
                <Link href={item.link.href} className="font-semibold text-primary underline">
                  {item.link.label}
                </Link>
                .
              </>
            ) : null}
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
