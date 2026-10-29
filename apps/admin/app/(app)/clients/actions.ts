"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ActionError, dbMessage, must, runAction } from "@/lib/action";
import {
  clientDetailsSchema,
  contactSchema,
  contractSchema,
  createClientPayload,
  deploymentSchema,
  DOCUMENT_TYPES,
  documentStartSchema,
  newClientSchema,
  subscriptionSchema,
} from "@/lib/clients";
import { adminEnv } from "@/lib/env";
import { uuid } from "@/lib/fields";
import type { FormState } from "@/lib/form-state";

const CLIENTS = ["/clients", "/leads"];

/** LEAD-06 and "Add client": one database transaction (create_client). */
export async function createClient(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: newClientSchema, revalidate: CLIENTS },
    async (data, session): Promise<FormState> => {
      const { data: clientId, error } = await session.supabase.rpc("create_client", {
        // null adds a client without a lead; the generated type does not show that.
        p_lead_id: data.leadId as string,
        p: createClientPayload(data) as never,
      });
      if (error) throw new ActionError(dbMessage(error));
      return {
        status: "success",
        message: data.leadId ? "The lead is now a client." : "Client added.",
        data: { clientId: String(clientId) },
      };
    },
  );
}

export async function saveClientDetails(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(
    formData,
    { schema: clientDetailsSchema, revalidate: CLIENTS },
    async (data, session) => {
      const updated = must(
        await session.supabase
          .from("clients")
          .update({
            name: data.name,
            country: data.country,
            city: data.city,
            address: data.address,
            notes: data.notes,
          })
          .eq("id", data.clientId)
          .select("id"),
      );
      if (updated.length === 0) throw new ActionError("This client was not found.");
      return "Client details saved.";
    },
  );
}

/** Adds or edits a contact. Making one primary or billing moves that role from the others. */
export async function saveContact(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: contactSchema, revalidate: CLIENTS },
    async (data, session) => {
      const db = session.supabase;
      if (data.contactId) {
        const current = must(
          await db
            .from("client_contacts")
            .select("is_primary")
            .eq("id", data.contactId)
            .eq("client_id", data.clientId)
            .maybeSingle(),
        );
        if (!current) throw new ActionError("This contact was not found.");
        if (current.is_primary && !data.isPrimary) {
          throw new ActionError("Make another contact primary first.");
        }
      }
      if (data.isPrimary) {
        must(
          await db
            .from("client_contacts")
            .update({ is_primary: false })
            .eq("client_id", data.clientId)
            .neq("id", data.contactId ?? randomUUID()),
        );
      }
      if (data.isBilling) {
        must(
          await db
            .from("client_contacts")
            .update({ is_billing: false })
            .eq("client_id", data.clientId)
            .neq("id", data.contactId ?? randomUUID()),
        );
      }
      const values = {
        name: data.name,
        title: data.title,
        phone: data.phone,
        email: data.email,
        is_primary: data.isPrimary,
        is_billing: data.isBilling,
      };
      if (data.contactId) {
        must(await db.from("client_contacts").update(values).eq("id", data.contactId));
        return "Contact saved.";
      }
      must(await db.from("client_contacts").insert({ ...values, client_id: data.clientId }));
      return "Contact added.";
    },
  );
}

const contactRef = z.object({ clientId: uuid("a client"), contactId: uuid("a contact") });

export async function removeContact(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, { schema: contactRef, revalidate: CLIENTS }, async (data, session) => {
    const removed = must(
      await session.supabase
        .from("client_contacts")
        .delete()
        .eq("id", data.contactId)
        .eq("client_id", data.clientId)
        .select("id"),
    );
    if (removed.length === 0) {
      throw new ActionError(
        "The primary contact cannot be removed. Make another one primary first.",
      );
    }
    return "Contact removed.";
  });
}

export async function saveContract(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: contractSchema, revalidate: CLIENTS },
    async (data, session) => {
      if (data.totalMinor === null) throw new ActionError("Enter the contract amount.");
      const updated = must(
        await session.supabase
          .from("contracts")
          .update({
            product: data.product,
            plan: data.plan,
            currency: data.currency,
            total_minor: Number(data.totalMinor),
            signed_on: data.signedOn,
            milestone_scheme: data.scheme,
            notes: data.notes,
          })
          .eq("id", data.contractId)
          .select("id"),
      );
      if (updated.length === 0) throw new ActionError("This contract was not found.");
      return "Contract saved.";
    },
  );
}

