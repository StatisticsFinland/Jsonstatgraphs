import { getApplicableChartTypes, selectDefaultChartType, DataProperties, ChartRejectionReason } from '../../src/data/chart-selector';
import { DimensionMeta, ChartType, JsonStatDataset } from '../../src/types';
import { getChartTypesForDataset, selectChartTypeForDataset } from '../../src/index';

// --- Dimension builder helpers ---

function makeTimeDim(size: number, isIrregular = false): DimensionMeta {
  return {
    code: 'time',
    type: 'Time',
    size,
    isIrregular,
  };
}

function makeOrdinalDim(code: string, size: number): DimensionMeta {
  return {
    code,
    type: 'Ordinal',
    size,
  };
}

function makeNominalDim(code: string, size: number): DimensionMeta {
  return {
    code,
    type: 'Nominal',
    size,
  };
}

function makeContentDim(size: number, numberOfUnits = 1): DimensionMeta {
  return {
    code: 'content',
    type: 'Content',
    size,
    numberOfUnits,
  };
}

const dataWithActual: DataProperties = {
  hasActualData: true,
  hasMissingData: false,
  hasNegativeData: false,
};

function getValidity(results: ReturnType<typeof getApplicableChartTypes>): Record<ChartType, boolean> {
  return Object.fromEntries(results.map(r => [r.type, r.valid])) as Record<ChartType, boolean>;
}

// --- Tests ---

describe('getApplicableChartTypes', () => {
  // 1. Line chart valid: time series with 2 regions, 5 years
  test('line chart valid for time series with 2 regions and 5 years', () => {
    const dims = [makeTimeDim(5), makeOrdinalDim('region', 2)];
    const results = getApplicableChartTypes(dataWithActual, dims);
    const lineResult = results.find(r => r.type === 'line')!;
    expect(lineResult.valid).toBe(true);
    expect(lineResult.rejectionReasons).toHaveLength(0);
  });

  // 2. Vertical bar valid: single multiselect 5 categories (Ordinal)
  test('vertical bar valid for single Ordinal multiselect with 5 categories', () => {
    const dims = [makeOrdinalDim('region', 5)];
    const results = getApplicableChartTypes(dataWithActual, dims);
    const vBarResult = results.find(r => r.type === 'verticalBar')!;
    expect(vBarResult.valid).toBe(true);
    expect(vBarResult.rejectionReasons).toHaveLength(0);
  });

  // 3. Stacked bar rejects negative data
  test('stacked vertical bar rejected when dataset has negative data', () => {
    const dims = [makeTimeDim(10), makeNominalDim('sector', 3)];
    const dp: DataProperties = { ...dataWithActual, hasNegativeData: true };
    const results = getApplicableChartTypes(dp, dims);
    const stackedResult = results.find(r => r.type === 'stackedVerticalBar')!;
    expect(stackedResult.valid).toBe(false);
    expect(stackedResult.rejectionReasons).toContain(ChartRejectionReason.NegativeDataNotAllowed);
  });

  // 4. Horizontal bar rejects ordinal first multiselect
  test('horizontal bar rejected when first multiselect is Ordinal', () => {
    // Single Ordinal multiselect + Time with size 1 (needed for horizontal bar)
    const dims = [makeOrdinalDim('ageGroup', 5), makeTimeDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims);
    const hBarResult = results.find(r => r.type === 'horizontalBar')!;
    expect(hBarResult.valid).toBe(false);
    expect(hBarResult.rejectionReasons).toContain(ChartRejectionReason.OrdinalFirstMultiselectNotAllowed);
  });

  // 5. Pie chart valid: single multiselect 5 categories, time dimension with size 1
  test('pie chart valid for single multiselect with 5 categories and time size 1', () => {
    // Time has size 1 (not a multiselect); Nominal dim is the single multiselect
    const dims = [makeNominalDim('sector', 5), makeTimeDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims);
    const pieResult = results.find(r => r.type === 'pie')!;
    expect(pieResult.valid).toBe(true);
    expect(pieResult.rejectionReasons).toHaveLength(0);
  });

  // 6. Scatter plot rejected when content dimension has only 1 value (needs 2)
  test('scatter plot rejected when content dimension has only 1 value', () => {
    const dims = [makeContentDim(1), makeNominalDim('obs', 5), makeOrdinalDim('region', 3)];
    const results = getApplicableChartTypes(dataWithActual, dims);
    const scatterResult = results.find(r => r.type === 'scatterPlot')!;
    expect(scatterResult.valid).toBe(false);
    expect(scatterResult.rejectionReasons).toContain(ChartRejectionReason.ContentDimensionSizeInvalid);
  });

  // 7. Pyramid rejected when no ordinal multiselect dimension exists
  test('pyramid rejected when no ordinal multiselect dimension exists', () => {
    // 2 Nominal multiselects + time size 1
    const dims = [makeNominalDim('region', 10), makeNominalDim('gender', 2), makeTimeDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims);
    const pyramidResult = results.find(r => r.type === 'pyramid')!;
    expect(pyramidResult.valid).toBe(false);
    expect(pyramidResult.rejectionReasons).toContain(ChartRejectionReason.OrdinalMultiselectRequired);
  });

  // 8. Table always valid with actual data
  test('table is valid when dataset has actual data', () => {
    const dims = [makeOrdinalDim('region', 3), makeTimeDim(4)];
    const results = getApplicableChartTypes(dataWithActual, dims);
    const tableResult = results.find(r => r.type === 'table')!;
    expect(tableResult.valid).toBe(true);
    expect(tableResult.rejectionReasons).toHaveLength(0);
  });

  // 9. No actual data: all types rejected except table
  test('all chart types except table are rejected when hasActualData is false', () => {
    const dp: DataProperties = { hasActualData: false, hasMissingData: true, hasNegativeData: false };
    const dims = [makeTimeDim(5), makeOrdinalDim('region', 2)];
    const results = getApplicableChartTypes(dp, dims);
    const validity = getValidity(results);
    const nonTableTypes = Object.entries(validity).filter(([type]) => type !== 'table');
    for (const [type, valid] of nonTableTypes) {
      expect({ type, valid }).toEqual({ type, valid: false });
    }
    expect(validity.table).toBe(true);
  });
});

