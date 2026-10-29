export function inboxDateParts(value: Date): { date: string; time: string } {
  const date = Number.isNaN(value.getTime()) ? new Date() : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
}
