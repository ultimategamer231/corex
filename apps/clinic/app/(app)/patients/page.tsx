import { Badge } from "@corex/ui/components/badge";
import { Button, buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { PAGE_SIZE, Pagination, pageFrom } from "@corex/ui/components/pagination";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ageText, SEX } from "@/lib/clinic";
import { personName, todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { searchPatients } from "@/lib/patients";
import { PendingRecords } from "@/components/pending";
import { rows } from "@/lib/queries";
import { FRONT_DESK } from "@/lib/roles";
import { getSession, memberHas } from "@/lib/session";

export const metadata: Metadata = { title: "Patients" };

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function PatientsPage({ searchParams }: Props) {
  const { supabase, member } = await getSession();
  const frontDesk = memberHas(member, FRONT_DESK);
  const settings = await getSettings();
  const today = todayIso(settings.timezone);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = pageFrom(params.page);
  const result = await searchPatients(supabase, q, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const patients = rows(result);

  return (
    <>
      <PageHeader
        title="Patients"
        description="Search by name, patient number or phone."
        actions={
          frontDesk ? (
            <Link className={buttonVariants({ variant: "accent" })} href="/patients/new">
              Register patient
            </Link>
          ) : null
        }
      />
      <div className="mb-5">
        <PendingRecords table="patients" label="Registered on this device, waiting to sync" />
      </div>
      <form className="mb-5 flex flex-wrap items-end gap-3" aria-label="Search patients">
        <div className="flex w-80 max-w-full flex-col gap-1.5">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, number or phone"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {patients.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={q ? "No matching patients" : "No patients yet"}
          description={
            q
              ? "Check the spelling, or search by phone or patient number."
              : "Register the first patient to start."
          }
        />
      ) : (
        <>
          <TableScroll label="Patients">
            <Table>
              <thead>
                <tr>
                  <Th>Patient</Th>
                  <Th>Number</Th>
                  <Th>Sex and age</Th>
                  <Th>Phone</Th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <Link
                        className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
                        href={`/patients/${p.id}`}
                      >
                        {personName(p)}
                      </Link>
                      {p.has_allergies ? (
                        <Badge variant="danger" className="ml-2">
                          Allergies
                        </Badge>
                      ) : null}
                      {p.possible_duplicate_of ? (
                        <Badge variant="warning" className="ml-2">
                          Possible duplicate
                        </Badge>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap">{p.patient_number}</Td>
                    <Td className="whitespace-nowrap">
                      {[
                        p.sex ? SEX[p.sex as keyof typeof SEX] : null,
                        ageText(p.date_of_birth, today),
                      ]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </Td>
                    <Td className="whitespace-nowrap">{p.phone ?? "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
          <Pagination
            className="mt-4"
            page={page}
            total={result.count ?? 0}
            hrefFor={(n) =>
              `/patients?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`
            }
          />
        </>
      )}
    </>
  );
}
