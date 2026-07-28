import type {
  JsonStatDataset,
  MapConfig,
  MapChartData,
  MapRegionData,
  MapClassBreak,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  ResolvedTheme,
  ClassificationMethod,
  MapClassification,
} from '../types';
import { computeFlatIndex, getOrderedCodes } from './dataset-utils';
import { linearAxisIntervalStepFunction } from '../layout/tick-positions';
import { ckmeans } from 'simple-statistics';
import { scaleLinear } from 'd3-scale';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_PREFIXES: Record<string, string> = {
  'KU': 'kunta',
  'MK': 'maakunta',
  'SK': 'seutukunta',
  'HVA': 'hyvinvointialue',
  'HA': 'hyvinvointialue',
  'SA': 'suuralue',
  'EL': 'ely',
};

const NO_DATA_COLOR = '#e0e0e0';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Resolves a raw dataset value: null or string (missing marker) → null, number → number. */
function resolveValue(v: number | null | string): number | null {
  if (v === null || typeof v === 'string') return null;
  return v;
}

/** Returns the color for class i given the actual class count and available colors. */
function getColor(i: number, actualClassCount: number, colors: string[]): string {
  if (colors.length === 0) return '#cccccc';
  if (colors.length >= actualClassCount) return colors[i];
  if (actualClassCount === 1) return colors[0];
  return colors[Math.round((i * (colors.length - 1)) / (actualClassCount - 1))];
}

