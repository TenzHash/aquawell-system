// src/utils/formatters.ts

export const money = (n: number | string) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

export const dateFmt = (v: string | number | Date | null | undefined) =>
  v
    ? new Date(v).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

export const roleName = (r: string) =>
  (
    ({
      admin: "Admin / Owner",
      staff: "Station Staff",
      delivery: "Delivery Rider",
      customer: "Customer",
    }) as Record<string, string>
  )[r] || r;

export function downloadCSV(rows: any[], name: string) {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const cell = (v: any) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  const csv = [
    keys.map(cell).join(","),
    ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
  ].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}