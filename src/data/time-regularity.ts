const TIME_CODE_RE = /^(\d{4})([YHQMWD]?)(\d*)$/;

interface ParsedTimeCode {
  year: number;
  periodType: string; // 'Y' | 'H' | 'Q' | 'M' | 'W' | 'D'
  periodNumber: number;
}

function parseTimeCode(code: string): ParsedTimeCode | null {
  const m = TIME_CODE_RE.exec(code);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const periodType = m[2] === '' ? 'Y' : m[2];
  const periodNumber = m[3] !== '' ? parseInt(m[3], 10) : 0;

  // Validate period number ranges
  if (periodType === 'Y' && periodNumber !== 0) return null;
  if (periodType === 'H' && (periodNumber < 1 || periodNumber > 2)) return null;
  if (periodType === 'Q' && (periodNumber < 1 || periodNumber > 4)) return null;
  if (periodType === 'M' && (periodNumber < 1 || periodNumber > 12)) return null;
  if (periodType === 'W' && (periodNumber < 1 || periodNumber > 53)) return null;
  if (periodType === 'D' && (periodNumber < 1 || periodNumber > 366)) return null;

  return { year, periodType, periodNumber };
}

export function checkTimeIrregularity(codes: string[]): boolean {
  if (codes.length <= 1) return false;

  const parsed = codes.map(parseTimeCode);
  if (parsed.some(p => p === null)) return false;

  const firstType = (parsed[0] as ParsedTimeCode).periodType;
  if (parsed.some(p => (p as ParsedTimeCode).periodType !== firstType)) return true;

  if (firstType === 'Y') {
    for (let i = 1; i < parsed.length; i++) {
      if ((parsed[i] as ParsedTimeCode).year !== (parsed[i - 1] as ParsedTimeCode).year + 1) return true;
    }
    return false;
  }

  const FIXED_MAX: Partial<Record<string, number>> = { H: 2, Q: 4, M: 12 };

  for (let i = 1; i < parsed.length; i++) {
    const prev = parsed[i - 1] as ParsedTimeCode;
    const curr = parsed[i] as ParsedTimeCode;

    if (curr.year === prev.year) {
      if (curr.periodNumber !== prev.periodNumber + 1) return true;
    } else if (curr.year === prev.year + 1) {
      if (curr.periodNumber !== 1) return true;
      const maxPeriod = FIXED_MAX[firstType];
      if (maxPeriod !== undefined) {
        if (prev.periodNumber !== maxPeriod) return true;
      } else if (firstType === 'W') {
        if (prev.periodNumber !== 52 && prev.periodNumber !== 53) return true;
      } else if (firstType === 'D') {
        if (prev.periodNumber !== 365 && prev.periodNumber !== 366) return true;
      }
    } else {
      return true;
    }
  }

  return false;
}

export interface TimePeriodInfo {
  periodType: string; // 'Y' | 'H' | 'Q' | 'M' | 'W' | 'D'
  firstAbsoluteIndex: number;
}

/**
 * Compute period info for a regular time series.
 * Returns null if codes cannot be parsed or are not all the same period type.
 * The firstAbsoluteIndex is the sequential position of the first code,
 * used for aligning label culling to round boundaries.
 */
export function getTimePeriodInfo(codes: string[]): TimePeriodInfo | null {
  if (codes.length === 0) return null;

  const first = parseTimeCode(codes[0]);
  if (first === null) return null;

  const periodType = first.periodType;

  // Validate all codes parse and share the same period type
  for (let i = 1; i < codes.length; i++) {
    const parsed = parseTimeCode(codes[i]);
    if (parsed === null || parsed.periodType !== periodType) return null;
  }

  let firstAbsoluteIndex: number;
  switch (periodType) {
    case 'Y':
      firstAbsoluteIndex = first.year;
      break;
    case 'H':
      firstAbsoluteIndex = first.year * 2 + (first.periodNumber - 1);
      break;
    case 'Q':
      firstAbsoluteIndex = first.year * 4 + (first.periodNumber - 1);
      break;
    case 'M':
      firstAbsoluteIndex = first.year * 12 + (first.periodNumber - 1);
      break;
    case 'W':
      firstAbsoluteIndex = first.year * 53 + (first.periodNumber - 1);
      break;
    case 'D':
      firstAbsoluteIndex = first.year * 366 + (first.periodNumber - 1);
      break;
    default:
      return null;
  }

  return { periodType, firstAbsoluteIndex };
}
