import { computeTableOrientation, transformTableData } from '../../src/data/table-transform';
import { rebuildDataset } from '../../src/data/rebuild-dataset';
import { JsonStatDataset } from '../../src/types';

// ---------------------------------------------------------------------------
// Dataset factory helper
// ---------------------------------------------------------------------------

function makeDataset(
  overrides: Partial<JsonStatDataset> & Pick<JsonStatDataset, 'id' | 'size' | 'dimension' | 'value'>
): JsonStatDataset {
  return { ...overrides } as JsonStatDataset;
}

// ---------------------------------------------------------------------------
// Shared minimal dataset builders
// ---------------------------------------------------------------------------

/** Year(3) + Region(2), Year has time role */
function yearRegionDataset(): JsonStatDataset {
  return makeDataset({
    id: ['Year', 'Region'],
    size: [3, 2],
    dimension: {
      Year: {
        label: 'Year',
        category: {
          index: ['2020', '2021', '2022'],
          label: { '2020': '2020', '2021': '2021', '2022': '2022' },
        },
      },
      Region: {
        label: 'Region',
        category: { index: ['HEL', 'TRE'], label: { HEL: 'Helsinki', TRE: 'Tampere' } },
      },
    },
    value: [100, 200, 300, 400, 500, 600],
    role: { time: ['Year'] },
  });
}

// ===========================================================================
// computeTableOrientation
// ===========================================================================

