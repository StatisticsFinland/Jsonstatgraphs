import {
  detectGeoPrefix,
  classifyQuantile,
  classifyNiceInterval,
  classifyJenks,
  classifyJenksNice,
  computeGVF,
  matchFeatures,
  transformMapData,
} from '../../src/data/map-transform';
import type {
  JsonStatDataset,
  MapConfig,
  MapClassBreak,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  ResolvedTheme,
} from '../../src/types';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const MOCK_COLORS = ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'];

const mockTheme: ResolvedTheme = {
  fontFamily: 'sans-serif',
  fontSizeTick: '12px',
  fontSizeLabel: '14px',
  fontSizeTitle: '18px',
  letterSpacing: '0',
  fontWeightNormal: 400,
  fontWeightBold: 700,
  colorBackground: '#ffffff',
  colorSurface: '#f5f5f5',
  colorText: '#333333',
  colorTextSecondary: '#666666',
  colorBorder: '#cccccc',
  colorTick: '#999999',
  colorError: '#ff0000',
  colorFocusRing: '#0066cc',
  colorLink: '#0066cc',
  borderRadius: '4px',
  gridOpacity: 0.3,
  tooltipPadding: '8px',
  tooltipBoxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  burgerMenuBackground: '#ffffff',
  burgerMenuBorderColor: '#bdbdbd',
  burgerMenuBorderRadius: '18px',
  burgerMenuShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
  burgerMenuItemHoverBackground: '#f5f5f5',
  burgerMenuItemActiveBackground: '#eef5ff',
  burgerMenuItemSeparatorColor: '#e3e3e3',
  seriesColors: ['#1f77b4'],
  mapColors: MOCK_COLORS,
};

/** Minimal synthetic dataset: 3 MK regions × 1 metric */
const testDataset: JsonStatDataset = {
  version: '2.0',
  class: 'dataset',
  id: ['region', 'tiedot'],
  size: [3, 1],
  dimension: {
    region: {
      label: 'Region',
      category: {
        index: { 'MK01': 0, 'MK02': 1, 'MK04': 2 },
        label: { 'MK01': 'Uusimaa', 'MK02': 'Southwest Finland', 'MK04': 'Satakunta' },
      },
    },
    tiedot: {
      label: 'Data',
      category: {
        index: { 'val': 0 },
        label: { 'val': 'Count' },
        unit: { 'val': { label: 'Number', decimals: 0 } },
      },
    },
  },
  value: [100, 50, 75],
  role: { geo: ['region'], metric: ['tiedot'] },
};

const testGeoJson: GeoJsonFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
      properties: { maakunta: '01', nimi: 'Uusimaa' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]] },
      properties: { maakunta: '02', nimi: 'Varsinais-Suomi' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[2, 0], [3, 0], [3, 1], [2, 1], [2, 0]]] },
      properties: { maakunta: '04', nimi: 'Satakunta' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[3, 0], [4, 0], [4, 1], [3, 1], [3, 0]]] },
      properties: { maakunta: '05', nimi: 'Kanta-Häme' },
    },
  ],
};

// ---------------------------------------------------------------------------
// detectGeoPrefix
// ---------------------------------------------------------------------------

