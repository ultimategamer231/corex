import { Input } from "@corex/ui/components/input";
import { Select } from "@corex/ui/components/select";
import { FormField } from "@/components/action-form";

export type EmployeeValues = {
  first_name: string;
  last_name: string;
  employee_number: string;
  position: string | null;
  department: string | null;
  start_date: string;
  currency: string;
  base_salary: string;
  payment_method: string;
  bank_or_wallet_ref: string | null;
};

const PAY_METHODS = { bank: "Bank", mobile_money: "Mobile money", cash: "Cash" } as const;

/** The employee form fields, shared by the add and edit forms. */
export function EmployeeFields({ e, currencies }: { e?: EmployeeValues; currencies: string[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField name="first_name" label="First name" required>
        <Input defaultValue={e?.first_name} />
      </FormField>
      <FormField name="last_name" label="Last name" required>
        <Input defaultValue={e?.last_name} />
      </FormField>
      <FormField name="employee_number" label="Employee number" required>
        <Input defaultValue={e?.employee_number} />
      </FormField>
      <FormField name="start_date" label="Start date" required>
        <Input type="date" defaultValue={e?.start_date} />
      </FormField>
      <FormField name="position" label="Position">
        <Input defaultValue={e?.position ?? ""} />
      </FormField>
      <FormField name="department" label="Department">
        <Input defaultValue={e?.department ?? ""} />
      </FormField>
      <FormField name="currency" label="Salary currency" required>
        <Select defaultValue={e?.currency ?? currencies[0]}>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField name="base_salary" label="Monthly base salary" required>
        <Input inputMode="decimal" defaultValue={e?.base_salary} />
      </FormField>
      <FormField name="payment_method" label="Paid by" required>
        <Select defaultValue={e?.payment_method ?? "bank"}>
          {Object.entries(PAY_METHODS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField name="bank_or_wallet_ref" label="Bank account or wallet number">
        <Input defaultValue={e?.bank_or_wallet_ref ?? ""} />
      </FormField>
    </div>
  );
}
