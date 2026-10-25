// Demo data for the Clinic demo (SPEC.md 11.4): 400 fictional patients, eighteen months
// of visits with vitals and signed notes, appointments for the coming two weeks,
// today's queue, a service price list and bills in every payment state. Fully
// fictional, from a fixed random seed, dated relative to today.
import { randomUUID } from "node:crypto";
import { address, firstName, person, phone, type Sex } from "./people.ts";
import type { Random } from "./random.ts";
import { addDays, day, insert, type Row, type SeedContext, userId } from "./seed.ts";

/** USD prices in cents, LRD prices in Liberian cents. */
const SERVICES = [
  ["CONS", "Consultation", 1_500, "USD"],
  ["FUCO", "Follow-up consultation", 800, "USD"],
  ["MRDT", "Malaria rapid test", 500, "USD"],
  ["FBC", "Full blood count", 800, "USD"],
  ["WIDAL", "Typhoid test", 600, "USD"],
  ["URIN", "Urinalysis", 400, "USD"],
  ["GLUC", "Blood glucose", 300, "USD"],
  ["ANC", "Antenatal visit", 1_000, "USD"],
  ["CONS-L", "Consultation (LRD)", 250_000, "LRD"],
  ["DRESS", "Wound dressing", 150_000, "LRD"],
  ["INJ", "Injection", 50_000, "LRD"],
  ["DISP", "Dispensing fee", 25_000, "LRD"],
] as const;
type Code = (typeof SERVICES)[number][0];

type Diagnosis = {
  assessment: string;
  complaints: (r: Random) => string;
  plan: string;
  prescriptions: string;
  tests: Code[];
  fever?: boolean;
  /** Billed in LRD with LRD services. */
  lrd?: Code[];
};

const ACUTE: [Diagnosis, number][] = [
  [
    {
      assessment: "Uncomplicated malaria, RDT positive",
      complaints: (r) => `Fever, headache and body pains for ${r.int(2, 5)} days`,
      plan: "Treat with ACT. Fluids and rest. Return if vomiting, confused or no better in 3 days.",
      prescriptions:
        "Artemether-lumefantrine 80/480 mg, 1 tablet twice daily for 3 days\nParacetamol 1 g three times daily for 3 days",
      tests: ["MRDT"],
      fever: true,
    },
    30,
  ],
  [
    {
      assessment: "Upper respiratory tract infection",
      complaints: (r) => `Cough, runny nose and sore throat for ${r.int(3, 7)} days`,
      plan: "Supportive care. Steam inhalation. Review if breathing becomes difficult.",
      prescriptions: "Paracetamol 500 mg three times daily for 3 days\nVitamin C 500 mg daily",
      tests: [],
    },
    18,
  ],
  [
    {
      assessment: "Typhoid fever, suspected",
      complaints: (r) => `Fever and abdominal pain for ${r.int(5, 10)} days, poor appetite`,
      plan: "Start antibiotics. Safe water advice. Review in 5 days.",
      prescriptions: "Ciprofloxacin 500 mg twice daily for 7 days\nParacetamol 1 g as needed",
      tests: ["WIDAL", "FBC"],
      fever: true,
    },
    8,
  ],
  [
    {
      assessment: "Acute gastroenteritis",
      complaints: (r) => `Watery stool ${r.int(4, 8)} times a day since yesterday, mild cramps`,
      plan: "Oral rehydration. Zinc for children. Return if blood in stool or unable to drink.",
      prescriptions: "ORS sachets, 1 after each loose stool\nZinc 20 mg daily for 10 days",
      tests: [],
    },
    10,
  ],
  [
    {
      assessment: "Urinary tract infection",
      complaints: () => "Burning on passing urine and lower abdominal pain",
      plan: "Antibiotics. Drink plenty of water. Review if fever develops.",
      prescriptions: "Nitrofurantoin 100 mg twice daily for 5 days",
      tests: ["URIN"],
    },
    8,
  ],
  [
    {
      assessment: "Infected wound, lower leg",
      complaints: (r) => `Painful swollen cut on the leg for ${r.int(3, 6)} days`,
      plan: "Wound cleaned and dressed. Antibiotics. Dressing change every 2 days.",
      prescriptions: "Amoxicillin-clavulanate 625 mg twice daily for 5 days",
      tests: [],
      lrd: ["CONS-L", "DRESS", "DISP"],
    },
    6,
  ],
  [
    {
      assessment: "Iron deficiency anaemia",
      complaints: () => "Tiredness and dizziness for two weeks",
      plan: "Iron and folic acid. Diet advice. Repeat blood count in one month.",
      prescriptions: "Ferrous sulphate 200 mg daily\nFolic acid 5 mg daily",
      tests: ["FBC"],
    },
    5,
  ],
  [
    {
      assessment: "Intestinal worms",
      complaints: () => "Abdominal discomfort and poor weight gain",
      plan: "Deworm. Hand washing and sanitation advice.",
      prescriptions: "Albendazole 400 mg single dose",
      tests: [],
      lrd: ["CONS-L", "DISP"],
    },
    5,
  ],
  [
    {
      assessment: "Community-acquired pneumonia",
      complaints: (r) => `Cough with fever and chest pain for ${r.int(3, 6)} days`,
      plan: "Oral antibiotics. Review in 48 hours; refer if oxygen saturation falls.",
      prescriptions: "Amoxicillin 1 g three times daily for 5 days\nParacetamol 1 g as needed",
      tests: ["FBC"],
      fever: true,
    },
    5,
  ],
  [
    {
      assessment: "Low back pain, mechanical",
      complaints: () => "Back pain after lifting at work",
      plan: "Pain relief and gentle exercise. Injection given for pain.",
      prescriptions: "Ibuprofen 400 mg three times daily with food for 5 days",
      tests: [],
      lrd: ["CONS-L", "INJ", "DISP"],
    },
    5,
  ],
];