describe('detectGeoPrefix', () => {
  it('detects KU prefix → kunta', () => {
    expect(detectGeoPrefix(['KU001', 'KU002'])).toEqual({ prefix: 'KU', propertyName: 'kunta' });
  });

  it('detects MK prefix → maakunta', () => {
    expect(detectGeoPrefix(['MK01', 'MK02'])).toEqual({ prefix: 'MK', propertyName: 'maakunta' });
  });

  it('detects HVA prefix → hyvinvointialue (3-letter prefix wins over HA 2-letter)', () => {
    expect(detectGeoPrefix(['HVA01', 'HVA02'])).toEqual({
      prefix: 'HVA',
      propertyName: 'hyvinvointialue',
    });
  });

  it('detects SK prefix → seutukunta', () => {
    expect(detectGeoPrefix(['SK011', 'SK012'])).toEqual({ prefix: 'SK', propertyName: 'seutukunta' });
  });

  it('detects SA prefix → suuralue', () => {
    expect(detectGeoPrefix(['SA1', 'SA2'])).toEqual({ prefix: 'SA', propertyName: 'suuralue' });
  });

  it('detects EL prefix → ely', () => {
    expect(detectGeoPrefix(['EL01'])).toEqual({ prefix: 'EL', propertyName: 'ely' });
  });

  it('returns null for unknown prefix', () => {
    expect(detectGeoPrefix(['XX01', 'XX02'])).toBeNull();
  });

  it('returns null for codes that look like prefix but have no digit after', () => {
    // "MKAB" → MK followed by non-digit → not matched
    expect(detectGeoPrefix(['MKAB'])).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(detectGeoPrefix([])).toBeNull();
  });

  it('returns null for codes with no prefix (pure numeric)', () => {
    expect(detectGeoPrefix(['01', '02'])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// classifyQuantile
// ---------------------------------------------------------------------------

describe('classifyQuantile', () => {
  it('returns empty array for empty values', () => {
    expect(classifyQuantile([], 5, MOCK_COLORS)).toEqual([]);
  });

  it('produces 5 breaks for 10 distinct values with classCount=5', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const breaks = classifyQuantile(values, 5, MOCK_COLORS);

    expect(breaks).toHaveLength(5);

    // Each break has the 5 required colors
    expect(breaks[0].color).toBe(MOCK_COLORS[0]);
    expect(breaks[4].color).toBe(MOCK_COLORS[4]);

    // Values should be sorted into equal-count groups
    expect(breaks[0].min).toBe(1);
    expect(breaks[4].max).toBe(10);
  });

  it('each break for 10 values/5 classes spans exactly 2 values', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const breaks = classifyQuantile(values, 5, MOCK_COLORS);

    // Class boundaries: [1,3), [3,5), [5,7), [7,9), [9,10]
    expect(breaks[0]).toMatchObject({ min: 1, max: 3 });
    expect(breaks[1]).toMatchObject({ min: 3, max: 5 });
    expect(breaks[2]).toMatchObject({ min: 5, max: 7 });
    expect(breaks[3]).toMatchObject({ min: 7, max: 9 });
    expect(breaks[4]).toMatchObject({ min: 9, max: 10 });
  });

  it('single value produces 1 class', () => {
    const breaks = classifyQuantile([42], 5, MOCK_COLORS);
    expect(breaks).toHaveLength(1);
    expect(breaks[0]).toMatchObject({ min: 42, max: 42 });
    expect(breaks[0].color).toBe(MOCK_COLORS[0]);
  });

  it('all identical values produce 1 class', () => {
    const breaks = classifyQuantile([7, 7, 7, 7, 7], 5, MOCK_COLORS);
    expect(breaks).toHaveLength(1);
    expect(breaks[0]).toMatchObject({ min: 7, max: 7 });
  });

  it('fewer unique values than classes → classes = unique count', () => {
    const breaks = classifyQuantile([1, 2, 3], 5, MOCK_COLORS);
    expect(breaks).toHaveLength(3);
    expect(breaks[0].min).toBe(1);
    expect(breaks[1].min).toBe(2);
    expect(breaks[2].min).toBe(3);
  });

  it('class count of 1 produces a single break', () => {
    const breaks = classifyQuantile([10, 20, 30], 1, MOCK_COLORS);
    expect(breaks).toHaveLength(1);
    expect(breaks[0]).toMatchObject({ min: 10, max: 30 });
  });

  it('uses colors[i] directly when colors.length >= classCount', () => {
    const colors = ['red', 'green', 'blue'];
    const breaks = classifyQuantile([1, 2, 3], 3, colors);
    expect(breaks[0].color).toBe('red');
    expect(breaks[1].color).toBe('green');
    expect(breaks[2].color).toBe('blue');
  });

  it('interpolates colors when colors.length < classCount', () => {
    const colors = ['#start', '#end'];
    const breaks = classifyQuantile([1, 2, 3, 4, 5], 5, colors);
    expect(breaks).toHaveLength(5);
    // First class uses first color, last class uses last color
    expect(breaks[0].color).toBe('#start');
    expect(breaks[4].color).toBe('#end');
  });

  it('last break max equals the maximum value', () => {
    const values = [5, 3, 8, 1, 9];
    const breaks = classifyQuantile(values, 3, MOCK_COLORS);
    expect(breaks.at(-1)!.max).toBe(9);
  });

  it('assigns colors from a single-color array', () => {
    const breaks = classifyQuantile([1, 2, 3], 3, ['#only']);
    breaks.forEach((b) => expect(b.color).toBe('#only'));
  });

  it('deduplicates duplicate thresholds: [1,1,1,2,3] with 3 classes → non-degenerate breaks', () => {
    // quantile cut points land inside repeated 1s → without dedup produces unreachable [1,1) class
    const breaks = classifyQuantile([1, 1, 1, 2, 3], 3, MOCK_COLORS);
    // Each break must be reachable: min < max OR min === max (single-value class) at the last class
    for (let i = 0; i < breaks.length - 1; i++) {
      expect(breaks[i].min).toBeLessThan(breaks[i].max);
    }
    // At least 2 breaks (could be 2 or 3 depending on dedup)
    expect(breaks.length).toBeGreaterThanOrEqual(2);
    // First break must start at 1, last break must end at 3
    expect(breaks[0].min).toBe(1);
    expect(breaks.at(-1)!.max).toBe(3);
  });

  it('deduplicates duplicate thresholds: [1,1,2,2,3,3] with 3 classes → each class reachable', () => {
    const breaks = classifyQuantile([1, 1, 2, 2, 3, 3], 3, MOCK_COLORS);
    expect(breaks).toHaveLength(3);
    // Each class must be reachable (non-zero width or last class)
    for (let i = 0; i < breaks.length - 1; i++) {
      expect(breaks[i].min).toBeLessThan(breaks[i].max);
    }
    expect(breaks[0].min).toBe(1);
    expect(breaks.at(-1)!.max).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// classifyNiceInterval
// ---------------------------------------------------------------------------

describe('classifyNiceInterval', () => {
  const colors = ['#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'];

  it('produces nice round boundaries for typical data', () => {
    const values = [12, 25, 37, 48, 55, 63, 78, 89, 95];
    const breaks = classifyNiceInterval(values, 5, colors);
    // All break boundaries should be round numbers
    for (const brk of breaks) {
      expect(brk.min % 1).toBe(0);
      expect(brk.max % 1).toBe(0);
    }
    // First break min should be <= dataMin, last break max should be >= dataMax
    expect(breaks[0].min).toBeLessThanOrEqual(12);
    expect(breaks.at(-1)!.max).toBeGreaterThanOrEqual(95);
  });

  it('returns single class when all values are equal', () => {
    const breaks = classifyNiceInterval([42, 42, 42], 5, colors);
    expect(breaks).toHaveLength(1);
    expect(breaks[0].min).toBe(42);
    expect(breaks[0].max).toBe(42);
  });

  it('returns empty array for empty input', () => {
    expect(classifyNiceInterval([], 5, colors)).toHaveLength(0);
  });

  it('returns empty array for classCount 0', () => {
    expect(classifyNiceInterval([1, 2, 3], 0, colors)).toHaveLength(0);
  });

  it('assigns colors from the palette', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const breaks = classifyNiceInterval(values, 5, colors);
    for (const brk of breaks) {
      expect(brk.color).toBeTruthy();
      expect(brk.color).not.toBe('');
    }
  });

  it('covers the full data range', () => {
    const values = [3, 17, 42, 88, 156, 234, 567, 890];
    const breaks = classifyNiceInterval(values, 4, colors);
    // The union of all breaks should cover all data values
    for (const v of values) {
      const covered = breaks.some(b => v >= b.min && v <= b.max);
      expect(covered).toBe(true);
    }
  });

  it('handles negative-only ranges', () => {
    const values = [-100, -80, -50, -30, -10];
    const breaks = classifyNiceInterval(values, 4, colors);
    expect(breaks.length).toBeGreaterThan(0);
    expect(breaks.length).toBeLessThanOrEqual(4);
    expect(breaks[0].min).toBeLessThanOrEqual(-100);
    expect(breaks.at(-1)!.max).toBeGreaterThanOrEqual(-10);
  });

  it('handles zero-crossing range', () => {
    const values = [-50, -20, 0, 30, 80];
    const breaks = classifyNiceInterval(values, 5, colors);
    expect(breaks.length).toBeGreaterThan(0);
    expect(breaks.length).toBeLessThanOrEqual(5);
    expect(breaks[0].min).toBeLessThanOrEqual(-50);
    expect(breaks.at(-1)!.max).toBeGreaterThanOrEqual(80);
  });

  it('handles very small decimal ranges', () => {
    const values = [0.001, 0.003, 0.005, 0.007, 0.009];
    const breaks = classifyNiceInterval(values, 3, colors);
    expect(breaks.length).toBeGreaterThan(0);
    expect(breaks.length).toBeLessThanOrEqual(3);
    for (const v of values) {
      const covered = breaks.some(b => v >= b.min && v <= b.max);
      expect(covered).toBe(true);
    }
  });

  it('classCount of 1 produces exactly 1 class', () => {
    const values = [10, 50, 100];
    const breaks = classifyNiceInterval(values, 1, colors);
    expect(breaks).toHaveLength(1);
    expect(breaks[0].min).toBeLessThanOrEqual(10);
    expect(breaks[0].max).toBeGreaterThanOrEqual(100);
  });

  it('does not exceed requested classCount', () => {
    const values = [3, 17, 42, 88, 156, 234, 567, 890];
    for (let count = 1; count <= 7; count++) {
      const breaks = classifyNiceInterval(values, count, colors);
      expect(breaks.length).toBeLessThanOrEqual(count);
    }
  });
});

// ---------------------------------------------------------------------------
// matchFeatures
// ---------------------------------------------------------------------------

describe('matchFeatures', () => {
  const noDataColor = '#e0e0e0';
  const geoCodes = ['MK01', 'MK02', 'MK04'];
  const geoLabels: Record<string, string> = {
    'MK01': 'Uusimaa',
    'MK02': 'Southwest Finland',
    'MK04': 'Satakunta',
  };
  const values = new Map<string, number | null>([
    ['MK01', 100],
    ['MK02', 50],
    ['MK04', 75],
  ]);
  const geoCodeMapper = (code: string) => code.replace(/^MK/, '');
  const breaks: MapClassBreak[] = [
    { min: 50, max: 75, color: '#aaa' },
    { min: 75, max: 100, color: '#bbb' },
  ];

  it('all features with matching data get assigned class indices and colors', () => {
    const features = testGeoJson.features.slice(0, 3); // '01', '02', '04'
    const regions = matchFeatures({
      geoCodes, geoLabels, values, features, geoIdProperty: 'maakunta', geoCodeMapper, breaks, noDataColor,
    });

    expect(regions).toHaveLength(3);
    expect(regions.every((r) => r.classIndex >= 0)).toBe(true);
    expect(regions.every((r) => r.color !== noDataColor)).toBe(true);
  });

  it('matched regions have correct labels and codes', () => {
    const features = testGeoJson.features.slice(0, 3);
    const regions = matchFeatures({
      geoCodes, geoLabels, values, features, geoIdProperty: 'maakunta', geoCodeMapper, breaks, noDataColor,
    });

    const mk01 = regions.find((r) => r.code === 'MK01')!;
    expect(mk01.label).toBe('Uusimaa');
    expect(mk01.value).toBe(100);
  });

  it('unmatched features get classIndex=-1 and noDataColor', () => {
    const features = testGeoJson.features; // includes '05' which has no dataset code
    const regions = matchFeatures({
      geoCodes, geoLabels, values, features, geoIdProperty: 'maakunta', geoCodeMapper, breaks, noDataColor,
    });

    expect(regions).toHaveLength(4);
    const unmatched = regions.find((r) => r.classIndex === -1)!;
    expect(unmatched).toBeDefined();
    expect(unmatched.color).toBe(noDataColor);
    expect(unmatched.value).toBeNull();
    expect(unmatched.code).toBe('05');
  });

  it('null data values are treated as no data', () => {
    const valuesWithNull = new Map<string, number | null>([
      ['MK01', 100],
      ['MK02', null], // null value
      ['MK04', 75],
    ]);
    const features = testGeoJson.features.slice(0, 3);
    const regions = matchFeatures({
      geoCodes, geoLabels, values: valuesWithNull, features, geoIdProperty: 'maakunta', geoCodeMapper, breaks, noDataColor,
    });

    const mk02 = regions.find((r) => r.code === 'MK02')!;
    expect(mk02.classIndex).toBe(-1);
    expect(mk02.color).toBe(noDataColor);
    expect(mk02.value).toBeNull();
  });

  it('returns empty array for empty features', () => {
    const regions = matchFeatures({
      geoCodes, geoLabels, values, features: [], geoIdProperty: 'maakunta', geoCodeMapper, breaks, noDataColor,
    });
    expect(regions).toEqual([]);
  });

  it('features with null properties get classIndex=-1', () => {
    const featureWithNullProps: GeoJsonFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: null,
    };
    const regions = matchFeatures({
      geoCodes, geoLabels, values, features: [featureWithNullProps], geoIdProperty: 'maakunta', geoCodeMapper, breaks, noDataColor,
    });
    expect(regions[0].classIndex).toBe(-1);
    expect(regions[0].color).toBe(noDataColor);
  });
});

// ---------------------------------------------------------------------------
// transformMapData — unit tests
// ---------------------------------------------------------------------------

describe('transformMapData', () => {
  const mapConfig: MapConfig = {};

  it('returns regions for all GeoJSON features', () => {
    const result = transformMapData(testDataset, testGeoJson, mapConfig, mockTheme);
    // testGeoJson has 4 features, including one unmatched ('05')
    expect(result.regions).toHaveLength(4);
  });

  it('auto-detects MK prefix and maps to maakunta property', () => {
    const result = transformMapData(testDataset, testGeoJson, mapConfig, mockTheme);
    // '05' feature (Kanta-Häme) has no corresponding dataset code
    const noData = result.regions.find((r) => r.classIndex === -1)!;
    expect(noData).toBeDefined();
    expect(noData.code).toBe('05');
  });

  it('matched regions have non-negative classIndex', () => {
    const result = transformMapData(testDataset, testGeoJson, mapConfig, mockTheme);
    const matched = result.regions.filter((r) => r.classIndex >= 0);
    expect(matched).toHaveLength(3);
  });

  it('hasNoData is true when there are unmatched features', () => {
    const result = transformMapData(testDataset, testGeoJson, mapConfig, mockTheme);
    expect(result.hasNoData).toBe(true);
  });

  it('hasNoData is false when all features are matched', () => {
    const allMatchedGeoJson: GeoJsonFeatureCollection = {
      type: 'FeatureCollection',
      features: testGeoJson.features.slice(0, 3), // only '01', '02', '04'
    };
    const result = transformMapData(testDataset, allMatchedGeoJson, {}, mockTheme);
    expect(result.hasNoData).toBe(false);
  });

  it('extracts geoDimensionLabel from dimension label', () => {
    const result = transformMapData(testDataset, testGeoJson, mapConfig, mockTheme);
    expect(result.geoDimensionLabel).toBe('Region');
  });

  it('extracts valueDimensionLabel from first metric code label', () => {
    const result = transformMapData(testDataset, testGeoJson, mapConfig, mockTheme);
    expect(result.valueDimensionLabel).toBe('Count');
  });

  it('extracts unit and decimals from metric dimension', () => {
    const result = transformMapData(testDataset, testGeoJson, mapConfig, mockTheme);
    expect(result.unit).toBe('Number');
    expect(result.decimals).toBe(0);
  });

  it('noDataColor is set on result', () => {
    const result = transformMapData(testDataset, testGeoJson, mapConfig, mockTheme);
    expect(result.noDataColor).toBe('#e0e0e0');
  });

  it('classification produces non-empty breaks with default method', () => {
    const result = transformMapData(testDataset, testGeoJson, mapConfig, mockTheme);
    expect(result.classification.method).toBe('jenks-nice');
    if (result.classification.method !== 'linear') {
      expect(result.classification.breaks.length).toBeGreaterThan(0);
      for (let i = 0; i < result.classification.breaks.length - 1; i++) {
        expect(result.classification.breaks[i].min).toBeLessThanOrEqual(result.classification.breaks[i].max);
      }
    }
  });

  it('throws when dataset has no geo role', () => {
    const noGeoDataset: JsonStatDataset = { ...testDataset, role: {} };
    expect(() => transformMapData(noGeoDataset, testGeoJson, mapConfig, mockTheme)).toThrow(
      /geo role dimension/,
    );
  });

  it('allows user override of geoIdProperty', () => {
    // Use a GeoJSON with a different property name
    const geoJsonAltProp: GeoJsonFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { regionCode: '01' },
        },
      ],
    };
    const configWithOverride: MapConfig = {
      geoIdProperty: 'regionCode',
    };
    const result = transformMapData(testDataset, geoJsonAltProp, configWithOverride, mockTheme);
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].code).toBe('MK01');
    expect(result.regions[0].value).toBe(100);
  });

  it('allows user override of geoCodeMapper', () => {
    // GeoJSON with "MK01"-style codes (no stripping needed) matched via identity mapper
    const geoJsonFullCodes: GeoJsonFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { id: 'MK01' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [1, 0] },
          properties: { id: 'MK02' },
        },
      ],
    };
    const configWithMapper: MapConfig = {
      geoIdProperty: 'id',
      geoCodeMapper: (code) => code, // identity — no prefix stripping
    };
    const result = transformMapData(testDataset, geoJsonFullCodes, configWithMapper, mockTheme);
    expect(result.regions).toHaveLength(2);
    expect(result.regions[0].value).toBe(100);
    expect(result.regions[1].value).toBe(50);
  });

  it('handles single-dimension dataset (geo only)', () => {
    const geoDsOnly: JsonStatDataset = {
      id: ['region'],
      size: [3],
      dimension: {
        region: {
          label: 'Region',
          category: {
            index: { 'MK01': 0, 'MK02': 1, 'MK04': 2 },
            label: { 'MK01': 'Uusimaa', 'MK02': 'Southwest Finland', 'MK04': 'Satakunta' },
          },
        },
      },
      value: [10, 20, 30],
      role: { geo: ['region'] },
    };
    const geoOnlyGeoJson: GeoJsonFeatureCollection = {
      type: 'FeatureCollection',
      features: testGeoJson.features.slice(0, 3),
    };
    const result = transformMapData(geoDsOnly, geoOnlyGeoJson, {}, mockTheme);
    expect(result.regions).toHaveLength(3);
    expect(result.regions.every((r) => r.classIndex >= 0)).toBe(true);
  });

  it('handles dataset with KU codes and auto-detects kunta property', () => {
    const kuDataset: JsonStatDataset = {
      id: ['kunta'],
      size: [3],
      dimension: {
        kunta: {
          label: 'Municipality',
          category: {
            index: { 'KU049': 0, 'KU091': 1, 'KU837': 2 },
            label: { 'KU049': 'Espoo', 'KU091': 'Helsinki', 'KU837': 'Tampere' },
          },
        },
      },
      value: [300, 600, 200],
      role: { geo: ['kunta'] },
    };
    const kuGeoJson: GeoJsonFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { kunta: '049' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [1, 0] },
          properties: { kunta: '091' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [2, 0] },
          properties: { kunta: '837' },
        },
      ],
    };
    const result = transformMapData(kuDataset, kuGeoJson, {}, mockTheme);
    expect(result.regions).toHaveLength(3);
    expect(result.hasNoData).toBe(false);
    expect(result.geoDimensionLabel).toBe('Municipality');
  });
});