describe('selectDefaultChartType', () => {
  // 10. Default type selection: time series dataset selects line as default
  test('selects line as default for a time series dataset', () => {
    // Time(5) + Ordinal(2): line chart should be first valid type in priority order
    const dims = [makeTimeDim(5), makeOrdinalDim('region', 2)];
    const result = selectDefaultChartType(dataWithActual, dims);
    expect(result).toBe('line');
  });

  test('falls back to table when no chart type is valid', () => {
    // No actual data and extreme dimensions that would break all types
    const dp: DataProperties = { hasActualData: false, hasMissingData: true, hasNegativeData: false };
    // Provide dimensions that make even table invalid (product > 100000)
    const hugeProduct: DimensionMeta[] = [
      { code: 'a', type: 'Nominal', size: 1000 },
      { code: 'b', type: 'Nominal', size: 1000 },
    ];
    const result = selectDefaultChartType(dp, hugeProduct);
    expect(result).toBe('table');
  });

  test('selects keyFigure as default when all dimensions have size 1', () => {
    const dims = [makeTimeDim(1), makeOrdinalDim('region', 1)];
    const result = selectDefaultChartType(dataWithActual, dims);
    expect(result).toBe('keyFigure');
  });
});

describe('keyFigure chart type selection', () => {
  test('keyFigure is valid when all dimensions have size 1', () => {
    const dims = [makeTimeDim(1), makeOrdinalDim('region', 1), makeNominalDim('sector', 1)];
    const results = getApplicableChartTypes(dataWithActual, dims);
    const keyFigureResult = results.find(r => r.type === 'keyFigure')!;
    expect(keyFigureResult).toBeDefined();
    expect(keyFigureResult.valid).toBe(true);
    expect(keyFigureResult.rejectionReasons).toHaveLength(0);
  });

  test('keyFigure is rejected when any dimension has size > 1', () => {
    const dims = [makeTimeDim(5), makeOrdinalDim('region', 1)];
    const results = getApplicableChartTypes(dataWithActual, dims);
    const keyFigureResult = results.find(r => r.type === 'keyFigure')!;
    expect(keyFigureResult).toBeDefined();
    expect(keyFigureResult.valid).toBe(false);
    expect(keyFigureResult.rejectionReasons).toContain(ChartRejectionReason.AllDimensionsMustHaveSingleValue);
  });
});

