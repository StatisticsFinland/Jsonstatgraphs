import { buildHeader } from '../../src/data/header-builder';
import { DimensionMeta } from '../../src/types';

describe('buildHeader', () => {
  test('1. Single content value, no other dims', () => {
    const dims: DimensionMeta[] = [
      {
        code: 'pop',
        type: 'Content',
        size: 1,
        values: [{ code: 'total', name: 'Total population' }],
      },
    ];
    const result = buildHeader(dims, { locale: 'en' });
    expect(result.header).toBe('Total population');
  });

  test('2. Single content value + single non-elimination dim', () => {
    const dims: DimensionMeta[] = [
      {
        code: 'pop',
        type: 'Content',
        size: 1,
        values: [{ code: 'total', name: 'Total population' }],
      },
      {
        code: 'gender',
        type: 'Nominal',
        size: 1,
        values: [{ code: 'males', name: 'Males' }],
      },
    ];
    const result = buildHeader(dims, { locale: 'en' });
    expect(result.header).toBe('Total population, Males');
  });

  test('3. Single-value dimension skipped when value code is SSS', () => {
    const dims: DimensionMeta[] = [
      {
        code: 'pop',
        type: 'Content',
        size: 1,
        values: [{ code: 'total', name: 'Total population' }],
      },
      {
        code: 'region',
        type: 'Nominal',
        size: 1,
        values: [{ code: 'SSS', name: 'Whole country' }],
      },
    ];
    const result = buildHeader(dims, { locale: 'en' });
    expect(result.header).toBe('Total population');
  });

  test('4. Time range with multiple values', () => {
    const dims: DimensionMeta[] = [
      {
        code: 'pop',
        type: 'Content',
        size: 1,
        values: [{ code: 'total', name: 'Total population' }],
      },
      {
        code: 'time',
        type: 'Time',
        size: 3,
        values: [
          { code: '2020', name: '2020' },
          { code: '2021', name: '2021' },
          { code: '2022', name: '2022' },
        ],
      },
    ];
    const result = buildHeader(dims, { locale: 'en' });
    expect(result.header).toBe('Total population 2020–2022');
  });

  test('5. Single time value', () => {
    const dims: DimensionMeta[] = [
      {
        code: 'pop',
        type: 'Content',
        size: 1,
        values: [{ code: 'total', name: 'Total population' }],
      },
      {
        code: 'time',
        type: 'Time',
        size: 1,
        values: [{ code: '2020', name: '2020' }],
      },
    ];
    const result = buildHeader(dims, { locale: 'en' });
    expect(result.header).toBe('Total population 2020');
  });

  test('6. Multi-value content dimension uses dimension name with "by"', () => {
    const dims: DimensionMeta[] = [
      {
        code: 'pop',
        type: 'Content',
        size: 2,
        name: 'Population',
        values: [
          { code: 'total', name: 'Total population' },
          { code: 'change', name: 'Population change' },
        ],
      },
    ];
    const result = buildHeader(dims, { locale: 'en' });
    expect(result.header).toBe('Population by Population');
  });

  test('7. Multiple multi-value dimensions uses "by variables"', () => {
    const dims: DimensionMeta[] = [
      {
        code: 'pop',
        type: 'Content',
        size: 2,
        name: 'Population',
        values: [
          { code: 'total', name: 'Total population' },
          { code: 'change', name: 'Population change' },
        ],
      },
      {
        code: 'gender',
        type: 'Nominal',
        size: 3,
        name: 'Gender',
        values: [
          { code: 'males', name: 'Males' },
          { code: 'females', name: 'Females' },
          { code: 'total', name: 'Total' },
        ],
      },
    ];
    const result = buildHeader(dims, { locale: 'en' });
    expect(result.header).toBe('Population by variables Population, Gender');
  });

  test('8. Header edit override replaces generated header', () => {
    const dims: DimensionMeta[] = [
      {
        code: 'pop',
        type: 'Content',
        size: 1,
        values: [{ code: 'total', name: 'Total population' }],
      },
    ];
    const result = buildHeader(dims, {
      locale: 'en',
      headerEditOverride: 'My custom header',
    });
    expect(result.header).toBe('My custom header');
  });

  test('9. Finnish locale strings use muuttujana / muuttujina', () => {
    const singleDims: DimensionMeta[] = [
      {
        code: 'pop',
        type: 'Content',
        size: 2,
        name: 'Väestö',
        values: [
          { code: 'total', name: 'Kokonaisväestö' },
          { code: 'change', name: 'Väestönmuutos' },
        ],
      },
    ];
    const single = buildHeader(singleDims, { locale: 'fi' });
    expect(single.header).toBe('Väestö muuttujana Väestö');

    const multiDims: DimensionMeta[] = [
      ...singleDims,
      {
        code: 'gender',
        type: 'Nominal',
        size: 2,
        name: 'Sukupuoli',
        values: [
          { code: 'males', name: 'Miehet' },
          { code: 'females', name: 'Naiset' },
        ],
      },
    ];
    const multi = buildHeader(multiDims, { locale: 'fi' });
    expect(multi.header).toBe('Väestö muuttujina Väestö, Sukupuoli');
  });

  test('10. Selectable time dimension excluded from header', () => {
    const dims: DimensionMeta[] = [
      {
        code: 'pop',
        type: 'Content',
        size: 1,
        values: [{ code: 'total', name: 'Total population' }],
      },
      {
        code: 'time',
        type: 'Time',
        size: 3,
        values: [
          { code: '2020', name: '2020' },
          { code: '2021', name: '2021' },
          { code: '2022', name: '2022' },
        ],
      },
    ];
    const result = buildHeader(dims, { locale: 'en', selectableTimeDimension: true });
    expect(result.header).toBe('Total population');
  });

});