// ---------------------------------------------------------------------------
// transformMapData — integration test with real maakunta fixture
// ---------------------------------------------------------------------------

describe('transformMapData — integration with maakunta fixture', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fixture = require('../../stories/fixtures/map-maakunta-establishments.json') as JsonStatDataset;

  // Minimal GeoJSON covering MK01, MK02, MK04, and one unmatched region
  const minimalGeoJson: GeoJsonFeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
        properties: { maakunta: '01', nimi: 'Uusimaa' },
      },
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]] },
        properties: { maakunta: '02', nimi: 'Varsinais-Suomi' },
      },
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[2, 0], [3, 0], [3, 1], [2, 1], [2, 0]]] },
        properties: { maakunta: '04', nimi: 'Satakunta' },
      },
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[3, 0], [4, 0], [4, 1], [3, 1], [3, 0]]] },
        properties: { maakunta: '99', nimi: 'Nonexistent' },
      },
    ],
  };

  it('processes real maakunta fixture without errors', () => {
    expect(() =>
      transformMapData(fixture, minimalGeoJson, {}, mockTheme),
    ).not.toThrow();
  });

  it('returns 4 regions (matching the GeoJSON features)', () => {
    const result = transformMapData(fixture, minimalGeoJson, {}, mockTheme);
    expect(result.regions).toHaveLength(4);
  });

  it('recognises geo dimension and extracts its label', () => {
    const result = transformMapData(fixture, minimalGeoJson, {}, mockTheme);
    expect(result.geoDimensionLabel).toBe('Region');
  });

  it('extracts metric label and unit from tiedot dimension', () => {
    const result = transformMapData(fixture, minimalGeoJson, {}, mockTheme);
    // First metric code is Tplukumaara3 = "General government establishments (number)"
    expect(result.valueDimensionLabel).toContain('establishments');
    expect(result.unit).toBe('Number');
    expect(result.decimals).toBe(0);
  });

  it('matched regions have positive numeric values', () => {
    const result = transformMapData(fixture, minimalGeoJson, {}, mockTheme);
    const matched = result.regions.filter((r) => r.classIndex >= 0);
    expect(matched.length).toBeGreaterThan(0);
    matched.forEach((r) => expect(typeof r.value).toBe('number'));
  });

  it('unmatched region (maakunta 99) gets classIndex=-1', () => {
    const result = transformMapData(fixture, minimalGeoJson, {}, mockTheme);
    const unmatched = result.regions.find((r) => r.code === '99')!;
    expect(unmatched).toBeDefined();
    expect(unmatched.classIndex).toBe(-1);
  });

  it('auto-detects MK prefix and maps to maakunta GeoJSON property', () => {
    // Without specifying geoIdProperty, it should auto-detect 'maakunta'
    const result = transformMapData(fixture, minimalGeoJson, {}, mockTheme);
    // MK01 → strips 'MK' → '01' → matches feature with maakunta='01'
    const mk01 = result.regions.find((r) => r.code === 'MK01');
    expect(mk01).toBeDefined();
    expect(mk01?.value).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeGVF
// ---------------------------------------------------------------------------

describe('computeGVF', () => {
  it('returns 1 for empty values', () => {
    expect(computeGVF([], [])).toBe(1);
  });

  it('returns 1 for perfect classification (each value in its own class)', () => {
    const values = [1, 2, 3];
    const breaks: MapClassBreak[] = [
      { min: 1, max: 2, color: 'a' },
      { min: 2, max: 3, color: 'b' },
      { min: 3, max: 3, color: 'c' },
    ];
    expect(computeGVF(values, breaks)).toBe(1);
  });

  it('returns value between 0 and 1 for imperfect classification', () => {
    const values = [1, 2, 3, 10, 11, 12];
    const breaks: MapClassBreak[] = [
      { min: 0, max: 7, color: 'a' },
      { min: 7, max: 13, color: 'b' },
    ];
    const gvf = computeGVF(values, breaks);
    expect(gvf).toBeGreaterThan(0);
    expect(gvf).toBeLessThanOrEqual(1);
  });

  it('returns 1 when all values are identical', () => {
    const values = [5, 5, 5, 5];
    const breaks: MapClassBreak[] = [{ min: 5, max: 5, color: 'a' }];
    expect(computeGVF(values, breaks)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// classifyJenks
// ---------------------------------------------------------------------------

describe('classifyJenks', () => {
  const colors = ['#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'];

  it('returns empty array for empty values', () => {
    expect(classifyJenks([], 5, colors)).toEqual([]);
  });

  it('returns empty array for classCount 0', () => {
    expect(classifyJenks([1, 2, 3], 0, colors)).toEqual([]);
  });

  it('returns single class for all identical values', () => {
    const breaks = classifyJenks([7, 7, 7], 3, colors);
    expect(breaks).toHaveLength(1);
    expect(breaks[0].min).toBe(7);
    expect(breaks[0].max).toBe(7);
  });

  it('produces contiguous breaks (each max === next min)', () => {
    const values = [1, 2, 3, 10, 11, 12, 100, 110, 120];
    const breaks = classifyJenks(values, 3, colors);
    expect(breaks.length).toBeGreaterThan(1);
    for (let i = 0; i < breaks.length - 1; i++) {
      expect(breaks[i].max).toBe(breaks[i + 1].min);
    }
  });

  it('covers the full data range', () => {
    const values = [5, 10, 15, 100, 200, 300];
    const breaks = classifyJenks(values, 3, colors);
    expect(breaks[0].min).toBeLessThanOrEqual(5);
    expect(breaks.at(-1)!.max).toBeGreaterThanOrEqual(300);
  });

  it('reduces classCount when fewer unique values exist', () => {
    const breaks = classifyJenks([1, 2], 5, colors);
    expect(breaks.length).toBeLessThanOrEqual(2);
  });

  it('assigns colors from the palette', () => {
    const breaks = classifyJenks([1, 5, 10, 50, 100], 3, colors);
    for (const brk of breaks) {
      expect(brk.color).toBeTruthy();
    }
  });

  it('marks singleton last class as openEnded', () => {
    const values = [1, 2, 3, 10, 11, 12, 567890];
    const breaks = classifyJenks(values, 3, colors);
    const last = breaks.at(-1)!;
    expect(last.openEnded).toBe(true);
  });

  it('does not mark non-singleton last class as openEnded', () => {
    const values = [1, 2, 100, 101, 200, 201];
    const breaks = classifyJenks(values, 3, colors);
    const last = breaks.at(-1)!;
    expect(last.openEnded).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// classifyJenksNice
// ---------------------------------------------------------------------------

describe('classifyJenksNice', () => {
  const colors = ['#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'];

  it('returns empty breaks for empty values', () => {
    const result = classifyJenksNice([], 5, colors);
    expect(result.breaks).toEqual([]);
    expect(result.gvf).toBe(1);
  });

  it('returns empty breaks for classCount 0', () => {
    const result = classifyJenksNice([1, 2, 3], 0, colors);
    expect(result.breaks).toEqual([]);
  });

  it('produces nice-looking break boundaries', () => {
    const values = [12, 25, 37, 48, 55, 63, 78, 89, 95];
    const result = classifyJenksNice(values, 3, colors);
    // Breaks should have round-ish boundaries
    expect(result.breaks.length).toBeGreaterThan(0);
    // First min should be <= dataMin, last max should be >= dataMax
    expect(result.breaks[0].min).toBeLessThanOrEqual(12);
    expect(result.breaks.at(-1)!.max).toBeGreaterThanOrEqual(95);
  });

  it('ensures contiguous breaks', () => {
    const values = [1, 2, 3, 10, 11, 12, 100, 110, 120];
    const result = classifyJenksNice(values, 3, colors);
    for (let i = 0; i < result.breaks.length - 1; i++) {
      expect(result.breaks[i].max).toBe(result.breaks[i + 1].min);
    }
  });

  it('covers all data values', () => {
    const values = [3, 17, 42, 88, 156, 234, 567, 890];
    const result = classifyJenksNice(values, 4, colors);
    for (const v of values) {
      const covered = result.breaks.some(b => v >= b.min && v <= b.max);
      expect(covered).toBe(true);
    }
  });

  it('returns GVF close to optimal', () => {
    const values = [1, 2, 3, 10, 11, 12, 100, 110, 120];
    const rawBreaks = classifyJenks(values, 3, colors);
    const rawGvf = computeGVF(values, rawBreaks);
    const result = classifyJenksNice(values, 3, colors);
    // Nice breaks should retain at least 85% of optimal GVF
    expect(result.gvf).toBeGreaterThan(rawGvf * 0.85);
  });

  it('handles single value', () => {
    const result = classifyJenksNice([42], 5, colors);
    expect(result.breaks).toHaveLength(1);
    expect(result.breaks[0].min).toBe(42);
  });

  it('handles negative values', () => {
    const values = [-100, -50, -20, 0, 30, 80];
    const result = classifyJenksNice(values, 3, colors);
    expect(result.breaks[0].min).toBeLessThanOrEqual(-100);
    expect(result.breaks.at(-1)!.max).toBeGreaterThanOrEqual(80);
  });

  it('produces nice boundary for singleton outlier', () => {
    const values = [1, 2, 3, 10, 11, 12, 567890];
    const result = classifyJenksNice(values, 3, colors);
    const last = result.breaks.at(-1)!;
    expect(last.openEnded).toBe(true);
    // The boundary should be a nice round number below the outlier
    expect(last.min).toBeLessThan(567890);
    expect(last.min).toBeGreaterThan(0);
    // Should be a round number (divisible by a power of 10)
    expect(last.min % 1000).toBe(0);
    // Max should still be >= dataMax for classification correctness
    expect(last.max).toBeGreaterThanOrEqual(567890);
  });

  it('singleton outlier: second-to-last class has nice upper bound', () => {
    const values = [1, 2, 3, 10, 11, 12, 567890];
    const result = classifyJenksNice(values, 3, colors);
    const secondToLast = result.breaks.at(-2)!;
    const last = result.breaks.at(-1)!;
    // Contiguity: second-to-last max === last min
    expect(secondToLast.max).toBe(last.min);
    // The boundary should be a nice round number
    expect(secondToLast.max % 1000).toBe(0);
  });

  it('singleton outlier at zero gets openEnded', () => {
    const values = [-100, -50, -20, -10, 0];
    const result = classifyJenksNice(values, 3, colors);
    const last = result.breaks.at(-1)!;
    if (last.min === last.max) {
      expect(last.openEnded).toBe(true);
    }
  });

  it('singleton outlier with negative value gets openEnded', () => {
    const values = [-1000, -500, -200, -100, -50, -10, -1];
    const result = classifyJenksNice(values, 3, colors);
    const last = result.breaks.at(-1)!;
    // Whether ckmeans creates a singleton depends on the data distribution,
    // but if it does, the flag should be set
    if (last.min === last.max) {
      expect(last.openEnded).toBe(true);
    }
  });

  it('singleton outlier with small decimal gets openEnded', () => {
    const values = [0.001, 0.002, 0.003, 0.01, 0.011, 0.012, 0.5];
    const result = classifyJenksNice(values, 3, colors);
    const last = result.breaks.at(-1)!;
    if (last.min === last.max) {
      expect(last.openEnded).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// transformMapData — classification methods
// ---------------------------------------------------------------------------

describe('transformMapData — classification methods', () => {
  const mapConfig: MapConfig = {};

  it('defaults to jenks-nice classification', () => {
    const result = transformMapData(testDataset, testGeoJson, mapConfig, mockTheme);
    expect(result.classification.method).toBe('jenks-nice');
  });

  it('supports jenks classification', () => {
    const result = transformMapData(testDataset, testGeoJson, { classificationMethod: 'jenks' }, mockTheme);
    expect(result.classification.method).toBe('jenks');
    if (result.classification.method !== 'linear') {
      expect(result.classification.breaks.length).toBeGreaterThan(0);
    }
  });

  it('supports even-ranges classification', () => {
    const result = transformMapData(testDataset, testGeoJson, { classificationMethod: 'even-ranges' }, mockTheme);
    expect(result.classification.method).toBe('even-ranges');
    if (result.classification.method !== 'linear') {
      expect(result.classification.breaks.length).toBeGreaterThan(0);
    }
  });

  it('supports linear classification', () => {
    const result = transformMapData(testDataset, testGeoJson, { classificationMethod: 'linear' }, mockTheme);
    expect(result.classification.method).toBe('linear');
    if (result.classification.method === 'linear') {
      expect(typeof result.classification.scaleMin).toBe('number');
      expect(typeof result.classification.scaleMax).toBe('number');
      expect(result.classification.colors.length).toBeGreaterThan(0);
    }
  });

  it('linear mode assigns colors to all matched regions', () => {
    const result = transformMapData(testDataset, testGeoJson, { classificationMethod: 'linear' }, mockTheme);
    const matched = result.regions.filter(r => r.value !== null);
    for (const region of matched) {
      expect(region.color).toBeTruthy();
      expect(region.color).not.toBe('#e0e0e0'); // not no-data color
    }
  });

  it('linear mode with all-null values produces degenerate scale', () => {
    const allNullDataset: JsonStatDataset = {
      ...testDataset,
      value: [null, null, null],
    };
    const result = transformMapData(allNullDataset as unknown as JsonStatDataset, testGeoJson, { classificationMethod: 'linear' }, mockTheme);
    expect(result.classification.method).toBe('linear');
    if (result.classification.method === 'linear') {
      expect(result.classification.scaleMin).toBe(0);
      expect(result.classification.scaleMax).toBe(0);
    }
  });

  it('jenks-nice includes GVF on classification', () => {
    const result = transformMapData(testDataset, testGeoJson, mapConfig, mockTheme);
    if (result.classification.method !== 'linear') {
      expect(result.classification.gvf).toBeDefined();
      expect(typeof result.classification.gvf).toBe('number');
    }
  });

  it('outlier region is still classified after openEnded boundary adjustment', () => {
    // Create a dataset with a singleton outlier in the last value
    const outlierDataset: JsonStatDataset = {
      ...testDataset,
      value: testDataset.value.map((v, i) => i === 0 ? 567890 : (v ?? 1)),
    } as unknown as JsonStatDataset;
    const result = transformMapData(outlierDataset, testGeoJson, mapConfig, mockTheme);
    if (result.classification.method !== 'linear') {
      // The region with the outlier value should be assigned to a class (not -1)
      const outlierRegion = result.regions.find(r => r.value === 567890);
      if (outlierRegion) {
        expect(outlierRegion.classIndex).toBeGreaterThanOrEqual(0);
        expect(outlierRegion.color).not.toBe('#e0e0e0'); // not no-data color
      }
    }
  });
});
