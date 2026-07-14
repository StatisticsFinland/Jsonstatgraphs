import { checkTimeIrregularity, getTimePeriodInfo } from '../../src/data/time-regularity';

describe('checkTimeIrregularity', () => {
  // Edge cases
  it('returns false for empty array', () => {
    expect(checkTimeIrregularity([])).toBe(false);
  });

  it('returns false for single element', () => {
    expect(checkTimeIrregularity(['2022'])).toBe(false);
  });

  it('returns false for unrecognized format', () => {
    expect(checkTimeIrregularity(['foo', 'bar'])).toBe(false);
  });

  // Years (bare)
  it('returns false for regular consecutive years', () => {
    expect(checkTimeIrregularity(['2020', '2021', '2022'])).toBe(false);
  });

  it('returns true for years with a gap', () => {
    expect(checkTimeIrregularity(['2020', '2022', '2023'])).toBe(true);
  });

  // Years with Y suffix
  it('returns false for regular years with Y suffix', () => {
    expect(checkTimeIrregularity(['2020Y', '2021Y', '2022Y'])).toBe(false);
  });

  // Half-years
  it('returns false for regular half-years with rollover', () => {
    expect(checkTimeIrregularity(['2022H1', '2022H2', '2023H1'])).toBe(false);
  });

  // Quarters
  it('returns false for regular consecutive quarters with rollover', () => {
    expect(checkTimeIrregularity(['2022Q1', '2022Q2', '2022Q3', '2022Q4', '2023Q1'])).toBe(false);
  });

  it('returns true for quarters with a gap', () => {
    expect(checkTimeIrregularity(['2022Q1', '2022Q3'])).toBe(true);
  });

  // Months
  it('returns false for regular months with rollover', () => {
    expect(checkTimeIrregularity(['2022M11', '2022M12', '2023M01'])).toBe(false);
  });

  it('returns true for irregular months', () => {
    expect(checkTimeIrregularity(['2022M01', '2022M03'])).toBe(true);
  });

  // Weeks
  it('returns false for regular weeks with W52 rollover', () => {
    expect(checkTimeIrregularity(['2022W52', '2023W01'])).toBe(false);
  });

  it('returns false for regular weeks with W53 rollover', () => {
    expect(checkTimeIrregularity(['2022W52', '2022W53', '2023W01'])).toBe(false);
  });

  // Days
  it('returns false for regular days with D365 rollover', () => {
    expect(checkTimeIrregularity(['2022D365', '2023D001'])).toBe(false);
  });

  it('returns false for regular days with D366 (leap year) rollover', () => {
    expect(checkTimeIrregularity(['2024D365', '2024D366', '2025D001'])).toBe(false);
  });

  // Mixed formats
  it('returns true for mixed period types', () => {
    expect(checkTimeIrregularity(['2022M01', '2022Q1'])).toBe(true);
  });

  // Out-of-range period numbers — treated as unrecognized (returns false)
  it('returns false for Q0 (out of range quarter)', () => {
    expect(checkTimeIrregularity(['2022Q0', '2022Q1'])).toBe(false);
  });

  it('returns false for M13 (out of range month)', () => {
    expect(checkTimeIrregularity(['2022M13', '2022M14'])).toBe(false);
  });

  it('returns false for Y with period number (unrecognized)', () => {
    expect(checkTimeIrregularity(['2022Y1', '2022Y2'])).toBe(false);
  });

  it('returns false for H0 (out of range half-year)', () => {
    expect(checkTimeIrregularity(['2022H0', '2022H1'])).toBe(false);
  });
});

describe('getTimePeriodInfo', () => {
  it('returns period type and absolute index for yearly codes', () => {
    const result = getTimePeriodInfo(['1990', '1991', '1992']);
    expect(result).toEqual({ periodType: 'Y', firstAbsoluteIndex: 1990 });
  });

  it('returns period type and absolute index for monthly codes', () => {
    const result = getTimePeriodInfo(['2020M03', '2020M04', '2020M05']);
    expect(result).toEqual({ periodType: 'M', firstAbsoluteIndex: 2020 * 12 + 2 });
  });

  it('returns period type and absolute index for quarterly codes', () => {
    const result = getTimePeriodInfo(['2020Q2', '2020Q3', '2020Q4']);
    expect(result).toEqual({ periodType: 'Q', firstAbsoluteIndex: 2020 * 4 + 1 });
  });

  it('returns period type and absolute index for half-yearly codes', () => {
    const result = getTimePeriodInfo(['2020H1', '2020H2']);
    expect(result).toEqual({ periodType: 'H', firstAbsoluteIndex: 2020 * 2 });
  });

  it('returns null for empty codes', () => {
    expect(getTimePeriodInfo([])).toBeNull();
  });

  it('returns null for unparseable codes', () => {
    expect(getTimePeriodInfo(['abc', 'def'])).toBeNull();
  });

  it('returns null for mixed period types', () => {
    expect(getTimePeriodInfo(['2020M01', '2020Q1'])).toBeNull();
  });

  it('returns null when a code in the middle is invalid', () => {
    expect(getTimePeriodInfo(['2020', 'foo', '2022'])).toBeNull();
  });
});