const HYPERTENSION: Diagnosis = {
  assessment: "Essential hypertension, follow-up",
  complaints: () => "Routine blood pressure review. No headache or chest pain",
  plan: "Continue treatment. Reduce salt. Review in one month.",
  prescriptions: "Amlodipine 10 mg daily\nHydrochlorothiazide 25 mg daily",
  tests: [],
};

const DIABETES: Diagnosis = {
  assessment: "Type 2 diabetes, follow-up",
  complaints: () => "Routine diabetes review. Taking medication daily",
  plan: "Continue metformin. Diet and foot care advice. Review in one month.",
  prescriptions: "Metformin 500 mg twice daily",
  tests: ["GLUC"],
};

const ANTENATAL: Diagnosis = {
  assessment: "Normal pregnancy, antenatal visit",
  complaints: (r) => `Routine antenatal visit at ${r.int(14, 36)} weeks. No bleeding`,
  plan: "Iron and folic acid. Bed net use. Next visit in four weeks.",
  prescriptions: "Ferrous sulphate with folic acid daily\nSulfadoxine-pyrimethamine (IPTp) given",
  tests: ["MRDT"],
};

const ALLERGIES = ["Penicillin", "Sulfa drugs", "Aspirin", "Chloroquine", "Peanuts"] as const;
const INSURERS = ["Liberty Health Cover", "Mesurado Mutual Insurance"] as const;
const EMPLOYERS = ["Atlantic Shipping Lines", "Bong Hills Mining Company"] as const;
const REASONS = [
  "Follow-up",
  "Blood pressure review",
  "Diabetes review",
  "Antenatal visit",
  "Lab results",
  "Fever",
  "Cough",
  "Wound check",
] as const;

type Patient = {
  id: string;
  sex: Sex;
  dob: string;
  registered: string;
  chronic: "hypertension" | "diabetes" | null;
};

type Visit = {
  id: string;
  patient: Patient;
  clinician: string;
  opened: Date;
  closed: Date | null;
  dx: Diagnosis | null;
};

const at = (date: string, minutes: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + minutes * 60_000);
const iso = (d: Date) => d.toISOString();
const ageOn = (dob: string, date: string) =>
  Math.floor((Date.parse(date) - Date.parse(dob)) / (365.25 * 86_400_000));