export async function saveDeployment(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: deploymentSchema, revalidate: CLIENTS },
    async (data, session) => {
      const updated = must(
        await session.supabase
          .from("deployments")
          .update({
            environment: data.environment,
            product_version: data.productVersion,
            app_url: data.appUrl,
            supabase_project_ref: data.supabaseProjectRef,
            schema_name: data.schemaName,
            hosting: data.hosting,
            target_go_live: data.targetGoLive,
            went_live_on: data.wentLiveOn,
            warranty_ends_on: data.warrantyEndsOn,
            hosting_cost_minor_per_month:
              data.hostingMinor === null ? null : Number(data.hostingMinor),
            hosting_cost_currency: data.hostingMinor === null ? null : data.hostingCurrency,
          })
          .eq("id", data.deploymentId)
          .select("id"),
      );
      if (updated.length === 0) throw new ActionError("This deployment was not found.");
      return "Deployment saved.";
    },
  );
}

export async function saveSubscription(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(
    formData,
    { schema: subscriptionSchema, revalidate: CLIENTS },
    async (data, session) => {
      if (data.renewalMinor === null) throw new ActionError("Enter the yearly renewal.");
      const values: { renewal_amount_minor: number; next_renewal_on?: string } = {
        renewal_amount_minor: Number(data.renewalMinor),
      };
      if (data.nextRenewalOn) values.next_renewal_on = data.nextRenewalOn;
      const updated = must(
        await session.supabase
          .from("subscriptions")
          .update(values)
          .eq("id", data.subscriptionId)
          .select("id"),
      );
      if (updated.length === 0) throw new ActionError("This subscription was not found.");
      return "Subscription saved.";
    },
  );
}

/**
 * Step 1 of an upload: records the document as the admin (row-level security) and
 * returns a one-time link that lets the browser put the file straight into the
 * private bucket. The bucket itself refuses other types and anything over 10 MB.
 */
export async function startDocumentUpload(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(
    formData,
    { schema: documentStartSchema },
    async (data, session): Promise<FormState> => {
      const id = randomUUID();
      const path = `clients/${data.clientId}/${id}.${DOCUMENT_TYPES[data.type]}`;
      must(
        await session.supabase.from("client_documents").insert({
          id,
          client_id: data.clientId,
          name: data.name,
          storage_path: path,
          size_bytes: data.size,
          mime_type: data.type,
        }),
      );
      const signed = await session
        .service()
        .storage.from(adminEnv().schema)
        .createSignedUploadUrl(path);
      if (signed.error) {
        await session.supabase.from("client_documents").delete().eq("id", id);
        throw new ActionError("The upload could not start. Try again.");
      }
      return {
        status: "success",
        data: { documentId: id, path, token: signed.data.token },
      };
    },
  );
}

const documentRef = z.object({ clientId: uuid("a client"), documentId: uuid("a document") });

/** Step 2: checks the stored file matches what was announced, then shows it. */
export async function finishDocumentUpload(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(
    formData,
    { schema: documentRef, revalidate: CLIENTS },
    async (data, session) => {
      const doc = must(
        await session.supabase
          .from("client_documents")
          .select("storage_path, size_bytes, mime_type")
          .eq("id", data.documentId)
          .eq("client_id", data.clientId)
          .maybeSingle(),
      );
      if (!doc) throw new ActionError("This document was not found.");
      const folder = doc.storage_path.slice(0, doc.storage_path.lastIndexOf("/"));
      const file = doc.storage_path.slice(doc.storage_path.lastIndexOf("/") + 1);
      const listed = await session
        .service()
        .storage.from(adminEnv().schema)
        .list(folder, { search: file });
      const stored = listed.data?.find((o) => o.name === file);
      const metadata = (stored?.metadata ?? {}) as { size?: number; mimetype?: string };
      if (!stored || metadata.size !== doc.size_bytes || metadata.mimetype !== doc.mime_type) {
        await session.service().storage.from(adminEnv().schema).remove([doc.storage_path]);
        await session.supabase.from("client_documents").delete().eq("id", data.documentId);
        throw new ActionError("The file did not arrive complete. Upload it again.");
      }
      must(
        await session.supabase
          .from("client_documents")
          .update({ uploaded_at: new Date().toISOString() })
          .eq("id", data.documentId),
      );
      return "Document uploaded.";
    },
  );
}

export async function removeDocument(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: documentRef, revalidate: CLIENTS },
    async (data, session) => {
      const removed = must(
        await session.supabase
          .from("client_documents")
          .delete()
          .eq("id", data.documentId)
          .eq("client_id", data.clientId)
          .select("storage_path"),
      );
      const doc = removed[0];
      if (!doc) throw new ActionError("This document was not found.");
      await session.service().storage.from(adminEnv().schema).remove([doc.storage_path]);
      return "Document removed.";
    },
  );
}
