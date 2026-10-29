import type { Metadata } from "next";
import Link from "next/link";
import { findLink } from "@/lib/auth/links";
import { requestContext } from "@/lib/request-context";
import { getServiceSupabase } from "@/lib/supabase";
import { SetupFlow } from "./setup-flow";

export const metadata: Metadata = { title: "Set up your account" };

type Props = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const link = await findLink(getServiceSupabase(await requestContext()), token, [
    "invite",
    "authenticator_setup",
  ]);
  if (!link) {
    return (
      <>
        <h1 className="font-display text-[26px] font-bold">This link is no longer valid</h1>
        <p className="text-[15px] text-muted">
          Set-up links work once and expire after 72 hours. Ask an admin for a new one.
        </p>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center self-start text-[14px] font-semibold text-primary hover:underline"
        >
          Go to sign in
        </Link>
      </>
    );
  }
  return (
    <SetupFlow
      token={token}
      kind={link.kind === "invite" ? "invite" : "authenticator_setup"}
      name={link.admin.name}
      username={link.admin.username}
      email={link.admin.email}
    />
  );
}