describe('timeOrLargestOrdinal does not include Nominal', () => {
  test('Nominal-only multiselect is rejected for line chart (no axis candidate)', () => {
    // Time has size 1 (not a multiselect); Nominal dim must NOT qualify as axis
    const dims = [makeNominalDim('region', 5), makeTimeDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims);
    const lineResult = results.find(r => r.type === 'line')!;
    // Nominal dim must NOT be picked as axis → line is rejected
    expect(lineResult.rejectionReasons).toContain(ChartRejectionReason.NoTimeOrOrdinalAxisDimension);
    expect(lineResult.valid).toBe(false);
  });
});

describe('timeOrLargestOrdinal Other type exclusion', () => {
  // 'Other'-typed multiselect dimension must NOT be selected as timeOrLargestOrdinal
  test('single Other-typed multiselect dimension does not qualify as timeOrLargestOrdinal', () => {
    const otherDim: DimensionMeta = { code: 'x', type: 'Other', size: 5 };
    const results = getApplicableChartTypes(dataWithActual, [otherDim]);
    const lineResult = results.find(r => r.type === 'line')!;
    // No valid axis candidate → line must be rejected with axis reason
    expect(lineResult.rejectionReasons).toContain(ChartRejectionReason.NoTimeOrOrdinalAxisDimension);
    expect(lineResult.valid).toBe(false);
  });
});

function makeGeoDim(code: string, size: number): DimensionMeta {
  return {
    code,
    type: 'Geo',
    size,
  };
}

