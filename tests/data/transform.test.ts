import { transformDataset, transformScatterData, transformPyramidData } from '../../src/data/transform';
import { JsonStatDataset } from '../../src/types';

// --- Fixture helpers ---

const singleDimDataset: JsonStatDataset = {
  id: ['Year'],
  size: [3],
  dimension: {
    Year: {
      category: {
        index: ['2020', '2021', '2022'],
        label: { '2020': '2020', '2021': '2021', '2022': '2022' },
      },
    },
  },
  value: [100, 200, 300],
};

const twoDimDataset: JsonStatDataset = {
  id: ['Region', 'Year'],
  size: [2, 3],
  dimension: {
    Region: {
      category: {
        index: ['R1', 'R2'],
        label: { R1: 'Helsinki', R2: 'Tampere' },
      },
    },
    Year: {
      category: {
        index: ['2020', '2021', '2022'],
        label: { '2020': '2020', '2021': '2021', '2022': '2022' },
      },
    },
  },
  value: [10, 20, 30, 40, 50, 60],
  role: { time: ['Year'] },
};

// --- Tests ---

describe('transformDataset', () => {
  // 1. Single dimension
  test('single dimension produces 1 series with correct values', () => {
    const result = transformDataset(singleDimDataset);

    expect(result.series).toHaveLength(1);
    expect(result.categories).toEqual(['2020', '2021', '2022']);
    expect(result.categoryLabels).toEqual(['2020', '2021', '2022']);

    const [series] = result.series;
    expect(series.points).toHaveLength(3);
    expect(series.points[0].value).toBe(100);
    expect(series.points[1].value).toBe(200);
    expect(series.points[2].value).toBe(300);
  });

  // 2. Two dimensions — auto-detect x via role.time, non-x becomes series
  test('two dimensions: Year as x-axis (via role.time), Region as series', () => {
    const result = transformDataset(twoDimDataset);

    expect(result.categories).toEqual(['2020', '2021', '2022']);
    expect(result.series).toHaveLength(2);

    const helsinki = result.series.find((s) => s.name === 'Helsinki');
    const tampere = result.series.find((s) => s.name === 'Tampere');

    expect(helsinki).toBeDefined();
    expect(tampere).toBeDefined();

    expect(helsinki!.points.map((p) => p.value)).toEqual([10, 20, 30]);
    expect(tampere!.points.map((p) => p.value)).toEqual([40, 50, 60]);
  });

  // 3. Null values preserved
  test('null values in dataset become null DataPoint.value', () => {
    const ds: JsonStatDataset = {
      ...singleDimDataset,
      value: [100, null, 300],
    };
    const result = transformDataset(ds);
    expect(result.series[0].points[1].value).toBeNull();
  });

  // 4. String missing values become null
  test('string missing values (e.g. "..") become null DataPoint.value', () => {
    const ds: JsonStatDataset = {
      ...singleDimDataset,
      value: [100, '..', 300],
    };
    const result = transformDataset(ds);
    expect(result.series[0].points[1].value).toBeNull();
  });

  // 5. Custom xDimension override
  test('xDimension option overrides auto-detection', () => {
    const result = transformDataset(twoDimDataset, { xDimension: 'Region' });

    expect(result.categories).toEqual(['R1', 'R2']);
    expect(result.categoryLabels).toEqual(['Helsinki', 'Tampere']);
    expect(result.series).toHaveLength(3); // Year becomes series

    const series2020 = result.series.find((s) => s.code === '2020');
    expect(series2020).toBeDefined();
    // Region R1 (index 0) with Year 2020 (index 0) → value[0*3+0] = 10
    // Region R2 (index 1) with Year 2020 (index 0) → value[1*3+0] = 40
    expect(series2020!.points.map((p) => p.value)).toEqual([10, 40]);
  });

  // 6. Category index as object form { code: position }
  test('category index as object (Record<string,number>) is handled correctly', () => {
    const ds: JsonStatDataset = {
      id: ['Region', 'Year'],
      size: [2, 3],
      dimension: {
        Region: {
          category: {
            index: { R1: 0, R2: 1 },
            label: { R1: 'Helsinki', R2: 'Tampere' },
          },
        },
        Year: {
          category: {
            index: { '2020': 0, '2021': 1, '2022': 2 },
            label: { '2020': '2020', '2021': '2021', '2022': '2022' },
          },
        },
      },
      value: [10, 20, 30, 40, 50, 60],
      role: { time: ['Year'] },
    };

    const result = transformDataset(ds);
    expect(result.categories).toEqual(['2020', '2021', '2022']);
    expect(result.series).toHaveLength(2);

    const helsinki = result.series.find((s) => s.name === 'Helsinki')!;
    expect(helsinki.points.map((p) => p.value)).toEqual([10, 20, 30]);
  });

  // 7. Missing labels — codes used as labels
  test('missing label property falls back to category code', () => {
    const ds: JsonStatDataset = {
      id: ['Year'],
      size: [3],
      dimension: {
        Year: {
          category: {
            index: ['2020', '2021', '2022'],
            // no label property
          },
        },
      },
      value: [1, 2, 3],
    };

    const result = transformDataset(ds);
    expect(result.categoryLabels).toEqual(['2020', '2021', '2022']);
    expect(result.series[0].points[0].label).toBe('2020');
  });

  // 8. Three dimensions, one obvious series candidate (Metric has size 1 and is role.metric)
  test('3 dims, one obvious series candidate: Sex(2) auto-detected as series', () => {
    const ds: JsonStatDataset = {
      id: ['Sex', 'Metric', 'Year'],
      size: [2, 1, 3],
      dimension: {
        Sex: {
          category: {
            index: ['M', 'F'],
            label: { M: 'Male', F: 'Female' },
          },
        },
        Metric: {
          category: {
            index: ['V'],
            label: { V: 'Value' },
          },
        },
        Year: {
          category: {
            index: ['2020', '2021', '2022'],
            label: { '2020': '2020', '2021': '2021', '2022': '2022' },
          },
        },
      },
      // Sex(2) × Metric(1) × Year(3) = 6 values
      // strides: Sex=3, Metric=3, Year=1
      // M,V,2020=0; M,V,2021=1; M,V,2022=2
      // F,V,2020=3; F,V,2021=4; F,V,2022=5
      value: [10, 20, 30, 40, 50, 60],
      role: { time: ['Year'], metric: ['Metric'] },
    };

    const result = transformDataset(ds);

    expect(result.series).toHaveLength(2);
    expect(result.categories).toEqual(['2020', '2021', '2022']);

    const male = result.series.find((s) => s.name === 'Male')!;
    const female = result.series.find((s) => s.name === 'Female')!;
    expect(male.points.map((p) => p.value)).toEqual([10, 20, 30]);
    expect(female.points.map((p) => p.value)).toEqual([40, 50, 60]);
  });

  // 8b. Three dimensions, multiple series candidates — smallest (Sex=2) wins over Region=3
  test('3 dims, multiple series candidates — smallest wins', () => {
    const ds: JsonStatDataset = {
      id: ['Sex', 'Region', 'Year'],
      size: [2, 3, 5],
      dimension: {
        Sex: {
          category: {
            index: ['M', 'F'],
            label: { M: 'Male', F: 'Female' },
          },
        },
        Region: {
          category: {
            index: ['R1', 'R2', 'R3'],
            label: { R1: 'Helsinki', R2: 'Tampere', R3: 'Oulu' },
          },
        },
        Year: {
          category: {
            index: ['2020', '2021', '2022', '2023', '2024'],
            label: { '2020': '2020', '2021': '2021', '2022': '2022', '2023': '2023', '2024': '2024' },
          },
        },
      },
      // Sex(2) × Region(3) × Year(5) = 30 values
      // strides: Sex=15, Region=5, Year=1
      // M, R1, Y0..4 → indices 0..4
      // M, R2, Y0..4 → indices 5..9
      // M, R3, Y0..4 → indices 10..14
      // F, R1, Y0..4 → indices 15..19
      // F, R2, Y0..4 → indices 20..24
      // F, R3, Y0..4 → indices 25..29
      value: Array.from({ length: 30 }, (_, i) => i),
      role: { time: ['Year'] },
    };

    const result = transformDataset(ds);

    // Sex (size 2) < Region (size 3), so Sex is series; Region fixed at index 0 (R1)
    expect(result.series).toHaveLength(2);
    expect(result.categories).toHaveLength(5);

    const male = result.series.find((s) => s.code === 'M')!;
    const female = result.series.find((s) => s.code === 'F')!;
    // Sex=M(0), Region=R1(0), Year 0..4 → indices 0,1,2,3,4
    expect(male.points.map((p) => p.value)).toEqual([0, 1, 2, 3, 4]);
    // Sex=F(1), Region=R1(0), Year 0..4 → indices 15,16,17,18,19
    expect(female.points.map((p) => p.value)).toEqual([15, 16, 17, 18, 19]);
  });

  // 8c. Three dimensions, all non-x dims have size 1 — falls back to single series
  test('3 dims, all non-x dims have size 1 — single series', () => {
    const ds: JsonStatDataset = {
      id: ['Filter', 'Metric', 'Year'],
      size: [1, 1, 3],
      dimension: {
        Filter: {
          category: {
            index: ['ALL'],
            label: { ALL: 'All' },
          },
        },
        Metric: {
          category: {
            index: ['V'],
            label: { V: 'Value' },
          },
        },
        Year: {
          category: {
            index: ['2020', '2021', '2022'],
            label: { '2020': '2020', '2021': '2021', '2022': '2022' },
          },
        },
      },
      // Filter(1) × Metric(1) × Year(3) = 3 values
      // strides: Filter=3, Metric=3, Year=1
      // ALL, V, 2020=0 → 10; 2021=1 → 20; 2022=2 → 30
      value: [10, 20, 30],
      role: { time: ['Year'], metric: ['Metric'] },
    };

    const result = transformDataset(ds);

    expect(result.series).toHaveLength(1);
    expect(result.categories).toEqual(['2020', '2021', '2022']);
    expect(result.series[0].points.map((p) => p.value)).toEqual([10, 20, 30]);
  });

  // 8d. Three dimensions: role.metric dim (size 3) excluded; Region(2) correctly picked as series
  test('3 dims with role.metric excluded from series candidates', () => {
    const ds: JsonStatDataset = {
      id: ['ContentVar', 'Region', 'Year'],
      size: [3, 2, 5],
      dimension: {
        ContentVar: {
          category: {
            index: ['C1', 'C2', 'C3'],
            label: { C1: 'Metric 1', C2: 'Metric 2', C3: 'Metric 3' },
          },
        },
        Region: {
          category: {
            index: ['R1', 'R2'],
            label: { R1: 'Helsinki', R2: 'Tampere' },
          },
        },
        Year: {
          category: {
            index: ['2020', '2021', '2022', '2023', '2024'],
            label: { '2020': '2020', '2021': '2021', '2022': '2022', '2023': '2023', '2024': '2024' },
          },
        },
      },
      // ContentVar(3) × Region(2) × Year(5) = 30 values
      // strides: ContentVar=10, Region=5, Year=1
      // CV=0, R1, Y0..4 → indices 0..4
      // CV=0, R2, Y0..4 → indices 5..9
      value: Array.from({ length: 30 }, (_, i) => i),
      role: { time: ['Year'], metric: ['ContentVar'] },
    };

    const result = transformDataset(ds);

    // ContentVar excluded (metric); Region (size 2) is the only candidate
    expect(result.series).toHaveLength(2);

    const r1 = result.series.find((s) => s.code === 'R1')!;
    const r2 = result.series.find((s) => s.code === 'R2')!;
    // Region=R1(0), ContentVar fixed at 0, Year 0..4 → indices 0,1,2,3,4
    expect(r1.points.map((p) => p.value)).toEqual([0, 1, 2, 3, 4]);
    // Region=R2(1), ContentVar fixed at 0, Year 0..4 → indices 5,6,7,8,9
    expect(r2.points.map((p) => p.value)).toEqual([5, 6, 7, 8, 9]);
  });

  // 8e. yLabel derivation still works correctly for a 3-dim dataset after series auto-detection
  test('3 dims without role.metric: yLabel is undefined when fixed dim has no unit', () => {
    const ds: JsonStatDataset = {
      id: ['Sex', 'Region', 'Year'],
      size: [2, 3, 5],
      dimension: {
        Sex: {
          category: {
            index: ['M', 'F'],
            label: { M: 'Male', F: 'Female' },
          },
        },
        Region: {
          category: {
            index: ['R1', 'R2', 'R3'],
            label: { R1: 'Helsinki', R2: 'Tampere', R3: 'Oulu' },
          },
        },
        Year: {
          category: {
            index: ['2020', '2021', '2022', '2023', '2024'],
            label: { '2020': '2020', '2021': '2021', '2022': '2022', '2023': '2023', '2024': '2024' },
          },
        },
      },
      value: Array.from({ length: 30 }, (_, i) => i),
      role: { time: ['Year'] },
    };

    const result = transformDataset(ds);

    // Sex is series (size 2 < Region size 3), Region is the fixed "content" dim
    // Region has no unit metadata → yLabel should be undefined
    expect(result.yLabel).toBeUndefined();
  });

  // 8f. 3 dims, no role.metric, content dim has category.unit — excluded from series candidates
  test('3 dims, no role.metric, content dim has category.unit — excluded from series candidates', () => {
    const ds: JsonStatDataset = {
      id: ['ContentVar', 'Region', 'Year'],
      size: [2, 3, 5],
      dimension: {
        ContentVar: {
          category: {
            index: ['C1', 'C2'],
            label: { C1: 'Euros', C2: 'Count' },
            unit: {
              C1: { label: 'EUR', decimals: 1 },
              C2: { label: 'n', decimals: 0 },
            },
          },
        },
        Region: {
          category: {
            index: ['R1', 'R2', 'R3'],
            label: { R1: 'Helsinki', R2: 'Tampere', R3: 'Oulu' },
          },
        },
        Year: {
          category: {
            index: ['2020', '2021', '2022', '2023', '2024'],
            label: { '2020': '2020', '2021': '2021', '2022': '2022', '2023': '2023', '2024': '2024' },
          },
        },
      },
      // ContentVar(2) × Region(3) × Year(5) = 30 values
      // strides: ContentVar=15, Region=5, Year=1
      // ContentVar=C1(0), Region=R1(0), Year 0..4 → indices 0..4
      // ContentVar=C1(0), Region=R2(1), Year 0..4 → indices 5..9
      // ContentVar=C1(0), Region=R3(2), Year 0..4 → indices 10..14
      value: Array.from({ length: 30 }, (_, i) => i),
      role: { time: ['Year'] }, // no role.metric
    };

    const result = transformDataset(ds);

    // ContentVar excluded because it has category.unit; Region (size 3) is the only candidate
    expect(result.series).toHaveLength(3);
    expect(result.categories).toHaveLength(5);

    const r1 = result.series.find((s) => s.code === 'R1')!;
    const r2 = result.series.find((s) => s.code === 'R2')!;
    const r3 = result.series.find((s) => s.code === 'R3')!;
    // ContentVar fixed at index 0 (C1), Year 0..4
    expect(r1.points.map((p) => p.value)).toEqual([0, 1, 2, 3, 4]);
    expect(r2.points.map((p) => p.value)).toEqual([5, 6, 7, 8, 9]);
    expect(r3.points.map((p) => p.value)).toEqual([10, 11, 12, 13, 14]);
  });

  // 8g. 4 dims, x + series + two extra dims pinned at index 0
  test('4 dims, x + series + two extra dims pinned at index 0', () => {
    const ds: JsonStatDataset = {
      id: ['Sex', 'AgeGroup', 'Region', 'Year'],
      size: [2, 3, 4, 5],
      dimension: {
        Sex: {
          category: {
            index: ['M', 'F'],
            label: { M: 'Male', F: 'Female' },
          },
        },
        AgeGroup: {
          category: {
            index: ['A1', 'A2', 'A3'],
            label: { A1: '0-17', A2: '18-64', A3: '65+' },
          },
        },
        Region: {
          category: {
            index: ['R1', 'R2', 'R3', 'R4'],
            label: { R1: 'Helsinki', R2: 'Tampere', R3: 'Oulu', R4: 'Turku' },
          },
        },
        Year: {
          category: {
            index: ['2020', '2021', '2022', '2023', '2024'],
            label: { '2020': '2020', '2021': '2021', '2022': '2022', '2023': '2023', '2024': '2024' },
          },
        },
      },
      // Sex(2) × AgeGroup(3) × Region(4) × Year(5) = 120 values
      // strides: Sex=60, AgeGroup=20, Region=5, Year=1
      // Sex=M(0), AgeGroup=A1(0), Region=R1(0), Year 0..4 → indices 0..4
      // Sex=F(1), AgeGroup=A1(0), Region=R1(0), Year 0..4 → indices 60..64
      value: Array.from({ length: 120 }, (_, i) => i),
      role: { time: ['Year'] },
    };

    const result = transformDataset(ds);

    // Sex (size 2) is smallest non-x candidate → series; AgeGroup and Region pinned at index 0
    expect(result.series).toHaveLength(2);
    expect(result.categories).toHaveLength(5);

    const male = result.series.find((s) => s.code === 'M')!;
    const female = result.series.find((s) => s.code === 'F')!;
    // Sex=M(0), AgeGroup=A1(0), Region=R1(0), Year 0..4 → 0*60+0*20+0*5+y = y
    expect(male.points.map((p) => p.value)).toEqual([0, 1, 2, 3, 4]);
    // Sex=F(1), AgeGroup=A1(0), Region=R1(0), Year 0..4 → 1*60+0*20+0*5+y = 60+y
    expect(female.points.map((p) => p.value)).toEqual([60, 61, 62, 63, 64]);
  });

  // 9. xLabel and yLabel derived from dataset metadata
  test('xLabel is set from x-dimension label', () => {
    const ds: JsonStatDataset = {
      id: ['Year'],
      size: [3],
      dimension: {
        Year: {
          label: 'Reference year',
          category: {
            index: ['2020', '2021', '2022'],
            label: { '2020': '2020', '2021': '2021', '2022': '2022' },
          },
        },
      },
      value: [1, 2, 3],
    };
    const result = transformDataset(ds);
    expect(result.xLabel).toBe('Reference year');
  });

  test('xLabel falls back to dimension id when label is absent', () => {
    const result = transformDataset(singleDimDataset);
    // singleDimDataset has no label on Year dimension → falls back to 'Year'
    expect(result.xLabel).toBe('Year');
  });

  test('yLabel derived from unambiguous single-unit content dimension', () => {
    const ds: JsonStatDataset = {
      id: ['ContVar', 'Region'],
      size: [1, 3],
      dimension: {
        ContVar: {
          label: 'Measure',
          category: {
            index: ['POP'],
            label: { POP: 'Population' },
            unit: { POP: { label: 'thousands', decimals: 0 } },
          },
        },
        Region: {
          label: 'Region',
          category: {
            index: ['R1', 'R2', 'R3'],
            label: { R1: 'Helsinki', R2: 'Tampere', R3: 'Oulu' },
          },
        },
      },
      value: [100, 200, 300],
      role: { metric: ['ContVar'] },
    };
    const result = transformDataset(ds, { xDimension: 'Region' });
    expect(result.yLabel).toBe('thousands');
  });

  test('yLabel is undefined when content dimension has no unit metadata', () => {
    const result = transformDataset(twoDimDataset);
    expect(result.yLabel).toBeUndefined();
  });

  test('yLabel is undefined when units have different labels', () => {
    const ds: JsonStatDataset = {
      id: ['ContVar', 'Region'],
      size: [2, 3],
      dimension: {
        ContVar: {
          label: 'Measure',
          category: {
            index: ['POP', 'AREA'],
            label: { POP: 'Population', AREA: 'Area' },
            unit: {
              POP: { label: 'thousands', decimals: 0 },
              AREA: { label: 'km²', decimals: 0 },
            },
          },
        },
        Region: {
          label: 'Region',
          category: {
            index: ['R1', 'R2', 'R3'],
            label: { R1: 'Helsinki', R2: 'Tampere', R3: 'Oulu' },
          },
        },
      },
      value: [100, 200, 300, 10, 20, 30],
      role: { metric: ['ContVar'] },
    };
    const result = transformDataset(ds, { xDimension: 'Region' });
    expect(result.yLabel).toBeUndefined();
  });

  test('yLabel is undefined when some unit entries are missing a label', () => {
    const ds: JsonStatDataset = {
      id: ['ContVar', 'Region'],
      size: [2, 3],
      dimension: {
        ContVar: {
          label: 'Measure',
          category: {
            index: ['POP', 'AREA'],
            label: { POP: 'Population', AREA: 'Area' },
            unit: {
              POP: { label: 'thousands', decimals: 0 },
              AREA: { decimals: 0 }, // no label
            },
          },
        },
        Region: {
          label: 'Region',
          category: {
            index: ['R1', 'R2', 'R3'],
            label: { R1: 'Helsinki', R2: 'Tampere', R3: 'Oulu' },
          },
        },
      },
      value: [100, 200, 300, 10, 20, 30],
      role: { metric: ['ContVar'] },
    };
    const result = transformDataset(ds, { xDimension: 'Region' });
    expect(result.yLabel).toBeUndefined();
  });

  test('yLabel is undefined when all unit labels are empty strings', () => {
    const ds: JsonStatDataset = {
      id: ['ContVar', 'Region'],
      size: [2, 3],
      dimension: {
        ContVar: {
          label: 'Measure',
          category: {
            index: ['POP', 'AREA'],
            label: { POP: 'Population', AREA: 'Area' },
            unit: {
              POP: { label: '', decimals: 0 },
              AREA: { label: '', decimals: 0 },
            },
          },
        },
        Region: {
          label: 'Region',
          category: {
            index: ['R1', 'R2', 'R3'],
            label: { R1: 'Helsinki', R2: 'Tampere', R3: 'Oulu' },
          },
        },
      },
      value: [100, 200, 300, 10, 20, 30],
      role: { metric: ['ContVar'] },
    };
    const result = transformDataset(ds, { xDimension: 'Region' });
    expect(result.yLabel).toBeUndefined();
  });

  test('yLabel is undefined when single-unit has whitespace-only label', () => {
    const ds: JsonStatDataset = {
      id: ['ContVar', 'Region'],
      size: [1, 3],
      dimension: {
        ContVar: {
          label: 'Measure',
          category: {
            index: ['POP'],
            label: { POP: 'Population' },
            unit: { POP: { label: '   ', decimals: 0 } },
          },
        },
        Region: {
          label: 'Region',
          category: {
            index: ['R1', 'R2', 'R3'],
            label: { R1: 'Helsinki', R2: 'Tampere', R3: 'Oulu' },
          },
        },
      },
      value: [100, 200, 300],
      role: { metric: ['ContVar'] },
    };
    const result = transformDataset(ds, { xDimension: 'Region' });
    expect(result.yLabel).toBeUndefined();
  });

  test('yLabel is undefined when all multi-unit labels are whitespace-only', () => {
    const ds: JsonStatDataset = {
      id: ['ContVar', 'Region'],
      size: [2, 3],
      dimension: {
        ContVar: {
          label: 'Measure',
          category: {
            index: ['POP', 'AREA'],
            label: { POP: 'Population', AREA: 'Area' },
            unit: {
              POP: { label: '   ', decimals: 0 },
              AREA: { label: '   ', decimals: 0 },
            },
          },
        },
        Region: {
          label: 'Region',
          category: {
            index: ['R1', 'R2', 'R3'],
            label: { R1: 'Helsinki', R2: 'Tampere', R3: 'Oulu' },
          },
        },
      },
      value: [100, 200, 300, 10, 20, 30],
      role: { metric: ['ContVar'] },
    };
    const result = transformDataset(ds, { xDimension: 'Region' });
    expect(result.yLabel).toBeUndefined();
  });

  test('yLabel is undefined when one unit has real label and another has empty string', () => {
    const ds: JsonStatDataset = {
      id: ['ContVar', 'Region'],
      size: [2, 3],
      dimension: {
        ContVar: {
          label: 'Measure',
          category: {
            index: ['POP', 'AREA'],
            label: { POP: 'Population', AREA: 'Area' },
            unit: {
              POP: { label: 'thousands', decimals: 0 },
              AREA: { label: '', decimals: 0 },
            },
          },
        },
        Region: {
          label: 'Region',
          category: {
            index: ['R1', 'R2', 'R3'],
            label: { R1: 'Helsinki', R2: 'Tampere', R3: 'Oulu' },
          },
        },
      },
      value: [100, 200, 300, 10, 20, 30],
      role: { metric: ['ContVar'] },
    };
    const result = transformDataset(ds, { xDimension: 'Region' });
    expect(result.yLabel).toBeUndefined();
  });

  // X1. 3-dim, last dim is size-1 content — should pick age (size 5), not metric
  test('x-dim fallback: 3-dim, last dim is size-1 content dim — picks age (size 5)', () => {
    const ds: JsonStatDataset = {
      id: ['year', 'age', 'metric'],
      size: [1, 5, 1],
      dimension: {
        year: {
          category: {
            index: ['2024'],
            label: { '2024': '2024' },
          },
        },
        age: {
          category: {
            index: ['0-4', '5-14', '15-24', '25-64', '65+'],
            label: { '0-4': '0–4', '5-14': '5–14', '15-24': '15–24', '25-64': '25–64', '65+': '65+' },
          },
        },
        metric: {
          category: {
            index: ['POP'],
            label: { POP: 'Population' },
            unit: { POP: { label: 'persons', decimals: 0 } },
          },
        },
      },
      // year(1) × age(5) × metric(1) = 5 values; strides: year=5, age=1, metric=1
      value: [10, 20, 30, 40, 50],
    };

    const result = transformDataset(ds);

    // age should be x (size 5, last non-content dim with size > 1)
    expect(result.categories).toEqual(['0-4', '5-14', '15-24', '25-64', '65+']);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].points.map((p) => p.value)).toEqual([10, 20, 30, 40, 50]);
  });

  // X2. 2-dim, last dim is size-1 content with role.metric — should pick region (size 3)
  test('x-dim fallback: 2-dim, last dim is size-1 content (role.metric + unit) — picks region (size 3)', () => {
    const ds: JsonStatDataset = {
      id: ['region', 'metric'],
      size: [3, 1],
      dimension: {
        region: {
          category: {
            index: ['R1', 'R2', 'R3'],
            label: { R1: 'North', R2: 'Central', R3: 'South' },
          },
        },
        metric: {
          category: {
            index: ['VAL'],
            label: { VAL: 'Value' },
            unit: { VAL: { label: 'EUR', decimals: 2 } },
          },
        },
      },
      // region(3) × metric(1) = 3 values; strides: region=1, metric=1
      value: [100, 200, 300],
      role: { metric: ['metric'] },
    };

    const result = transformDataset(ds);

    // region should be x (size 3, only non-content candidate)
    expect(result.categories).toEqual(['R1', 'R2', 'R3']);
    expect(result.categoryLabels).toEqual(['North', 'Central', 'South']);
    // 2-dim: remaining dim (metric, size 1) becomes single series
    expect(result.series).toHaveLength(1);
    expect(result.series[0].points.map((p) => p.value)).toEqual([100, 200, 300]);
  });

  // X3. All non-content dims have size 1 — picks year (non-content, size 1 fallback)
  test('x-dim fallback: all non-content dims have size 1 — picks year over content metric', () => {
    const ds: JsonStatDataset = {
      id: ['year', 'metric'],
      size: [1, 1],
      dimension: {
        year: {
          category: {
            index: ['2024'],
            label: { '2024': '2024' },
          },
        },
        metric: {
          category: {
            index: ['POP'],
            label: { POP: 'Population' },
            unit: { POP: { label: 'n', decimals: 0 } },
          },
        },
      },
      // year(1) × metric(1) = 1 value
      value: [42],
    };

    const result = transformDataset(ds);

    // year should be x (only non-content candidate, even though size 1)
    expect(result.categories).toEqual(['2024']);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].points[0].value).toBe(42);
  });

  // X4. No content dims, no time — last dim picked (preserves old behavior)
  test('x-dim fallback: no content dims, no time — last dim (age) picked as x', () => {
    const ds: JsonStatDataset = {
      id: ['region', 'age'],
      size: [3, 4],
      dimension: {
        region: {
          category: {
            index: ['R1', 'R2', 'R3'],
            label: { R1: 'North', R2: 'Central', R3: 'South' },
          },
        },
        age: {
          category: {
            index: ['0-17', '18-34', '35-64', '65+'],
            label: { '0-17': '0–17', '18-34': '18–34', '35-64': '35–64', '65+': '65+' },
          },
        },
      },
      // region(3) × age(4) = 12 values; strides: region=4, age=1
      value: Array.from({ length: 12 }, (_, i) => i),
    };

    const result = transformDataset(ds);

    // age is last dim in id with size > 1 → picked as x
    expect(result.categories).toEqual(['0-17', '18-34', '35-64', '65+']);
    // 2-dim: region becomes series (3 series)
    expect(result.series).toHaveLength(3);
    const north = result.series.find((s) => s.code === 'R1')!;
    // R1(0) × age 0..3 → indices 0,1,2,3
    expect(north.points.map((p) => p.value)).toEqual([0, 1, 2, 3]);
  });

  // T1. Size-1 time dim + larger categorical dim: should pick categorical, not time (bug fix)
  test('x-dim: size-1 time dim defers to larger categorical dim', () => {
    const ds: JsonStatDataset = {
      id: ['vuosi', 'ika', 'tiedot'],
      size: [1, 5, 1],
      dimension: {
        vuosi: {
          category: {
            index: ['2023'],
            label: { '2023': '2023' },
          },
        },
        ika: {
          category: {
            index: ['0-4', '5-14', '15-29', '30-44', '45-64'],
            label: { '0-4': '0–4', '5-14': '5–14', '15-29': '15–29', '30-44': '30–44', '45-64': '45–64' },
          },
        },
        tiedot: {
          category: {
            index: ['v1'],
            label: { v1: 'Count' },
          },
        },
      },
      // vuosi(1) × ika(5) × tiedot(1) = 5 values; strides: vuosi=5, ika=1, tiedot=1
      value: [10, 20, 30, 40, 50],
      role: { time: ['vuosi'], metric: ['tiedot'] },
    };

    const result = transformDataset(ds);

    // ika (size 5) should be x; vuosi time dim (size 1) should not be picked
    expect(result.categories).toEqual(['0-4', '5-14', '15-29', '30-44', '45-64']);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].points.map((p) => p.value)).toEqual([10, 20, 30, 40, 50]);
  });

  // T2. Geo dimension as x-axis when time dim has size 1
  test('x-dim: geo dimension (role.geo) picked as x when time dim has size 1', () => {
    const ds: JsonStatDataset = {
      id: ['vuosi', 'alue'],
      size: [1, 4],
      dimension: {
        vuosi: {
          category: {
            index: ['2023'],
            label: { '2023': '2023' },
          },
        },
        alue: {
          category: {
            index: ['FI', 'SE', 'NO', 'DK'],
            label: { FI: 'Finland', SE: 'Sweden', NO: 'Norway', DK: 'Denmark' },
          },
        },
      },
      // vuosi(1) × alue(4) = 4 values; strides: vuosi=4, alue=1
      value: [100, 200, 300, 400],
      role: { time: ['vuosi'], geo: ['alue'] },
    };

    const result = transformDataset(ds);

    // alue (size 4 > 1) should be x; vuosi time dim (size 1) deferred
    expect(result.categories).toEqual(['FI', 'SE', 'NO', 'DK']);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].points.map((p) => p.value)).toEqual([100, 200, 300, 400]);
  });

  // T3. Time dim with size > 1 still picked as x-axis (existing behavior preserved)
  test('x-dim: time dim with size > 1 still wins over larger categorical dim', () => {
    const ds: JsonStatDataset = {
      id: ['vuosi', 'ika'],
      size: [3, 5],
      dimension: {
        vuosi: {
          category: {
            index: ['2021', '2022', '2023'],
            label: { '2021': '2021', '2022': '2022', '2023': '2023' },
          },
        },
        ika: {
          category: {
            index: ['0-4', '5-14', '15-29', '30-44', '45-64'],
            label: { '0-4': '0–4', '5-14': '5–14', '15-29': '15–29', '30-44': '30–44', '45-64': '45–64' },
          },
        },
      },
      // vuosi(3) × ika(5) = 15 values; strides: vuosi=5, ika=1
      value: Array.from({ length: 15 }, (_, i) => i),
      role: { time: ['vuosi'] },
    };

    const result = transformDataset(ds);

    // vuosi is time dim with size 3 > 1 → picked as x despite ika being larger
    expect(result.categories).toEqual(['2021', '2022', '2023']);
    expect(result.series).toHaveLength(5);
  });

  // T4. All dims size 1 with role.time: falls back to time dim (key-figure scenario)
  test('x-dim: all dims size 1 with role.time falls back to time dim', () => {
    const ds: JsonStatDataset = {
      id: ['vuosi', 'tiedot'],
      size: [1, 1],
      dimension: {
        vuosi: {
          category: {
            index: ['2023'],
            label: { '2023': '2023' },
          },
        },
        tiedot: {
          category: {
            index: ['v1'],
            label: { v1: 'Value' },
          },
        },
      },
      value: [42],
      role: { time: ['vuosi'], metric: ['tiedot'] },
    };

    const result = transformDataset(ds);

    // All dims size 1; time dim used as x-axis fallback (Step 3)
    expect(result.categories).toEqual(['2023']);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].points[0].value).toBe(42);
  });

  // SL1. seriesLabel is populated from series dimension label (multi-series)
  test('seriesLabel populated from series dimension label when dataset has 2+ dims', () => {
    const ds: JsonStatDataset = {
      id: ['Year', 'Region'],
      size: [2, 2],
      dimension: {
        Year: {
          category: {
            index: ['2020', '2021'],
            label: { '2020': '2020', '2021': '2021' },
          },
        },
        Region: {
          label: 'Region',
          category: {
            index: ['R1', 'R2'],
            label: { R1: 'Helsinki', R2: 'Tampere' },
          },
        },
      },
      value: [10, 20, 30, 40],
      role: { time: ['Year'] },
    };
    const result = transformDataset(ds);
    // Year is x (time role), Region is series → seriesLabel should be 'Region'
    expect(result.seriesLabel).toBe('Region');
  });

  // SL2. seriesLabel is undefined for single-dimension dataset
  test('seriesLabel is undefined for single-dimension dataset', () => {
    const result = transformDataset(singleDimDataset);
    expect(result.seriesLabel).toBeUndefined();
  });

  // SL3. seriesLabel falls back to dimension id when no label property
  test('seriesLabel falls back to dimension id when series dim has no label', () => {
    const ds: JsonStatDataset = {
      id: ['Year', 'Region'],
      size: [2, 2],
      dimension: {
        Year: {
          category: {
            index: ['2020', '2021'],
            label: { '2020': '2020', '2021': '2021' },
          },
        },
        Region: {
          // no label property
          category: {
            index: ['R1', 'R2'],
            label: { R1: 'Helsinki', R2: 'Tampere' },
          },
        },
      },
      value: [10, 20, 30, 40],
      role: { time: ['Year'] },
    };
    const result = transformDataset(ds);
    // Region has no dimension-level label → falls back to dimension id 'Region'
    expect(result.seriesLabel).toBe('Region');
  });

  // T5. No-time dataset: last dim picked as x, NOT the largest (regression guard)
  test('x-dim: no-time dataset picks LAST dim in id order, not largest', () => {
    // "a" has size 5 (larger), "b" has size 4 (smaller, but last)
    // Old behavior: id[id.length - 1] = "b". Must not flip to largest.
    const ds: JsonStatDataset = {
      id: ['a', 'b'],
      size: [5, 4],
      dimension: {
        a: {
          category: {
            index: ['a1', 'a2', 'a3', 'a4', 'a5'],
            label: { a1: 'A1', a2: 'A2', a3: 'A3', a4: 'A4', a5: 'A5' },
          },
        },
        b: {
          category: {
            index: ['b1', 'b2', 'b3', 'b4'],
            label: { b1: 'B1', b2: 'B2', b3: 'B3', b4: 'B4' },
          },
        },
      },
      // a(5) × b(4) = 20 values; strides: a=4, b=1
      value: Array.from({ length: 20 }, (_, i) => i),
      // no role.time
    };

    const result = transformDataset(ds);

    // "b" is last in id → x-axis (preserves old behavior)
    expect(result.categories).toEqual(['b1', 'b2', 'b3', 'b4']);
    // 2-dim: "a" becomes series (5 series)
    expect(result.series).toHaveLength(5);
  });
});

