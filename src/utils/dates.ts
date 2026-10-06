const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "2024-06" → "Jun 2024"; "2024" → "2024"; anything else passes through. */
export function formatMonth(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = MONTHS[Number(match[2]) - 1] ?? match[2];
  return `${month} ${match[1]}`;
}

/** "Jun 2024" – "Present" when end is null/undefined. */
export function dateRange(
  start: string,
  end: string | null | undefined,
): string {
  const from = formatMonth(start);
  const to = end ? formatMonth(end) : 'Present';
  return `${from} – ${to}`;
}
