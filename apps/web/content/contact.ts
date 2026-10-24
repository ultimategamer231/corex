// Quote form options (SPEC.md 6.6). Values are stored; labels are shown.
export const productOptions = [
  { value: "school-college", label: "School Management: College / University" },
  { value: "school-highschool", label: "School Management: High School" },
  { value: "clinic", label: "Clinic Management" },
  { value: "finance", label: "Financial Management" },
  { value: "on-request", label: "A system built on request" },
  { value: "website", label: "Website" },
  { value: "ai-automation", label: "AI Automation" },
  { value: "it-consultancy", label: "IT Consultancy" },
  { value: "training", label: "Training" },
] as const;

export type ProductOption = (typeof productOptions)[number]["value"];

export const planOptions = [
  { value: "managed", label: "Managed (we host it)" },
  { value: "handover", label: "Handover (you host it)" },
  { value: "unsure", label: "Not sure yet" },
] as const;

export const contactCopy = {
  title: "Request a quote",
  lead: "Tell us about your organization and what you need. We reply with questions or a quote.",
  messageHint: "For example: number of students, staff or branches, and what you use today.",
  consent: "Corex may contact me about this request.",
  success: {
    title: "Thank you. We received your request.",
    text: "We will contact you on WhatsApp or by email. If it is urgent, message us directly on WhatsApp.",
  },
  nextSteps: [
    "We read your request and may ask a few questions.",
    "We send a written scope, price and timeline.",
    "Once you agree, we set up a test version for you.",
  ],
};