describe('transformScatterData', () => {
  const scatterDataset: import('../../src/types').JsonStatDataset = {
    id: ['Metric', 'Year'],
    size: [2, 3],
    dimension: {
      Metric: {
        label: 'Metric',
        category: {
          index: ['price', 'cost'],
          label: { price: 'Price of apartments', cost: 'Maintenance costs' },
        },
        role: undefined,
      } as any,
      Year: {
        label: 'Year',
        category: {
          index: ['2023', '2024', '2025'],
          label: { '2023': '2023', '2024': '2024', '2025': '2025' },
        },
      },
    },
    value: [1400, 1450, 1513, 400, 410, 423],
    role: { metric: ['Metric'] },
  };

  test('observationLabel is populated from observation dimension label', () => {
    const result = transformScatterData(scatterDataset, {
      xContentValue: 'price',
      yContentValue: 'cost',
    });
    expect(result.observationLabel).toBe('Year');
  });

  test('observationLabel is undefined when dimension has no label', () => {
    const datasetNoLabel: import('../../src/types').JsonStatDataset = {
      ...scatterDataset,
      dimension: {
        ...scatterDataset.dimension,
        Year: {
          category: scatterDataset.dimension['Year'].category,
        },
      },
    };
    const result = transformScatterData(datasetNoLabel, {
      xContentValue: 'price',
      yContentValue: 'cost',
    });
    expect(result.observationLabel).toBeUndefined();
  });

  test('points are correctly extracted with x and y values', () => {
    const result = transformScatterData(scatterDataset, {
      xContentValue: 'price',
      yContentValue: 'cost',
    });
    expect(result.points).toHaveLength(3);
    expect(result.points[2].x).toBe(1513);
    expect(result.points[2].y).toBe(423);
    expect(result.points[2].label).toBe('2025');
  });

  test('xUnit and yUnit are undefined when unit label is empty string', () => {
    const ds: import('../../src/types').JsonStatDataset = {
      ...scatterDataset,
      dimension: {
        ...scatterDataset.dimension,
        Metric: {
          ...scatterDataset.dimension['Metric'],
          category: {
            ...scatterDataset.dimension['Metric'].category,
            unit: {
              price: { label: '', decimals: 0 },
              cost: { label: '', decimals: 0 },
            },
          },
        } as any,
      },
    };
    const result = transformScatterData(ds, {
      xContentValue: 'price',
      yContentValue: 'cost',
    });
    expect(result.xUnit).toBeUndefined();
    expect(result.yUnit).toBeUndefined();
  });

  test('xUnit and yUnit are undefined when unit label is whitespace-only', () => {
    const ds: import('../../src/types').JsonStatDataset = {
      ...scatterDataset,
      dimension: {
        ...scatterDataset.dimension,
        Metric: {
          ...scatterDataset.dimension['Metric'],
          category: {
            ...scatterDataset.dimension['Metric'].category,
            unit: {
              price: { label: '  ', decimals: 0 },
              cost: { label: '  ', decimals: 0 },
            },
          },
        } as any,
      },
    };
    const result = transformScatterData(ds, {
      xContentValue: 'price',
      yContentValue: 'cost',
    });
    expect(result.xUnit).toBeUndefined();
    expect(result.yUnit).toBeUndefined();
  });
});

