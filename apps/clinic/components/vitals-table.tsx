import { formatDateTime } from "@corex/core/dates";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";

type Vitals = {
  id: string;
  recorded_at: string;
  temperature_c: number | null;
  pulse_bpm: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  resp_rate: number | null;
  spo2: number | null;
  weight_kg: number | null;
  height_cm?: number | null;
};

export function VitalsTable({ vitals, timezone }: { vitals: Vitals[]; timezone: string }) {
  if (vitals.length === 0) return <p className="text-muted">No vitals recorded yet.</p>;
  return (
    <TableScroll label="Vitals">
      <Table>
        <thead>
          <tr>
            <Th>Recorded</Th>
            <Th className="text-right">Temp °C</Th>
            <Th className="text-right">Pulse</Th>
            <Th className="text-right">BP</Th>
            <Th className="text-right">Resp.</Th>
            <Th className="text-right">SpO2 %</Th>
            <Th className="text-right">Weight kg</Th>
            <Th className="text-right">Height cm</Th>
          </tr>
        </thead>
        <tbody>
          {vitals.map((v) => (
            <tr key={v.id}>
              <Td className="whitespace-nowrap">{formatDateTime(v.recorded_at, timezone)}</Td>
              <Td className="text-right">{v.temperature_c ?? "-"}</Td>
              <Td className="text-right">{v.pulse_bpm ?? "-"}</Td>
              <Td className="text-right whitespace-nowrap">
                {v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "-"}
              </Td>
              <Td className="text-right">{v.resp_rate ?? "-"}</Td>
              <Td className="text-right">{v.spo2 ?? "-"}</Td>
              <Td className="text-right">{v.weight_kg ?? "-"}</Td>
              <Td className="text-right">{v.height_cm ?? "-"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableScroll>
  );
}
