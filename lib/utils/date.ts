/**
 * Date utilities for commission calculator
 */

export function getQuarterDates(quarterCode: string): { start: Date; end: Date } | null {
  const match = quarterCode.match(/Q(\d)-(\d{4})/);
  if (!match) return null;

  const quarter = parseInt(match[1]);
  const year = parseInt(match[2]);

  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 3;

  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth, 0, 23, 59, 59, 999);

  return { start, end };
}

export function getCurrentQuarter(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  return `Q${quarter}-${year}`;
}

export function getQuarterOptions(yearsBack: number = 1, yearsForward: number = 1): string[] {
  const currentYear = new Date().getFullYear();
  const options: string[] = [];

  for (let year = currentYear - yearsBack; year <= currentYear + yearsForward; year++) {
    for (let q = 1; q <= 4; q++) {
      options.push(`Q${q}-${year}`);
    }
  }

  return options;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isDateInQuarter(date: Date, quarterCode: string): boolean {
  const dates = getQuarterDates(quarterCode);
  if (!dates) return false;
  return date >= dates.start && date <= dates.end;
}