/** Malaria and respiratory illness rise in the rainy season (June to October). */
function rainy(date: string): boolean {
  const month = Number(date.slice(5, 7));
  return month >= 6 && month <= 10;
}

function diagnose(r: Random, p: Patient, date: string): Diagnosis {
  if (p.chronic === "hypertension" && r.chance(0.6)) return HYPERTENSION;
  if (p.chronic === "diabetes" && r.chance(0.6)) return DIABETES;
  const age = ageOn(p.dob, date);
  if (p.sex === "female" && age >= 18 && age <= 40 && r.chance(0.12)) return ANTENATAL;
  return r.weighted(ACUTE.map(([dx, w]) => [dx, dx.fever && rainy(date) ? w * 1.6 : w] as const));
}

function vitalsFor(r: Random, p: Patient, v: Visit, nurse: string, recorded: Date): Row {
  const age = ageOn(p.dob, iso(v.opened).slice(0, 10));
  const adult = age >= 15;
  const hypertensive = v.dx === HYPERTENSION;
  const weight =
    age < 1
      ? r.normal(7, 1.5, 3, 11, 0.1)
      : age < 15
        ? r.normal(8 + age * 2.6, 3, 9, 60, 0.1)
        : r.normal(p.sex === "female" ? 64 : 71, 11, 42, 120, 0.1);
  return {
    id: randomUUID(),
    encounter_id: v.id || null,
    patient_id: p.id,
    temperature_c: v.dx?.fever
      ? r.normal(38.6, 0.5, 37.6, 40.4, 0.1)
      : r.normal(36.8, 0.3, 36, 37.4, 0.1),
    pulse_bpm: v.dx?.fever ? r.int(92, 118) : adult ? r.int(64, 92) : r.int(84, 120),
    bp_systolic: adult ? (hypertensive ? r.int(138, 168) : r.int(108, 136)) : null,
    bp_diastolic: adult ? (hypertensive ? r.int(88, 102) : r.int(68, 86)) : null,
    resp_rate: adult ? r.int(14, 22) : r.int(20, 34),
    spo2: v.dx?.assessment.startsWith("Community") ? r.int(91, 95) : r.int(96, 99),
    weight_kg: weight,
    height_cm:
      adult && r.chance(0.4) ? r.normal(p.sex === "female" ? 160 : 170, 7, 140, 195, 0.5) : null,
    recorded_by: nurse,
    recorded_at: iso(recorded),
  };
}

function note(r: Random, v: Visit, dx: Diagnosis, signed: Date): Row {
  const temp = dx.fever ? "Febrile, " : "Afebrile, ";
  return {
    id: randomUUID(),
    encounter_id: v.id,
    complaints: dx.complaints(r),
    history: v.patient.chronic
      ? `Known ${v.patient.chronic === "hypertension" ? "hypertensive" : "diabetic"} on treatment.`
      : r.pick([
          "No known chronic illness.",
          "No previous admissions.",
          "Similar episode last year.",
        ]),
    examination: `${temp}${r.pick(["alert and well hydrated.", "mildly dehydrated.", "alert, not pale."])} Chest clear. Abdomen soft.`,
    assessment: dx.assessment,
    plan: dx.plan,
    prescriptions_text: dx.prescriptions,
    author_id: v.clinician,
    version: 1,
    supersedes_id: null,
    signed_at: iso(signed),
    created_at: iso(new Date(v.opened.getTime() + 5 * 60_000)),
    updated_at: iso(signed),
  };
}