// --- transformPyramidData tests ---

describe('transformPyramidData', () => {
  const pyramidDataset: import('../../src/types').JsonStatDataset = {
    id: ['Sex', 'Age'],
    size: [2, 3],
    dimension: {
      Sex: {
        label: 'Sex',
        category: {
          index: ['male', 'female'],
          label: { male: 'Male', female: 'Female' },
        },
      },
      Age: {
        label: 'Age',
        category: {
          index: ['0-9', '10-19', '20-29'],
          label: { '0-9': '0–9', '10-19': '10–19', '20-29': '20–29' },
        },
      },
    },
    value: [100, 200, 300, 110, 220, 330],
  };

  it('populates splitDimensionLabel from split dimension', () => {
    const result = transformPyramidData(pyramidDataset, {
      splitDimension: 'Sex',
      categoryDimension: 'Age',
    });
    expect(result.splitDimensionLabel).toBe('Sex');
  });

  it('populates categoryDimensionLabel from category dimension', () => {
    const result = transformPyramidData(pyramidDataset, {
      splitDimension: 'Sex',
      categoryDimension: 'Age',
    });
    expect(result.categoryDimensionLabel).toBe('Age');
  });

  it('splitDimensionLabel is undefined when dimension has no label', () => {
    const ds: import('../../src/types').JsonStatDataset = {
      ...pyramidDataset,
      dimension: {
        Sex: {
          category: pyramidDataset.dimension['Sex'].category,
        },
        Age: pyramidDataset.dimension['Age'],
      },
    };
    const result = transformPyramidData(ds, {
      splitDimension: 'Sex',
      categoryDimension: 'Age',
    });
    expect(result.splitDimensionLabel).toBeUndefined();
  });
});
