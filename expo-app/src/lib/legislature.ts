const FIRST_LEGISLATURE = 57;
const FIRST_YEAR = 2023;

export function currentLegislature(date = new Date()): number {
  const year = date.getFullYear();
  const beforeStart = date.getMonth() === 0;
  return FIRST_LEGISLATURE + Math.max(0, Math.floor((year - FIRST_YEAR - (beforeStart ? 1 : 0)) / 4));
}

export function currentLegislatureLabel(date = new Date()): string {
  return `${currentLegislature(date)}ª Legislatura`;
}