export async function seedClinic(ctx: SeedContext): Promise<void> {
  const { random: r } = ctx;
  const today = day();
  const start = addDays(today, -548);
  const reception = userId(ctx, "reception");
  const nurse = userId(ctx, "nurse");
  const clinicians = ["doctor", "doctor2", "doctor3"].map((slug) => userId(ctx, slug));

  await insert(ctx, "settings", [
    {
      org_name: "Corex Demo Health Centre",
      address: "Tubman Boulevard, Sinkor, Monrovia",
      phone: "+231 770 000 200",
      email: "frontdesk@clinic.demo.corex.test",
      letterhead_text: "Outpatient care, laboratory and maternal health",
      base_currency: "USD",
    },
  ]);
  const services = new Map<Code, { name: string; price: number; currency: string }>(
    SERVICES.map(([code, name, price, currency]) => [code, { name, price, currency }]),
  );
  await insert(
    ctx,
    "services",
    SERVICES.map(([code, name, price, currency]) => ({ code, name, price_minor: price, currency })),
  );

  // Patients, registered on their first visit over the eighteen months.
  const patients: Patient[] = [];
  const patientRows: Row[] = [];
  for (let i = 0; i < 400; i++) {
    const who = person(r);
    const registered = i < 15 ? start : addDays(start, Math.floor(((i - 15) / 385) * 545));
    const age = r.weighted([
      [r.int(0, 5), 20],
      [r.int(6, 17), 15],
      [r.int(18, 40), 35],
      [r.int(41, 65), 22],
      [r.int(66, 85), 8],
    ] as const);
    const dob = addDays(registered, -(age * 365 + r.int(0, 364)));
    const chronic =
      age >= 35 && r.chance(0.18) ? "hypertension" : age >= 40 && r.chance(0.1) ? "diabetes" : null;
    const allergy = r.chance(0.08) ? r.pick(ALLERGIES) : null;
    const p: Patient = { id: randomUUID(), sex: who.sex, dob, registered, chronic };
    patients.push(p);
    patientRows.push({
      id: p.id,
      patient_number: "",
      first_name: who.firstName,
      middle_name: who.middleName,
      last_name: who.lastName,
      sex: who.sex,
      date_of_birth: dob,
      phone: age >= 16 || r.chance(0.5) ? phone(r) : null,
      address: address(r),
      next_of_kin_name: r.chance(0.7)
        ? `${firstName(r, r.chance(0.5) ? "female" : "male")} ${who.lastName}`
        : null,
      next_of_kin_phone: r.chance(0.6) ? phone(r) : null,
      has_allergies: allergy !== null,
      allergy_notes: allergy,
      created_by: reception,
      created_at: iso(at(registered, 7 * 60 + r.int(30, 120))),
    });
  }
  // One patient registered twice by mistake, flagged as a possible duplicate (CLN-08).
  const twin = patientRows[40];
  if (twin) {
    patientRows.push({
      ...twin,
      id: randomUUID(),
      phone: null,
      created_at: iso(at(addDays(today, -20), 9 * 60)),
    });
  }
  await insert(ctx, "patients", patientRows);

  // Past visits: Monday to Saturday, about nine a day, more in the rainy season.
  const visits: Visit[] = [];
  let next = 0;
  for (let d = start; d < today; d = addDays(d, 1)) {
    if (new Date(`${d}T00:00:00Z`).getUTCDay() === 0) continue;
    const pool: Patient[] = [];
    while (next < patients.length && (patients[next]?.registered ?? today) <= d) {
      const p = patients[next++];
      if (p) pool.push(p);
    }
    const known = patients.slice(0, next);
    const count = Math.max(pool.length, r.normal(rainy(d) ? 11 : 8, 2.5, 3, 16));
    const seen = new Set<string>();
    for (let i = 0; i < count; i++) {
      const p = pool[i] ?? r.weighted(known.map((k) => [k, k.chronic ? 4 : 1] as const));
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const opened = at(d, 8 * 60 + r.int(0, 8 * 60));
      visits.push({
        id: randomUUID(),
        patient: p,
        clinician: r.pick(clinicians),
        opened,
        closed: new Date(opened.getTime() + r.int(15, 40) * 60_000),
        dx: diagnose(r, p, d),
      });
    }
  }

  // Today: four visits closed this morning, one open, and the queue.
  const regular = patients.filter((p) => p.registered < today);
  const todays = r.shuffle(regular).slice(0, 14);
  const closedToday: Visit[] = todays.slice(0, 4).map((p, i) => {
    const opened = at(today, 7 * 60 + 30 + i * 25);
    return {
      id: randomUUID(),
      patient: p,
      clinician: clinicians[i % 3] ?? "",
      opened,
      closed: new Date(opened.getTime() + 20 * 60_000),
      dx: diagnose(r, p, today),
    };
  });
  const openToday: Visit = {
    id: randomUUID(),
    patient: todays[4] as Patient,
    clinician: clinicians[0] ?? "",
    opened: at(today, 9 * 60 + 40),
    closed: null,
    dx: null,
  };
  visits.push(...closedToday);

  const appointments: Row[] = [];
  const queue: Row[] = [];
  const vitals: Row[] = [];
  const notes: Row[] = [];
  const encounters: Row[] = [];
  for (const v of [...visits, openToday]) {
    const viaAppointment = r.chance(0.45);
    const appointmentId = viaAppointment ? randomUUID() : null;
    const arrived = new Date(v.opened.getTime() - r.int(10, 50) * 60_000);
    if (appointmentId) {
      appointments.push({
        id: appointmentId,
        patient_id: v.patient.id,
        clinician_id: v.clinician,
        starts_at: iso(new Date(arrived.getTime() + 10 * 60_000)),
        duration_minutes: 20,
        reason: r.pick(REASONS),
        status: v.closed ? "completed" : "checked_in",
        cancel_reason: null,
        created_by: reception,
        created_at: iso(addMinutes(arrived, -r.int(2, 20) * 24 * 60)),
      });
    }
    encounters.push({
      id: v.id,
      patient_id: v.patient.id,
      appointment_id: appointmentId,
      clinician_id: v.clinician,
      status: v.closed ? "closed" : "open",
      opened_at: iso(v.opened),
      closed_at: v.closed ? iso(v.closed) : null,
    });
    queue.push({
      id: randomUUID(),
      patient_id: v.patient.id,
      appointment_id: appointmentId,
      arrived_at: iso(arrived),
      status: v.closed ? "done" : "with_clinician",
      encounter_id: v.id,
      created_by: reception,
    });
    vitals.push(vitalsFor(r, v.patient, v, nurse, addMinutes(arrived, r.int(5, 9))));
    if (v.closed && v.dx) {
      const first = note(r, v, v.dx, addMinutes(v.closed, -2));
      notes.push(first);
      // A few notes were corrected after signing (CLN-03).
      if (r.chance(0.03)) {
        const signed = addMinutes(v.closed, r.int(30, 240));
        notes.push({
          ...note(r, v, v.dx, signed),
          complaints: first.complaints ?? null,
          plan: `${v.dx.plan} Corrected after the lab result: review in one week.`,
          version: 2,
          supersedes_id: first.id ?? null,
          created_at: iso(addMinutes(signed, -10)),
        });
      }
    }
  }

  // Missed and cancelled appointments stay in the history (CLN-05).
  for (let i = 0; i < 90; i++) {
    const d = addDays(today, -r.int(1, 540));
    const startsAt = at(d, 8 * 60 + r.int(0, 15) * 30);
    const cancelled = r.chance(0.5);
    appointments.push({
      id: randomUUID(),
      patient_id: r.pick(patients.filter((p) => p.registered <= d)).id,
      clinician_id: r.pick(clinicians),
      starts_at: iso(startsAt),
      duration_minutes: 20,
      reason: r.pick(REASONS),
      status: cancelled ? "cancelled" : "no_show",
      cancel_reason: cancelled
        ? r.pick(["Patient travelled", "Patient feeling better", "Clinician on leave"])
        : null,
      created_by: reception,
      created_at: iso(addMinutes(startsAt, -3 * 24 * 60)),
    });
  }

  await insert(ctx, "appointments", appointments);
  await insert(ctx, "encounters", encounters);
  await insert(ctx, "queue_entries", queue);
  await insert(ctx, "vitals", vitals);
  await insert(ctx, "clinical_notes", notes);

  // Today's queue: two checked in for appointments, one walk-in, two with the nurse.
  const waiting = todays.slice(5, 10);
  const todayQueue: Row[] = [];
  const todayAppointments: Row[] = [];
  const intake: Row[] = [];
  waiting.forEach((p, i) => {
    const arrived = at(today, 9 * 60 + i * 12);
    const appointmentId = i < 2 ? randomUUID() : null;
    if (appointmentId) {
      todayAppointments.push({
        id: appointmentId,
        patient_id: p.id,
        clinician_id: clinicians[i + 1] ?? "",
        starts_at: iso(at(today, 10 * 60 + i * 30)),
        duration_minutes: 20,
        reason: r.pick(REASONS),
        status: "checked_in",
        cancel_reason: null,
        created_by: reception,
        created_at: iso(addMinutes(arrived, -5 * 24 * 60)),
      });
    }
    const status = i >= 3 ? "with_nurse" : "waiting";
    todayQueue.push({
      id: randomUUID(),
      patient_id: p.id,
      appointment_id: appointmentId,
      arrived_at: iso(arrived),
      status,
      encounter_id: null,
      created_by: reception,
    });
    // The nurse has taken intake vitals for the first patient with her.
    if (i === 3) {
      const v: Visit = {
        id: "",
        patient: p,
        clinician: "",
        opened: arrived,
        closed: null,
        dx: null,
      };
      intake.push(vitalsFor(r, p, v, nurse, addMinutes(arrived, 6)));
    }
  });

  // Appointments booked for later today and the next two weeks, one patient at a time
  // per clinician (CLN-04).
  const booked = new Set<string>();
  for (let offset = 0; offset <= 14; offset++) {
    const d = addDays(today, offset);
    // The clinic is closed on Sundays, but today always has bookings so the demo looks alive.
    if (offset > 0 && new Date(`${d}T00:00:00Z`).getUTCDay() === 0) continue;
    const count = offset === 0 ? 6 : r.int(5, 10);
    for (let i = 0; i < count; i++) {
      const clinician = r.pick(clinicians);
      // Today, only the afternoon is still free.
      const slot = offset === 0 ? r.int(10, 15) : r.int(0, 15);
      const key = `${d}|${clinician}|${slot}`;
      if (booked.has(key)) continue;
      booked.add(key);
      todayAppointments.push({
        id: randomUUID(),
        patient_id: r.pick(regular).id,
        clinician_id: clinician,
        starts_at: iso(at(d, 8 * 60 + slot * 30)),
        duration_minutes: 20,
        reason: r.pick(REASONS),
        status: "booked",
        cancel_reason: null,
        created_by: reception,
        created_at: iso(at(addDays(today, -r.int(1, 10)), 10 * 60)),
      });
    }
  }
  await insert(ctx, "appointments", todayAppointments);
  await insert(ctx, "queue_entries", todayQueue);
  await insert(ctx, "vitals", intake);

  await seedBills(ctx, visits, services, today);
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

type Payment = { amount: number; method: string; reference: string | null; at: string };

/**
 * A bill for every closed visit except the last one today (left for the Cashier), in
 * every state: paid, part paid, unpaid (insurance claims and recent visits) and void.
 * The billing functions run in the database, in visit order, so bill and receipt
 * numbers follow the dates.
 */
async function seedBills(
  ctx: SeedContext,
  visits: Visit[],
  services: Map<Code, { name: string; price: number; currency: string }>,
  today: string,
): Promise<void> {
  const { random: r, tx, schema: s } = ctx;
  const bills: Row[] = [];
  const billable = visits.filter((v) => v.closed && v.dx).slice(0, -1);
  billable.forEach((v, ord) => {
    const dx = v.dx as Diagnosis;
    const closed = v.closed as Date;
    const codes: Code[] = dx.lrd ?? [
      dx === HYPERTENSION || dx === DIABETES ? "FUCO" : dx === ANTENATAL ? "ANC" : "CONS",
      ...dx.tests,
    ];
    const currency = services.get(codes[0] as Code)?.currency ?? "USD";
    const lines = codes.map((code) => {
      const svc = services.get(code);
      if (!svc) throw new Error(`Unknown service ${code}`);
      return { d: `${svc.name} (${code})`, q: 1, u: svc.price, a: svc.price };
    });
    const total = lines.reduce((t, l) => t + l.a, 0);
    const ageDays = (Date.parse(today) - closed.getTime()) / 86_400_000;
    const payer =
      currency === "USD"
        ? r.weighted([
            ["self", 82],
            ["insurance", 12],
            ["company", 6],
          ] as const)
        : "self";
    const payments: Payment[] = [];
    let isVoid = false;
    if (payer !== "self") {
      // Insurers and employers settle claims by bank transfer after about a month.
      if (ageDays > 35) {
        payments.push({
          amount: total,
          method: "bank",
          reference: `CLM-${r.int(10_000, 99_999)}`,
          at: iso(addMinutes(closed, r.int(14, 30) * 24 * 60)),
        });
      }
    } else {
      const state = r.weighted(
        ageDays > 45
          ? ([
              ["paid", 94],
              ["partial", 3],
              ["unpaid", 1],
              ["void", 2],
            ] as const)
          : ([
              ["paid", 72],
              ["partial", 13],
              ["unpaid", 12],
              ["void", 3],
            ] as const),
      );
      isVoid = state === "void";
      const method = r.weighted([
        ["cash", 65],
        ["mobile_money", 30],
        ["bank", 5],
      ] as const);
      const reference = method === "mobile_money" ? `MM${r.int(1_000_000, 9_999_999)}` : null;
      if (state === "paid")
        payments.push({
          amount: total,
          method,
          reference,
          at: iso(addMinutes(closed, r.int(2, 15))),
        });
      if (state === "partial") {
        const part = Math.round((total * r.int(30, 70)) / 100 / 100) * 100 || 100;
        payments.push({
          amount: Math.min(part, total - 1),
          method,
          reference,
          at: iso(addMinutes(closed, r.int(2, 15))),
        });
      }
    }
    bills.push({
      ord,
      encounter_id: v.id,
      patient_id: v.patient.id,
      currency,
      payer_type: payer,
      payer_name:
        payer === "insurance" ? r.pick(INSURERS) : payer === "company" ? r.pick(EMPLOYERS) : null,
      created_at: iso(addMinutes(closed, 1)),
      lines: JSON.stringify(lines),
      is_void: isVoid,
      payments: JSON.stringify(payments),
    });
  });

  await tx.unsafe(`create temp table demo_bills (
    ord integer, encounter_id uuid, patient_id uuid, currency text, payer_type text,
    payer_name text, created_at timestamptz, lines text, is_void boolean, payments text
  ) on commit drop`);
  for (let i = 0; i < bills.length; i += 1000) {
    await tx`insert into demo_bills ${tx(bills.slice(i, i + 1000))}`;
  }
  // The schema name is validated by the reset (assertSchemaName).
  await tx.unsafe(`
    do $$
    declare
      b record;
      p jsonb;
      v_id uuid;
    begin
      for b in select * from pg_temp.demo_bills order by ord loop
        insert into ${s}.invoices (party_type, party_id, currency, payer_type, payer_name, encounter_id, created_at)
        values ('patient', b.patient_id, b.currency, b.payer_type, b.payer_name, b.encounter_id, b.created_at)
        returning id into v_id;
        insert into ${s}.invoice_lines (invoice_id, description, quantity, unit_amount_minor, amount_minor, created_at)
        select v_id, x ->> 'd', (x ->> 'q')::numeric, (x ->> 'u')::bigint, (x ->> 'a')::bigint, b.created_at
        from jsonb_array_elements(b.lines::jsonb) x;
        perform ${s}.issue_invoice(v_id);
        update ${s}.invoices set issue_date = (b.created_at at time zone 'UTC')::date where id = v_id;
        if b.is_void then
          perform ${s}.void_invoice(v_id, 'Billed to the wrong patient');
          continue;
        end if;
        for p in select * from jsonb_array_elements(b.payments::jsonb) loop
          perform ${s}.record_payment(gen_random_uuid(), v_id, (p ->> 'amount')::bigint, b.currency,
            p ->> 'method', p ->> 'reference', (p ->> 'at')::timestamptz);
        end loop;
      end loop;
    end
    $$`);
  await tx.unsafe(
    `update ${s}.receipts r set issued_at = p.received_at from ${s}.payments p where p.id = r.payment_id`,
  );
}