/** Finds which class break index a value belongs to (-1 if none). */
function findClassIndex(value: number, breaks: MapClassBreak[]): number {
  for (let i = 0; i < breaks.length; i++) {
    const isLast = i === breaks.length - 1;
    if (isLast) {
      if (value >= breaks[i].min && value <= breaks[i].max) return i;
    } else if (value >= breaks[i].min && value < breaks[i].max) {
      return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

/**
 * Computes Goodness of Variance Fit (GVF) for a set of values and class breaks.
 * GVF = 1 - SDCM / SDAM
 */
export function computeGVF(values: number[], breaks: MapClassBreak[]): number {
  if (values.length === 0 || breaks.length === 0) return 1;

  const classMembership = values.map((v) => findClassIndex(v, breaks));

  const classSums = new Array(breaks.length).fill(0) as number[];
  const classCounts = new Array(breaks.length).fill(0) as number[];
  for (let i = 0; i < values.length; i++) {
    const ci = classMembership[i];
    if (ci >= 0) {
      classSums[ci] += values[i];
      classCounts[ci]++;
    }
  }
  const classMeans = classSums.map((sum, i) => (classCounts[i] > 0 ? sum / classCounts[i] : 0));

  let sdcm = 0;
  for (let i = 0; i < values.length; i++) {
    const ci = classMembership[i];
    if (ci >= 0) {
      const diff = values[i] - classMeans[ci];
      sdcm += diff * diff;
    }
  }

  const overallMean = values.reduce((a, b) => a + b, 0) / values.length;
  let sdam = 0;
  for (const v of values) {
    const diff = v - overallMean;
    sdam += diff * diff;
  }

  return sdam === 0 ? 1 : 1 - sdcm / sdam;
}

function snapToNice(value: number, unit: number): number {
  if (unit <= 0) return value;
  return Math.round(value / unit) * unit;
}

/**
 * Classifies values using the Jenks natural breaks algorithm (ckmeans).
 */
export function classifyJenks(
  values: number[],
  classCount: number,
  colors: string[],
): MapClassBreak[] {
  if (classCount <= 0) return [];
  if (values.length === 0) return [];

  const unique = new Set(values);
  if (unique.size === 1) {
    const only = values[0];
    return [{ min: only, max: only, color: getColor(0, 1, colors) }];
  }

  const actualClassCount = Math.min(classCount, unique.size);
  const sorted = [...values].sort((a, b) => a - b);
  const clusters = ckmeans(sorted, actualClassCount);

  const result: MapClassBreak[] = clusters.map((cluster, i) => ({
    min: cluster[0],
    max: cluster.at(-1)!,
    color: getColor(i, clusters.length, colors),
  }));

  // Ensure contiguous boundaries: each break's max = next break's min
  for (let i = 0; i < result.length - 1; i++) {
    result[i].max = result[i + 1].min;
  }

  // Mark singleton outlier as open-ended
  if (result.length >= 2) {
    const last = result.at(-1)!;
    if (last.min === last.max) {
      last.openEnded = true;
    }
  }

  return result;
}

/** If the last class is a singleton outlier, widen its lower bound to a nice boundary. */
function snapSingletonOutlier(breaks: MapClassBreak[]): void {
  if (breaks.length < 2) return;

  const last = breaks.at(-1)!;
  const secondToLast = breaks.at(-2)!;

  if (last.min !== last.max) return;

  // Derive the rounding unit from the gap between the outlier and the
  // second-to-last class's lower bound — this is always positive when
  // there are at least 2 classes with distinct ranges.
  const gap = last.max - secondToLast.min;
  const unit = gap > 0 ? linearAxisIntervalStepFunction(gap * 0.1) : 0;
  if (unit > 0) {
    const niceBoundary = Math.floor(last.max / unit) * unit;
    if (niceBoundary > secondToLast.min && niceBoundary < last.max) {
      secondToLast.max = niceBoundary;
      last.min = niceBoundary;
    }
  }
  last.openEnded = true;
}

/**
 * Classifies values using Jenks natural breaks, then snaps boundaries to
 * nice round numbers for better readability.
 */
export function classifyJenksNice(
  values: number[],
  classCount: number,
  colors: string[],
): { breaks: MapClassBreak[]; gvf: number } {
  if (classCount <= 0) return { breaks: [], gvf: 1 };
  const rawBreaks = classifyJenks(values, classCount, colors);

  if (rawBreaks.length === 0 || rawBreaks.length <= 1) {
    return { breaks: rawBreaks, gvf: 1 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const dataMin = sorted[0];
  const dataMax = sorted.at(-1)!;

  const snappedBreaks = rawBreaks.map((brk, i): MapClassBreak => {
    const classWidth = brk.max - brk.min;
    const unit = linearAxisIntervalStepFunction(classWidth * 0.15);

    let min: number;
    let max: number;

    if (i === 0) {
      min = unit > 0 ? Math.floor(dataMin / unit) * unit : dataMin;
    } else {
      min = snapToNice(brk.min, unit);
    }

    if (i === rawBreaks.length - 1) {
      max = unit > 0 ? Math.ceil(dataMax / unit) * unit : dataMax;
    } else {
      max = snapToNice(brk.max, unit);
    }

    if (min >= max) {
      min = brk.min;
      max = brk.max;
    }

    return { min, max, color: '' };
  });

  // Ensure continuity: each break[i].max === break[i+1].min
  for (let i = 0; i < snappedBreaks.length - 1; i++) {
    snappedBreaks[i].max = snappedBreaks[i + 1].min;
  }

  // Reassign colors
  for (let i = 0; i < snappedBreaks.length; i++) {
    snappedBreaks[i].color = getColor(i, snappedBreaks.length, colors);
  }

  snapSingletonOutlier(snappedBreaks);

  const gvfSnapped = computeGVF(values, snappedBreaks);
  return { breaks: snappedBreaks, gvf: gvfSnapped };
}

/** Interpolates a color from a color scale using d3-scale (for linear mode). */
function interpolateMapColor(
  value: number,
  scaleMin: number,
  scaleMax: number,
  colors: string[],
): string {
  if (colors.length === 0) return '#cccccc';
  if (colors.length === 1 || scaleMin === scaleMax) return colors[0];
  const scale = scaleLinear<string>()
    .domain(colors.map((_, i) => scaleMin + (i / (colors.length - 1)) * (scaleMax - scaleMin)))
    .range(colors);
  return scale(Math.max(scaleMin, Math.min(scaleMax, value)));
}

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

/**
 * Detects the Statistics Finland geo code prefix from an array of codes.
 * Tries 3-letter prefixes before 2-letter ones.
 * Returns null if no known prefix is detected or the array is empty.
 */
export function detectGeoPrefix(codes: string[]): { prefix: string; propertyName: string } | null {
  if (codes.length === 0) return null;
  const sample = codes[0];
  // Try 3-letter prefixes first (HVA), then 2-letter (KU, MK, etc.)
  for (const len of [3, 2]) {
    const candidate = sample.substring(0, len);
    if (KNOWN_PREFIXES[candidate] && /^\d/.test(sample.substring(len))) {
      return { prefix: candidate, propertyName: KNOWN_PREFIXES[candidate] };
    }
  }
  return null;
}

/**
 * Classifies an array of numeric values into quantile-based class breaks.
 * Each class contains roughly the same number of data points.
 *
 * If fewer unique values exist than classCount, the number of classes is
 * reduced to match the number of unique values.
 * Returns an empty array for empty input.
 */
export function classifyQuantile(
  values: number[],
  classCount: number,
  colors: string[],
): MapClassBreak[] {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const uniqueCount = new Set(sorted).size;
  const actualClassCount = Math.min(classCount, uniqueCount);
  if (actualClassCount === 0) return [];

  const n = sorted.length;
  const rawMins: number[] = [];
  for (let i = 0; i < actualClassCount; i++) {
    const startIdx = Math.floor((i * n) / actualClassCount);
    rawMins.push(sorted[startIdx]);
  }

  // Deduplicate adjacent equal thresholds to avoid zero-width or unreachable classes
  const dedupedMins = [rawMins[0]];
  for (let i = 1; i < rawMins.length; i++) {
    if (rawMins[i] !== dedupedMins.at(-1)) {
      dedupedMins.push(rawMins[i]);
    }
  }
  const dedupedCount = dedupedMins.length;

  return dedupedMins.map((min, i) => ({
    min,
    max: i < dedupedCount - 1 ? dedupedMins[i + 1] : sorted.at(-1)!,
    color: getColor(i, dedupedCount, colors),
  }));
}

/**
 * Classifies values into equal-interval breaks with "nice" round boundaries.
 * Uses the same step-function logic as numeric axis ticks.
 */
export function classifyNiceInterval(
  values: number[],
  classCount: number,
  colors: string[],
): MapClassBreak[] {
  if (values.length === 0 || classCount <= 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const dataMin = sorted[0];
  const dataMax = sorted.at(-1)!;

  if (dataMin === dataMax) {
    // All values are the same — single class
    return [{ min: dataMin, max: dataMax, color: getColor(0, 1, colors) }];
  }

  const range = dataMax - dataMin;
  const rawInterval = range / classCount;
  const niceInterval = linearAxisIntervalStepFunction(rawInterval);

  if (!niceInterval || niceInterval <= 0) {
    return [{ min: dataMin, max: dataMax, color: getColor(0, 1, colors) }];
  }

  // Round min down and max up to the nice interval
  const start = Math.floor(dataMin / niceInterval) * niceInterval;
  const end = Math.ceil(dataMax / niceInterval) * niceInterval;

  // Build breaks
  const breaks: MapClassBreak[] = [];
  let current = start;
  while (current < end) {
    const next = current + niceInterval;
    breaks.push({ min: current, max: next, color: '' }); // color assigned below
    current = next;
  }

  // If snapping produced more breaks than requested, merge excess into the last break
  while (breaks.length > classCount && breaks.length > 1) {
    const removed = breaks.pop()!;
    breaks.at(-1)!.max = removed.max;
  }

  // Assign colors
  for (let i = 0; i < breaks.length; i++) {
    breaks[i].color = getColor(i, breaks.length, colors);
  }

  return breaks;
}

/**
 * Matches GeoJSON features to dataset values, assigning class indices and colors.
 * Features that have no matching data value get classIndex = -1 and noDataColor.
 */
export interface MatchFeaturesOptions {
  geoCodes: string[];
  geoLabels: Record<string, string>;
  values: Map<string, number | null>;
  features: GeoJsonFeature[];
  geoIdProperty: string;
  geoCodeMapper: (code: string) => string;
  breaks: MapClassBreak[];
  noDataColor: string;
  linearScale?: { scaleMin: number; scaleMax: number; colors: string[] };
}

export function matchFeatures(opts: MatchFeaturesOptions): MapRegionData[] {
  const { geoCodes, geoLabels, values, features, geoIdProperty, geoCodeMapper, breaks, noDataColor, linearScale } = opts;
  // Build a reverse map: mapped (bare) code → original dataset code
  const mappedToDataset = new Map<string, string>();
  for (const code of geoCodes) {
    mappedToDataset.set(geoCodeMapper(code), code);
  }

  return features.map((feature): MapRegionData => {
    const featureProp = feature.properties?.[geoIdProperty];
    let propStr: string | null = null;
    if (typeof featureProp === 'string') propStr = featureProp;
    else if (typeof featureProp === 'number') propStr = String(featureProp);

    if (propStr == null || !mappedToDataset.has(propStr)) {
      return {
        feature,
        value: null,
        label: '',
        code: propStr ?? '',
        classIndex: -1,
        color: noDataColor,
      };
    }

    const datasetCode = mappedToDataset.get(propStr)!;
    const value = values.get(datasetCode) ?? null;
    const label = geoLabels[datasetCode] ?? datasetCode;

    if (value === null) {
      return { feature, value: null, label, code: datasetCode, classIndex: -1, color: noDataColor };
    }

    let classIndex: number;
    let color: string;
    if (linearScale) {
      classIndex = 0;
      color = interpolateMapColor(value, linearScale.scaleMin, linearScale.scaleMax, linearScale.colors);
    } else {
      classIndex = findClassIndex(value, breaks);
      color = classIndex >= 0 ? breaks[classIndex].color : noDataColor;
    }

    return { feature, value, label, code: datasetCode, classIndex, color };
  });
}

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

/**
 * Transforms a JSON-stat 2.0 dataset + GeoJSON geometry into MapChartData
 * ready for rendering. Performs auto-detection of Statistics Finland geo
 * code prefixes and configurable value classification (jenks, jenks-nice,
 * even-ranges, or linear).
 *
 * @throws if the dataset has no geo role dimension.
 */
export function transformMapData(
  dataset: JsonStatDataset,
  geometry: GeoJsonFeatureCollection,
  mapConfig: MapConfig,
  theme: ResolvedTheme,
  activeCategoryCodes?: Record<string, string[]>,
): MapChartData {
  const { id, size, dimension, value } = dataset;

  // --- 1. Find the geo dimension ---
  const geoDimId = mapConfig.geoDimensionId ?? dataset.role?.geo?.[0];
  if (!geoDimId) {
    throw new Error('[JsonStatChart] transformMapData: dataset has no geo role dimension');
  }
  const geoDimIdx = id.indexOf(geoDimId);
  if (geoDimIdx === -1) {
    throw new Error(`[JsonStatChart] transformMapData: geo dimension "${geoDimId}" not found in dataset.id`);
  }

  // --- 2. Extract geo codes and labels ---
  const geoCatDef = dimension[geoDimId].category;
  const geoCodes = activeCategoryCodes?.[geoDimId] ?? getOrderedCodes(geoCatDef.index);
  const geoLabels: Record<string, string> = {};
  for (const code of geoCodes) {
    geoLabels[code] = geoCatDef.label?.[code] ?? code;
  }

  // --- 3. Compute strides for row-major indexing ---
  const strides: number[] = new Array(id.length).fill(1);
  for (let i = id.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * size[i + 1];
  }

  // --- 4. Extract one numeric value per geo code ---
  // All non-geo dimensions use index 0 (first value).
  const values = new Map<string, number | null>();
  for (const code of geoCodes) {
    const geoPos = Array.isArray(geoCatDef.index)
      ? geoCatDef.index.indexOf(code)
      : geoCatDef.index[code];

    const dimIndices = id.map((dimCode, i) => {
      if (i === geoDimIdx) return geoPos;
      const selectedCode = activeCategoryCodes?.[dimCode]?.[0];
      return selectedCode ? getOrderedCodes(dimension[dimCode].category.index).indexOf(selectedCode) : 0;
    });
    const flatIdx = computeFlatIndex(dimIndices, strides);
    values.set(code, resolveValue(value[flatIdx]));
  }

  // --- 5. Auto-detect prefix and build code mapper ---
  const detected = detectGeoPrefix(geoCodes);
  const geoIdProperty =
    mapConfig.geoIdProperty ?? (detected?.propertyName ?? 'id');
  const geoCodeMapper =
    mapConfig.geoCodeMapper ??
    (detected
      ? (code: string) => code.substring(detected.prefix.length)
      : (code: string) => code);

  // --- 6. Classify values ---
  const classCount = mapConfig.classCount ?? 5;
  const colors = theme.mapColors;
  const nonNullValues = [...values.values()].filter((v): v is number => v !== null);
  const method: ClassificationMethod = mapConfig.classificationMethod ?? 'jenks-nice';

  let classification: MapClassification;
  let matchBreaks: MapClassBreak[] = [];
  let linearScale: { scaleMin: number; scaleMax: number; colors: string[] } | undefined;

  if (method === 'linear') {
    let scaleMin: number;
    let scaleMax: number;
    let linearColors: string[];
    if (nonNullValues.length === 0) {
      scaleMin = 0;
      scaleMax = 0;
      linearColors = [colors[0] || '#cccccc'];
    } else {
      const sorted = [...nonNullValues].sort((a, b) => a - b);
      const dataMin = sorted[0];
      const dataMax = sorted.at(-1)!;
      if (dataMin === dataMax) {
        scaleMin = dataMin;
        scaleMax = dataMax;
        linearColors = [colors[0] || '#cccccc'];
      } else {
        const range = dataMax - dataMin;
        const niceStep = linearAxisIntervalStepFunction(range / 5);
        scaleMin = niceStep > 0 ? Math.floor(dataMin / niceStep) * niceStep : dataMin;
        scaleMax = niceStep > 0 ? Math.ceil(dataMax / niceStep) * niceStep : dataMax;
        linearColors = colors;
      }
    }
    classification = { method: 'linear', scaleMin, scaleMax, colors: linearColors };
    linearScale = { scaleMin, scaleMax, colors: linearColors };
  } else if (method === 'jenks') {
    const breaks = classifyJenks(nonNullValues, classCount, colors);
    const gvf = breaks.length > 0 ? computeGVF(nonNullValues, breaks) : undefined;
    classification = { method: 'jenks', breaks, gvf };
    matchBreaks = breaks;
  } else if (method === 'jenks-nice') {
    const result = classifyJenksNice(nonNullValues, classCount, colors);
    classification = { method: 'jenks-nice', breaks: result.breaks, gvf: result.gvf };
    matchBreaks = result.breaks;
  } else {
    // 'even-ranges'
    const breaks = classifyNiceInterval(nonNullValues, classCount, colors);
    classification = { method: 'even-ranges', breaks };
    matchBreaks = breaks;
  }

  // --- 7. Match features ---
  const features = geometry.features;
  const regions = matchFeatures({
    geoCodes,
    geoLabels,
    values,
    features,
    geoIdProperty,
    geoCodeMapper,
    breaks: matchBreaks,
    noDataColor: NO_DATA_COLOR,
    linearScale,
  });

  // --- 8. Extract dimension metadata ---
  const geoDimensionLabel = dimension[geoDimId].label ?? geoDimId;

  let valueDimensionLabel = '';
  let unit: string | undefined;
  let decimals: number | undefined;

  const metricDimId = dataset.role?.metric?.[0] ?? null;
  if (metricDimId && dimension[metricDimId]) {
    const metricCatDef = dimension[metricDimId].category;
    const metricCodes = activeCategoryCodes?.[metricDimId] ?? getOrderedCodes(metricCatDef.index);
    const firstCode = metricCodes[0];
    valueDimensionLabel = metricCatDef.label?.[firstCode] ?? metricDimId;
    const unitInfo = metricCatDef.unit?.[firstCode];
    if (unitInfo) {
      unit = unitInfo.label;
      decimals = unitInfo.decimals;
    }
  } else {
    // No metric role — fall back to any non-geo dimension label
    const fallbackDim = id.find((d) => d !== geoDimId);
    if (fallbackDim) {
      valueDimensionLabel = dimension[fallbackDim].label ?? fallbackDim;
    }
  }

  return {
    regions,
    classification,
    noDataColor: NO_DATA_COLOR,
    hasNoData: regions.some((r) => r.classIndex === -1),
    geoDimensionLabel,
    valueDimensionLabel,
    unit,
    decimals,
  };
}