describe('computeTableOrientation', () => {
  // -------------------------------------------------------------------------
  // Test 1: Time dim → columns, other dim → rows
  // -------------------------------------------------------------------------
  it('puts time dimension in columns and non-time dimension in rows', () => {
    const ds = yearRegionDataset();
    const { rows, columns, hidden } = computeTableOrientation(ds);

    expect(rows).toEqual(['Region']);
    expect(columns).toEqual(['Year']);
    expect(hidden).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Test 2: Geo → rows, time → columns
  // -------------------------------------------------------------------------
  it('puts geo dimension in rows and time dimension in columns', () => {
    const ds = makeDataset({
      id: ['Year', 'Municipality'],
      size: [3, 4],
      dimension: {
        Year: {
          label: 'Year',
          category: { index: ['2020', '2021', '2022'], label: {} },
        },
        Municipality: {
          label: 'Municipality',
          category: { index: ['A', 'B', 'C', 'D'], label: {} },
        },
      },
      value: new Array(12).fill(0),
      role: { time: ['Year'], geo: ['Municipality'] },
    });

    const { rows, columns, hidden } = computeTableOrientation(ds);

    expect(rows).toEqual(['Municipality']);
    expect(columns).toEqual(['Year']);
    expect(hidden).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Test 3: Size-1 dim is hidden
  // -------------------------------------------------------------------------
  it('puts size-1 dimensions in hidden', () => {
    const ds = makeDataset({
      id: ['Year', 'Region', 'Content'],
      size: [3, 2, 1],
      dimension: {
        Year: { label: 'Year', category: { index: ['2020', '2021', '2022'], label: {} } },
        Region: { label: 'Region', category: { index: ['HEL', 'TRE'], label: {} } },
        Content: { label: 'Content', category: { index: ['C1'], label: {} } },
      },
      value: new Array(6).fill(0),
    });

    const { rows, columns, hidden } = computeTableOrientation(ds);

    expect(hidden).toContain('Content');
    expect(rows).not.toContain('Content');
    expect(columns).not.toContain('Content');
  });

  // -------------------------------------------------------------------------
  // Test 4: Alternating by size — 4 active dims, no roles
  // Sizes: A=10, B=5, C=8, D=3 → sorted desc: A(10), C(8), B(5), D(3)
  // Alternation → rows=[A, B], columns=[C, D]
  // -------------------------------------------------------------------------
  it('alternates dims by size descending into rows and columns', () => {
    const ds = makeDataset({
      id: ['A', 'B', 'C', 'D'],
      size: [10, 5, 8, 3],
      dimension: {
        A: { label: 'A', category: { index: Array.from({ length: 10 }, (_, i) => `a${i}`), label: {} } },
        B: { label: 'B', category: { index: Array.from({ length: 5 }, (_, i) => `b${i}`), label: {} } },
        C: { label: 'C', category: { index: Array.from({ length: 8 }, (_, i) => `c${i}`), label: {} } },
        D: { label: 'D', category: { index: Array.from({ length: 3 }, (_, i) => `d${i}`), label: {} } },
      },
      value: new Array(10 * 5 * 8 * 3).fill(0),
    });

    const { rows, columns, hidden } = computeTableOrientation(ds);

    // Sorted desc: A(10), C(8), B(5), D(3)
    // i=0 → rows (A), i=1 → columns (C), i=2 → rows (B), i=3 → columns (D)
    expect(rows).toEqual(['A', 'B']);
    expect(columns).toEqual(['C', 'D']);
    expect(hidden).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Test 5: All-size-1 edge case → all dimensions hidden
  // -------------------------------------------------------------------------
  it('hides all dimensions when all dimensions have size 1', () => {
    const ds = makeDataset({
      id: ['A', 'B', 'C'],
      size: [1, 1, 1],
      dimension: {
        A: { label: 'A', category: { index: ['a0'], label: {} } },
        B: { label: 'B', category: { index: ['b0'], label: {} } },
        C: { label: 'C', category: { index: ['c0'], label: {} } },
      },
      value: [0],
    });

    const { rows, columns, hidden } = computeTableOrientation(ds);

    expect(rows).toEqual([]);
    expect(columns).toEqual([]);
    expect(hidden).toEqual(['A', 'B', 'C']);
  });

  // -------------------------------------------------------------------------
  // Test 6: Manual layout — valid input returned as-is
  // -------------------------------------------------------------------------
  it('honours a valid manual layout', () => {
    const ds = yearRegionDataset();
    const { rows, columns, hidden } = computeTableOrientation(ds, {
      rows: ['Year'],
      columns: ['Region'],
    });

    expect(rows).toEqual(['Year']);
    expect(columns).toEqual(['Region']);
    expect(hidden).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Test 7: Manual layout — unknown code throws
  // -------------------------------------------------------------------------
  it('throws when manual layout contains an unknown dimension code', () => {
    const ds = yearRegionDataset();

    expect(() =>
      computeTableOrientation(ds, { rows: ['DoesNotExist'], columns: ['Region'] })
    ).toThrow('[JsonStatChart] Unknown dimension code in layout: "DoesNotExist"');
  });

  // -------------------------------------------------------------------------
  // Test 8: Manual layout — code in both rows and columns throws
  // -------------------------------------------------------------------------
  it('throws when a dimension code appears in both rows and columns', () => {
    const ds = yearRegionDataset();

    expect(() =>
      computeTableOrientation(ds, { rows: ['Year'], columns: ['Year'] })
    ).toThrow('"Year" appears in both rows and columns');
  });

  // -------------------------------------------------------------------------
  // Test 9: Manual layout — unplaced dimensions are hidden
  // -------------------------------------------------------------------------
  it('keeps an unplaced multi-value dimension hidden', () => {
    const ds = makeDataset({
      id: ['Year', 'Region', 'Content'],
      size: [3, 2, 2],
      dimension: {
        Year: { label: 'Year', category: { index: ['2020', '2021', '2022'], label: {} } },
        Region: { label: 'Region', category: { index: ['HEL', 'TRE'], label: {} } },
        Content: { label: 'Content', category: { index: ['C1', 'C2'], label: {} } },
      },
      value: new Array(12).fill(0),
    });

    expect(computeTableOrientation(ds, { rows: ['Year'], columns: ['Region'] })).toEqual({
      rows: ['Year'],
      columns: ['Region'],
      hidden: ['Content'],
    });
  });

  it('hides singleton dimensions even when they are named in the layout', () => {
    const ds = makeDataset({
      id: ['Year', 'Region', 'Content'],
      size: [2, 2, 1],
      dimension: {
        Year: { label: 'Year', category: { index: ['2023', '2024'], label: {} } },
        Region: { label: 'Region', category: { index: ['N', 'S'], label: {} } },
        Content: { label: 'Content', category: { index: ['C1'], label: {} } },
      },
      value: [1, 2, 3, 4],
    });

    const result = transformTableData(ds, { layout: { rows: ['Content', 'Year'], columns: ['Region'] } });

    expect(result.rowDimensions.map(dimension => dimension.code)).toEqual(['Year']);
    expect(result.columnDimensions.map(dimension => dimension.code)).toEqual(['Region']);
    expect(result.hiddenDimensions.map(dimension => dimension.code)).toEqual(['Content']);
    expect(result.values).toEqual([[1, 2], [3, 4]]);
  });

  // -------------------------------------------------------------------------
  // Test 10: Tiebreaker — two dims with same size, earlier in id → rows
  // -------------------------------------------------------------------------
  it('breaks ties by position in dataset.id (earlier → rows)', () => {
    const ds = makeDataset({
      id: ['Alpha', 'Beta'],
      size: [4, 4],
      dimension: {
        Alpha: { label: 'Alpha', category: { index: ['a0', 'a1', 'a2', 'a3'], label: {} } },
        Beta: { label: 'Beta', category: { index: ['b0', 'b1', 'b2', 'b3'], label: {} } },
      },
      value: new Array(16).fill(0),
    });

    const { rows, columns } = computeTableOrientation(ds);

    // Alpha appears before Beta in id → Alpha gets rows (i=0), Beta gets columns (i=1)
    expect(rows).toEqual(['Alpha']);
    expect(columns).toEqual(['Beta']);
  });

  it('rejects duplicate codes in rows', () => {
    const ds = makeDataset({
      id: ['A', 'B'],
      size: [3, 2],
      dimension: {
        A: { category: { index: ['a1', 'a2', 'a3'] } },
        B: { category: { index: ['b1', 'b2'] } },
      },
      value: new Array(6).fill(0),
    });
    expect(() => computeTableOrientation(ds, { rows: ['A', 'A'], columns: ['B'] })).toThrow(
      /Duplicate dimension code in layout.rows: "A"/
    );
  });

  it('rejects duplicate codes in columns', () => {
    const ds = makeDataset({
      id: ['A', 'B'],
      size: [3, 2],
      dimension: {
        A: { category: { index: ['a1', 'a2', 'a3'] } },
        B: { category: { index: ['b1', 'b2'] } },
      },
      value: new Array(6).fill(0),
    });
    expect(() => computeTableOrientation(ds, { rows: ['A'], columns: ['B', 'B'] })).toThrow(
      /Duplicate dimension code in layout.columns: "B"/
    );
  });
});

// ===========================================================================
// transformTableData
// ===========================================================================

describe('transformTableData', () => {
  it('returns a scalar value grid when all dimensions are singleton', () => {
    const ds = makeDataset({
      id: ['A', 'B'],
      size: [1, 1],
      dimension: {
        A: { category: { index: ['a'] } },
        B: { category: { index: ['b'] } },
      },
      value: [42],
    });

    const result = transformTableData(ds);

    expect(result.rowDimensions).toEqual([]);
    expect(result.columnDimensions).toEqual([]);
    expect(result.values).toEqual([[42]]);
    expect(result.hiddenDimensions.map(dimension => dimension.code)).toEqual(['A', 'B']);
  });

  it('uses dataset.id rather than dimension dictionary order for configured layouts', () => {
    const ds = makeDataset({
      id: ['Region', 'Year', 'Metric'],
      size: [2, 2, 1],
      dimension: {
        Metric: { label: 'Metric', category: { index: ['value'], label: { value: 'Value' } } },
        Year: { label: 'Year', category: { index: ['2023', '2024'], label: { '2023': '2023', '2024': '2024' } } },
        Region: { label: 'Region', category: { index: ['N', 'S'], label: { N: 'North', S: 'South' } } },
      },
      value: [10, 20, 30, 40],
      role: { time: ['Year'], metric: ['Metric'] },
    });

    const layout = { rows: ['Region'], columns: ['Year'] };
    const rebuilt = rebuildDataset(ds, {
      layout,
      selectableSelections: { Metric: ['value'] },
    }).dataset;
    const result = transformTableData(rebuilt, { layout });

    expect(result.rowDimensions.map(dimension => dimension.code)).toEqual(['Region']);
    expect(result.columnDimensions.map(dimension => dimension.code)).toEqual(['Year']);
    expect(result.values).toEqual([
      [10, 20],
      [30, 40],
    ]);
  });

  // -------------------------------------------------------------------------
  // Test 11: Standard 2D dataset
  // -------------------------------------------------------------------------
  it('produces correct row/column dimensions and values grid for a 2D dataset', () => {
    // No roles → sorted by size desc: Year(3) → rows, Region(2) → cols
    const ds = makeDataset({
      id: ['Year', 'Region'],
      size: [3, 2],
      dimension: {
        Year: {
          label: 'Year',
          category: {
            index: ['2020', '2021', '2022'],
            label: { '2020': '2020', '2021': '2021', '2022': '2022' },
          },
        },
        Region: {
          label: 'Region',
          category: { index: ['HEL', 'TRE'], label: { HEL: 'Helsinki', TRE: 'Tampere' } },
        },
      },
      value: [10, 20, 30, 40, 50, 60],
    });

    const result = transformTableData(ds);

    expect(result.rowDimensions.map(d => d.code)).toEqual(['Year']);
    expect(result.columnDimensions.map(d => d.code)).toEqual(['Region']);
    expect(result.hiddenDimensions).toEqual([]);
    // Row-major: Year varies slowest, Region varies fastest
    expect(result.values).toEqual([
      [10, 20], // Year=2020
      [30, 40], // Year=2021
      [50, 60], // Year=2022
    ]);
  });

  // -------------------------------------------------------------------------
  // Test 12: 3D dataset with one size-1 hidden dim
  // -------------------------------------------------------------------------
  it('hides size-1 dimensions and builds a correct 2D grid for a 3D dataset', () => {
    const ds = makeDataset({
      id: ['Year', 'Region', 'Content'],
      size: [3, 2, 1],
      dimension: {
        Year: {
          label: 'Year',
          category: { index: ['2020', '2021', '2022'], label: {} },
        },
        Region: {
          label: 'Region',
          category: { index: ['HEL', 'TRE'], label: { HEL: 'Helsinki', TRE: 'Tampere' } },
        },
        Content: {
          label: 'Content label',
          category: { index: ['C1'], label: { C1: 'Population' } },
        },
      },
      value: [1, 2, 3, 4, 5, 6],
    });

    const result = transformTableData(ds);

    // Content (size 1) → hidden; Year (3) → rows; Region (2) → columns
    expect(result.rowDimensions.map(d => d.code)).toEqual(['Year']);
    expect(result.columnDimensions.map(d => d.code)).toEqual(['Region']);
    expect(result.hiddenDimensions).toEqual([
      { code: 'Content', label: 'Content label', value: 'Population' },
    ]);
    expect(result.values).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  // -------------------------------------------------------------------------
  // Test 13: Null and string values resolve to null in the grid
  // -------------------------------------------------------------------------
  it('resolves null and string marker values to null in the values grid', () => {
    const ds = makeDataset({
      id: ['Year', 'Region'],
      size: [2, 2],
      dimension: {
        Year: { label: 'Year', category: { index: ['2020', '2021'], label: {} } },
        Region: { label: 'Region', category: { index: ['HEL', 'TRE'], label: {} } },
      },
      // Mix of number, null, and string marker
      value: [42, null, '..', 99],
    });

    const result = transformTableData(ds);

    // Year(2) → rows, Region(2) same size → tiebreak: Year earlier → rows; Region → cols
    expect(result.values).toEqual([
      [42, null],  // Year=2020: HEL=42, TRE=null
      [null, 99],  // Year=2021: HEL='..' → null, TRE=99
    ]);
  });

  // -------------------------------------------------------------------------
  // Test 14: Category labels appear in TableDimension metadata
  // -------------------------------------------------------------------------
  it('populates dimension and category labels in TableDimension objects', () => {
    const ds = makeDataset({
      id: ['Year', 'Region'],
      size: [2, 2],
      dimension: {
        Year: {
          label: 'Reference year',
          category: {
            index: ['2020', '2021'],
            label: { '2020': 'Year 2020', '2021': 'Year 2021' },
          },
        },
        Region: {
          label: 'Geographic region',
          category: {
            index: ['HEL', 'TRE'],
            label: { HEL: 'Helsinki', TRE: 'Tampere' },
          },
        },
      },
      value: [1, 2, 3, 4],
    });

    const result = transformTableData(ds);

    // Year(2) and Region(2) — Year appears first → rows; Region → cols
    const yearDim = result.rowDimensions.find(d => d.code === 'Year');
    expect(yearDim?.label).toBe('Reference year');
    expect(yearDim?.categories).toEqual([
      { code: '2020', label: 'Year 2020' },
      { code: '2021', label: 'Year 2021' },
    ]);

    const regionDim = result.columnDimensions.find(d => d.code === 'Region');
    expect(regionDim?.label).toBe('Geographic region');
    expect(regionDim?.categories).toEqual([
      { code: 'HEL', label: 'Helsinki' },
      { code: 'TRE', label: 'Tampere' },
    ]);
  });

  // -------------------------------------------------------------------------
  // Test 15: Manual layout swaps default orientation
  // -------------------------------------------------------------------------
  it('respects a manual layout that swaps rows and columns', () => {
    // Without layout: Year(3) → rows, Region(2) → cols  (no roles, size desc)
    // With layout: Region → rows, Year → cols
    const ds = makeDataset({
      id: ['Year', 'Region'],
      size: [3, 2],
      dimension: {
        Year: {
          label: 'Year',
          category: {
            index: ['2020', '2021', '2022'],
            label: { '2020': '2020', '2021': '2021', '2022': '2022' },
          },
        },
        Region: {
          label: 'Region',
          category: { index: ['HEL', 'TRE'], label: { HEL: 'Helsinki', TRE: 'Tampere' } },
        },
      },
      value: [10, 20, 30, 40, 50, 60],
    });

    const result = transformTableData(ds, {
      layout: { rows: ['Region'], columns: ['Year'] },
    });

    expect(result.rowDimensions.map(d => d.code)).toEqual(['Region']);
    expect(result.columnDimensions.map(d => d.code)).toEqual(['Year']);

    // Region varies slowest (outer), Year varies fastest (inner)
    // strides: Year(idx=0)=2, Region(idx=1)=1
    // r=0 (HEL), c=0 (2020): 0*2 + 0*1 = 0 → 10
    // r=0 (HEL), c=1 (2021): 1*2 + 0*1 = 2 → 30
    // r=0 (HEL), c=2 (2022): 2*2 + 0*1 = 4 → 50
    // r=1 (TRE), c=0 (2020): 0*2 + 1*1 = 1 → 20
    // r=1 (TRE), c=1 (2021): 1*2 + 1*1 = 3 → 40
    // r=1 (TRE), c=2 (2022): 2*2 + 1*1 = 5 → 60
    expect(result.values).toEqual([
      [10, 30, 50],
      [20, 40, 60],
    ]);
  });
});