describe('map chart type', () => {
  test('map valid with single geo multiselect and mapAvailable', () => {
    const dims = [makeGeoDim('region', 10), makeTimeDim(1), makeContentDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims, { mapAvailable: true });
    const mapResult = results.find(r => r.type === 'map')!;
    expect(mapResult.valid).toBe(true);
    expect(mapResult.rejectionReasons).toHaveLength(0);
  });

  test('map rejected without geo dimension', () => {
    const dims = [makeOrdinalDim('region', 10), makeTimeDim(1), makeContentDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims, { mapAvailable: true });
    const mapResult = results.find(r => r.type === 'map')!;
    expect(mapResult.valid).toBe(false);
    expect(mapResult.rejectionReasons).toContain(ChartRejectionReason.NoGeoDimension);
  });

  test('map rejected when mapAvailable is false', () => {
    const dims = [makeGeoDim('region', 10), makeTimeDim(1), makeContentDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims, { mapAvailable: false });
    const mapResult = results.find(r => r.type === 'map')!;
    expect(mapResult.valid).toBe(false);
    expect(mapResult.rejectionReasons).toContain(ChartRejectionReason.NoMapGeometryAvailable);
  });

  test('map valid structurally when mapAvailable is not provided', () => {
    const dims = [makeGeoDim('region', 10), makeTimeDim(1), makeContentDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims);
    const mapResult = results.find(r => r.type === 'map')!;
    expect(mapResult.valid).toBe(true);
    expect(mapResult.rejectionReasons).not.toContain(ChartRejectionReason.NoMapGeometryAvailable);
  });

  test('map rejected when time dimension has multiple values', () => {
    const dims = [makeGeoDim('region', 10), makeTimeDim(5), makeContentDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims, { mapAvailable: true });
    const mapResult = results.find(r => r.type === 'map')!;
    expect(mapResult.valid).toBe(false);
    expect(mapResult.rejectionReasons).toContain(ChartRejectionReason.TimeDimensionSizeInvalid);
  });

  test('map rejected when no time dimension exists', () => {
    const dims = [makeGeoDim('region', 10), makeContentDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims, { mapAvailable: true });
    const mapResult = results.find(r => r.type === 'map')!;
    expect(mapResult.valid).toBe(false);
    expect(mapResult.rejectionReasons).toContain(ChartRejectionReason.TimeDimensionSizeInvalid);
  });

  test('map rejected with two multiselect dimensions', () => {
    const dims = [makeGeoDim('region', 10), makeOrdinalDim('age', 5), makeTimeDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims, { mapAvailable: true });
    const mapResult = results.find(r => r.type === 'map')!;
    expect(mapResult.valid).toBe(false);
    expect(mapResult.rejectionReasons).toContain(ChartRejectionReason.MapRequiresExactlyOneGeoMultiselect);
  });

  test('map rejected when single multiselect is not geo', () => {
    const dims = [makeOrdinalDim('region', 10), makeTimeDim(1), makeContentDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims, { mapAvailable: true });
    const mapResult = results.find(r => r.type === 'map')!;
    expect(mapResult.valid).toBe(false);
  });

  test('selectDefaultChartType picks map for single geo multiselect when available', () => {
    const dims = [makeGeoDim('region', 50), makeTimeDim(1), makeContentDim(1)];
    const result = selectDefaultChartType(dataWithActual, dims, { mapAvailable: true });
    expect(result).toBe('map');
  });

  test('selectDefaultChartType picks non-map when mapAvailable is false', () => {
    const dims = [makeGeoDim('region', 50), makeTimeDim(1), makeContentDim(1)];
    const result = selectDefaultChartType(dataWithActual, dims, { mapAvailable: false });
    expect(result).not.toBe('map');
  });

  test('map not selected over line for geo + time data', () => {
    const dims = [makeGeoDim('region', 10), makeTimeDim(5)];
    const result = selectDefaultChartType(dataWithActual, dims, { mapAvailable: true });
    expect(result).not.toBe('map');
  });

  test('horizontalBar wins over map when both are valid', () => {
    const dims = [makeGeoDim('region', 10), makeTimeDim(1), makeContentDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims, { mapAvailable: true });
    const validity = Object.fromEntries(results.map(r => [r.type, r.valid])) as Record<string, boolean>;
    expect(validity.horizontalBar).toBe(true);
    expect(validity.map).toBe(true);
    const result = selectDefaultChartType(dataWithActual, dims, { mapAvailable: true });
    expect(result).toBe('horizontalBar');
  });

  test('map still rejected structurally when no geo dimension and mapAvailable not provided', () => {
    const dims = [makeOrdinalDim('region', 10), makeTimeDim(1), makeContentDim(1)];
    const results = getApplicableChartTypes(dataWithActual, dims);
    const mapResult = results.find(r => r.type === 'map')!;
    expect(mapResult.valid).toBe(false);
    expect(mapResult.rejectionReasons).toContain(ChartRejectionReason.NoGeoDimension);
  });
});

describe('convenience functions', () => {
  const minimalDataset: JsonStatDataset = {
    version: '2.0',
    class: 'dataset',
    id: ['region', 'time', 'content'],
    size: [3, 1, 1],
    value: [100, 200, 300],
    dimension: {
      region: {
        label: 'Region',
        category: {
          index: { '01': 0, '02': 1, '03': 2 },
          label: { '01': 'Area 1', '02': 'Area 2', '03': 'Area 3' },
        },
      },
      time: {
        label: 'Year',
        category: {
          index: { '2024': 0 },
          label: { '2024': '2024' },
        },
      },
      content: {
        label: 'Metric',
        category: {
          index: { 'val': 0 },
          label: { 'val': 'Value' },
        },
      },
    },
    role: { time: ['time'], metric: ['content'] },
  };

  test('getChartTypesForDataset returns results for all chart types', () => {
    const results = getChartTypesForDataset(minimalDataset);
    expect(results.length).toBeGreaterThan(0);
    const types = results.map(r => r.type);
    expect(types).toContain('line');
    expect(types).toContain('verticalBar');
    expect(types).toContain('table');
    expect(types).toContain('map');
  });

  test('getChartTypesForDataset matches low-level function results', () => {
    const results = getChartTypesForDataset(minimalDataset);
    // horizontalBar is valid: 1 non-ordinal multiselect, time size 1, no second multiselect
    const hbar = results.find(r => r.type === 'horizontalBar')!;
    expect(hbar.valid).toBe(true);
    const table = results.find(r => r.type === 'table')!;
    expect(table.valid).toBe(true);
  });

  test('getChartTypesForDataset returns all invalid for bad dataset', () => {
    const badDataset = { version: '2.0' } as any;
    const results = getChartTypesForDataset(badDataset);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => !r.valid)).toBe(true);
    expect(results[0].rejectionReasons[0]).toBe(ChartRejectionReason.InvalidDataset);
  });

  test('getChartTypesForDataset map structural-only without mapAvailable', () => {
    const geoDataset: JsonStatDataset = {
      ...minimalDataset,
      dimension: {
        ...minimalDataset.dimension,
        region: {
          ...minimalDataset.dimension.region,
        },
      },
      role: { ...minimalDataset.role, geo: ['region'] },
    };
    const results = getChartTypesForDataset(geoDataset);
    const mapResult = results.find(r => r.type === 'map')!;
    expect(mapResult.valid).toBe(true);
    expect(mapResult.rejectionReasons).not.toContain(ChartRejectionReason.NoMapGeometryAvailable);
  });

  test('getChartTypesForDataset with mapAvailable false rejects map', () => {
    const geoDataset: JsonStatDataset = {
      ...minimalDataset,
      role: { ...minimalDataset.role, geo: ['region'] },
    };
    const results = getChartTypesForDataset(geoDataset, { mapAvailable: false });
    const mapResult = results.find(r => r.type === 'map')!;
    expect(mapResult.valid).toBe(false);
    expect(mapResult.rejectionReasons).toContain(ChartRejectionReason.NoMapGeometryAvailable);
  });

  // 50-region geo dataset: bar charts reject size > 30, so map wins over table when mapAvailable is true
  const largeGeoDataset: JsonStatDataset = (() => {
    const codes = Array.from({ length: 50 }, (_, i) => `R${String(i + 1).padStart(2, '0')}`);
    return {
      version: '2.0' as const,
      class: 'dataset' as const,
      id: ['region', 'time', 'content'],
      size: [50, 1, 1],
      value: codes.map((_, i) => (i + 1) * 100),
      dimension: {
        region: {
          label: 'Region',
          category: {
            index: Object.fromEntries(codes.map((c, i) => [c, i])),
            label: Object.fromEntries(codes.map((c, i) => [c, `Region ${i + 1}`])),
          },
        },
        time: {
          label: 'Year',
          category: { index: { '2024': 0 }, label: { '2024': '2024' } },
        },
        content: {
          label: 'Metric',
          category: { index: { val: 0 }, label: { val: 'Value' } },
        },
      },
      role: { time: ['time'], metric: ['content'], geo: ['region'] },
    };
  })();

  test('selectChartTypeForDataset picks map for geo dataset when mapAvailable is true', () => {
    // 50 regions exceeds the bar chart size limit (max 30), so map wins over table
    const result = selectChartTypeForDataset(largeGeoDataset, { mapAvailable: true });
    expect(result).toBe('map');
  });

  test('selectChartTypeForDataset picks non-map for geo dataset when mapAvailable is false', () => {
    // 50 regions exceeds the bar chart size limit (max 30), so table wins over bar charts when map unavailable
    const result = selectChartTypeForDataset(largeGeoDataset, { mapAvailable: false });
    expect(result).not.toBe('map');
  });

  test('selectChartTypeForDataset picks map for geo dataset when mapAvailable omitted (structural-only)', () => {
    // With mapAvailable omitted, map is structurally valid; 50 regions rules out bar charts so map wins
    const result = selectChartTypeForDataset(largeGeoDataset);
    expect(result).toBe('map');
  });

  test('selectChartTypeForDataset returns a valid chart type', () => {
    const result = selectChartTypeForDataset(minimalDataset);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('selectChartTypeForDataset returns table for invalid dataset', () => {
    const result = selectChartTypeForDataset({ version: '2.0' } as any);
    expect(result).toBe('table');
  });
});
