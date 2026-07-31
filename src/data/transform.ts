import { JsonStatDataset, ChartData, DataSeries, DataPoint, ScatterChartData, ScatterDataPoint, PyramidChartData, Layout } from '../types';
import { computeFlatIndex, computeStrides, getOrderedCodes } from './dataset-utils';

export { getOrderedCodes } from './dataset-utils';

export interface TransformOptions {
  layout?: Layout;
  multiSelectableDimensionCode?: string;
  xDimension?: string;
  seriesDimension?: string;
}

interface AxisGroup {
  code: string;
  label: string;
  coordinates: Map<string, number>;
}

function createAxisGroups(dataset: JsonStatDataset, dimensionCodes: string[]): AxisGroup[] {
  if (dimensionCodes.length === 0) return [{ code: '__scalar__', label: '', coordinates: new Map() }];
  const categoryCodes = dimensionCodes.map(code => getOrderedCodes(dataset.dimension[code].category.index));
  const sizes = categoryCodes.map(codes => codes.length);
  const strides = sizes.map((_, index) => sizes.slice(index + 1).reduce((product, size) => product * size, 1));
  const count = sizes.reduce((product, size) => product * size, 1);
  return Array.from({ length: count }, (_, flatIndex) => {
    const positions = sizes.map((size, index) => Math.floor(flatIndex / strides[index]) % size);
    const codes = positions.map((position, index) => categoryCodes[index][position]);
    const labels = codes.map((code, index) => getLabel(dataset.dimension[dimensionCodes[index]].category.label, code));
    return {
      code: codes.length === 1
        ? codes[0]
        : codes.map((code, index) => `${dimensionCodes[index]}:${code}`).join('\u001f'),
      label: labels.join(', '),
      coordinates: new Map(dimensionCodes.map((code, index) => [code, positions[index]])),
    };
  });
}

function deriveYLabel(dataset: JsonStatDataset): string | undefined {
  const metricCode = dataset.role?.metric?.[0];
  if (!metricCode) return undefined;
  const category = dataset.dimension[metricCode]?.category;
  if (!category?.unit) return undefined;
  const labels = getOrderedCodes(category.index).map(code => category.unit?.[code]?.label?.trim());
  return labels.length > 0 && labels.every(label => label && label === labels[0]) ? labels[0] : undefined;
}

function transformLayoutDataset(dataset: JsonStatDataset, layout: Layout): ChartData {
  const rowGroups = createAxisGroups(dataset, layout.rows);
  const columnGroups = createAxisGroups(dataset, layout.columns);
  const strides = dataset.size.map((_, index) => dataset.size.slice(index + 1).reduce((product, size) => product * size, 1));
  const series = rowGroups.map(row => ({
    name: row.label || layout.rows.map(code => dataset.dimension[code].label ?? code).join(', '),
    code: row.code,
    points: columnGroups.map(column => {
      const coordinates = dataset.id.map(code => row.coordinates.get(code) ?? column.coordinates.get(code) ?? 0);
      return {
        value: resolveValue(dataset.value[computeFlatIndex(coordinates, strides)]),
        label: column.label,
        categoryCode: column.code,
      };
    }),
  }));
  return {
    series,
    categories: columnGroups.map(group => group.code),
    categoryLabels: columnGroups.map(group => group.label),
    xLabel: layout.columns.map(code => dataset.dimension[code].label ?? code).join(', '),
    seriesLabel: layout.rows.map(code => dataset.dimension[code].label ?? code).join(', ') || undefined,
    yLabel: deriveYLabel(dataset),
  };
}

/**
 * Gets the label for a category code, falling back to the code itself.
 */
function getLabel(
  label: Record<string, string> | undefined,
  code: string
): string {
  return label?.[code] ?? code;
}

/** Resolves a raw dataset value: null or string (missing marker) → null, number → number. */
function resolveValue(v: number | null | string): number | null {
  if (v === null || typeof v === 'string') return null;
  return v;
}

function transformConfiguredLayout(
  dataset: JsonStatDataset,
  layout: Layout,
  multiSelectableDimensionCode?: string,
): ChartData {
  const declaredCodes = new Set([...layout.rows, ...layout.columns]);
  const projectedRows = multiSelectableDimensionCode
    && !declaredCodes.has(multiSelectableDimensionCode)
    && getOrderedCodes(dataset.dimension[multiSelectableDimensionCode].category.index).length > 1
    ? [multiSelectableDimensionCode, ...layout.rows]
    : layout.rows;
  return transformLayoutDataset(dataset, {
    rows: projectedRows,
    columns: layout.columns,
  });
}

function hasUnitMetadata(dataset: JsonStatDataset, dimensionCode: string): boolean {
  return Object.keys(dataset.dimension[dimensionCode].category.unit ?? {}).length > 0;
}

function selectLargestDimension(dataset: JsonStatDataset, dimensionCodes: string[]): string {
  return dimensionCodes.reduce((best, dimensionCode) =>
    dataset.size[dataset.id.indexOf(dimensionCode)] > dataset.size[dataset.id.indexOf(best)]
      ? dimensionCode
      : best
  , dimensionCodes[0]);
}

function selectXDimension(dataset: JsonStatDataset, requestedDimension?: string): string {
  if (requestedDimension) return requestedDimension;

  const timeDimensions = dataset.role?.time ?? [];
  const metricDimensions = new Set(dataset.role?.metric ?? []);
  const multiValueTimeDimension = timeDimensions.find(
    dimensionCode => dataset.size[dataset.id.indexOf(dimensionCode)] > 1
  );
  if (multiValueTimeDimension) return multiValueTimeDimension;

  const eligibleDimensions = dataset.id.filter(
    dimensionCode => !metricDimensions.has(dimensionCode) && !hasUnitMetadata(dataset, dimensionCode)
  );
  if (timeDimensions.length === 0) {
    return eligibleDimensions.at(-1) ?? dataset.id.at(-1)!;
  }

  const multiValueDimensions = eligibleDimensions.filter(
    dimensionCode => dataset.size[dataset.id.indexOf(dimensionCode)] > 1
  );
  return multiValueDimensions.length > 0
    ? selectLargestDimension(dataset, multiValueDimensions)
    : timeDimensions[0];
}

function selectSeriesDimension(
  dataset: JsonStatDataset,
  xDimension: string,
  requestedDimension?: string,
): string | null {
  if (requestedDimension) return requestedDimension;
  if (dataset.id.length === 1) return null;
  if (dataset.id.length === 2) {
    return dataset.id.find(dimensionCode => dimensionCode !== xDimension) ?? null;
  }

  const metricDimensions = new Set(dataset.role?.metric ?? []);
  const candidates = dataset.id.filter((dimensionCode, index) =>
    dimensionCode !== xDimension
    && dataset.size[index] > 1
    && !metricDimensions.has(dimensionCode)
    && !hasUnitMetadata(dataset, dimensionCode)
  );
  return candidates.reduce<string | null>((best, dimensionCode) => {
    if (best === null) return dimensionCode;
    return dataset.size[dataset.id.indexOf(dimensionCode)] < dataset.size[dataset.id.indexOf(best)]
      ? dimensionCode
      : best;
  }, null);
}

function buildPoints(
  dataset: JsonStatDataset,
  xDimensionIndex: number,
  xCodes: string[],
  xLabels: string[],
  strides: number[],
  seriesDimensionIndex?: number,
  seriesPosition?: number,
): DataPoint[] {
  return xCodes.map((xCode, xPosition) => {
    const coordinates = dataset.id.map((_, dimensionIndex) => {
      if (dimensionIndex === xDimensionIndex) return xPosition;
      if (dimensionIndex === seriesDimensionIndex) return seriesPosition!;
      return 0;
    });
    return {
      value: resolveValue(dataset.value[computeFlatIndex(coordinates, strides)]),
      label: xLabels[xPosition],
      categoryCode: xCode,
    };
  });
}

function buildSeries(
  dataset: JsonStatDataset,
  xDimension: string,
  seriesDimension: string | null,
  xCodes: string[],
  xLabels: string[],
  strides: number[],
): DataSeries[] {
  const xDimensionIndex = dataset.id.indexOf(xDimension);
  if (seriesDimension === null) {
    return [{
      name: dataset.dimension[xDimension].label ?? xDimension,
      code: xDimension,
      points: buildPoints(dataset, xDimensionIndex, xCodes, xLabels, strides),
    }];
  }

  const seriesDimensionIndex = dataset.id.indexOf(seriesDimension);
  const seriesCategory = dataset.dimension[seriesDimension].category;
  return getOrderedCodes(seriesCategory.index).map(seriesCode => {
    const seriesPosition = Array.isArray(seriesCategory.index)
      ? seriesCategory.index.indexOf(seriesCode)
      : seriesCategory.index[seriesCode];
    return {
      name: getLabel(seriesCategory.label, seriesCode),
      code: seriesCode,
      points: buildPoints(
        dataset,
        xDimensionIndex,
        xCodes,
        xLabels,
        strides,
        seriesDimensionIndex,
        seriesPosition,
      ),
    };
  });
}

function deriveStandardYLabel(
  dataset: JsonStatDataset,
  xDimension: string,
  seriesDimension: string | null,
): string | undefined {
  const contentDimensionCode = dataset.role?.metric?.[0]
    ?? dataset.id.find(dimensionCode => dimensionCode !== xDimension && dimensionCode !== seriesDimension);
  const units = contentDimensionCode
    ? dataset.dimension[contentDimensionCode]?.category.unit
    : undefined;
  if (!units) return undefined;

  const unitCodes = Object.keys(units);
  if (unitCodes.length === 1) return units[unitCodes[0]]?.label?.trim() || undefined;
  const labels = unitCodes.map(code => units[code]?.label?.trim() || undefined);
  return labels.length > 1 && labels.every(label => label !== undefined && label === labels[0])
    ? labels[0]
    : undefined;
}

function createChartData(
  dataset: JsonStatDataset,
  xDimension: string,
  seriesDimension: string | null,
): ChartData {
  const xCategory = dataset.dimension[xDimension].category;
  const xCodes = getOrderedCodes(xCategory.index);
  const xLabels = xCodes.map(code => getLabel(xCategory.label, code));
  return {
    series: buildSeries(
      dataset,
      xDimension,
      seriesDimension,
      xCodes,
      xLabels,
      computeStrides(dataset.size),
    ),
    categories: xCodes,
    categoryLabels: xLabels,
    xLabel: dataset.dimension[xDimension].label ?? xDimension,
    seriesLabel: seriesDimension
      ? (dataset.dimension[seriesDimension].label ?? seriesDimension)
      : undefined,
    yLabel: deriveStandardYLabel(dataset, xDimension, seriesDimension),
  };
}

/**
 * Transforms a JSON-stat 2.0 dataset into chart-ready series data.
 */
export function transformDataset(
  dataset: JsonStatDataset,
  options?: TransformOptions
) : ChartData {
  if (options?.layout) {
    return transformConfiguredLayout(dataset, options.layout, options.multiSelectableDimensionCode);
  }
  const xDimension = selectXDimension(dataset, options?.xDimension);
  const xDimensionIndex = dataset.id.indexOf(xDimension);
  if (xDimensionIndex === -1) {
    throw new Error(`xDimension "${xDimension}" not found in dataset.id`);
  }

  const seriesDimension = selectSeriesDimension(dataset, xDimension, options?.seriesDimension);
  return createChartData(dataset, xDimension, seriesDimension);
}

// --- Scatter transform ---

export interface ScatterTransformOptions {
  xContentValue: string;
  yContentValue: string;
  observationDimension?: string;
  activeCategoryCodes?: Record<string, string[]>;
}

export function transformScatterData(
  dataset: JsonStatDataset,
  options: ScatterTransformOptions,
): ScatterChartData {
  const { id, size, dimension, value } = dataset;

  // Find the content dimension
  const contentDimId =
    dataset.role?.metric?.[0] ??
    id.find((dimId) => {
      const idx = id.indexOf(dimId);
      return !dataset.role?.time?.includes(dimId) && size[idx] > 1;
    }) ??
    id[0];

  const contentDimIdx = id.indexOf(contentDimId);
  const contentDim = dimension[contentDimId];
  const contentCodes = getOrderedCodes(contentDim.category.index);

  const xPos = contentCodes.indexOf(options.xContentValue);
  const yPos = contentCodes.indexOf(options.yContentValue);

  if (xPos === -1 || yPos === -1) {
    return { points: [], xLabel: options.xContentValue, yLabel: options.yContentValue };
  }

  // Find observation dimension
  let obsDimId: string;
  if (options.observationDimension && id.includes(options.observationDimension)) {
    obsDimId = options.observationDimension;
  } else {
    let maxSize = -1;
    let maxDimId = id[0];
    for (let i = 0; i < id.length; i++) {
      if (id[i] !== contentDimId && size[i] > maxSize) {
        maxSize = size[i];
        maxDimId = id[i];
      }
    }
    obsDimId = maxDimId;
  }

  const obsDimIdx = id.indexOf(obsDimId);
  const obsDim = dimension[obsDimId];
  const obsCodes = options.activeCategoryCodes?.[obsDimId] ?? getOrderedCodes(obsDim.category.index);

  // Compute strides for row-major indexing
  const strides: number[] = new Array(id.length).fill(1);
  for (let i = id.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * size[i + 1];
  }

  const xLabel = contentDim.category.label?.[options.xContentValue] ?? options.xContentValue;
  const yLabel = contentDim.category.label?.[options.yContentValue] ?? options.yContentValue;
  const xUnit = contentDim.category.unit?.[options.xContentValue]?.label?.trim() || undefined;
  const yUnit = contentDim.category.unit?.[options.yContentValue]?.label?.trim() || undefined;

  const points: ScatterDataPoint[] = obsCodes.map((obsCode) => {
    const obsPos = getOrderedCodes(obsDim.category.index).indexOf(obsCode);
    const coordinate = (contentPosition: number) => id.map((dimCode, i) => {
      if (i === contentDimIdx) return contentPosition;
      if (i === obsDimIdx) return obsPos;
      const selectedCode = options.activeCategoryCodes?.[dimCode]?.[0];
      return selectedCode ? getOrderedCodes(dimension[dimCode].category.index).indexOf(selectedCode) : 0;
    });
    const xRaw = value[computeFlatIndex(coordinate(xPos), strides)];
    const yRaw = value[computeFlatIndex(coordinate(yPos), strides)];
    return {
      x: xRaw === null || typeof xRaw === 'string' ? null : xRaw,
      y: yRaw === null || typeof yRaw === 'string' ? null : yRaw,
      label: obsDim.category.label?.[obsCode] ?? obsCode,
      code: obsCode,
    };
  });

  return {
    points,
    xLabel,
    yLabel,
    ...(xUnit !== undefined && { xUnit }),
    ...(yUnit !== undefined && { yUnit }),
    observationLabel: obsDim.label,
  };
}

// --- Pyramid transform ---

export interface PyramidTransformOptions {
  categoryDimension: string;
  splitDimension: string;
  activeCategoryCodes?: Record<string, string[]>;
}

export function transformPyramidData(
  dataset: JsonStatDataset,
  options: PyramidTransformOptions,
): PyramidChartData {
  const { id, size, dimension, value } = dataset;
  const { categoryDimension, splitDimension } = options;

  const catDimIdx = id.indexOf(categoryDimension);
  const splitDimIdx = id.indexOf(splitDimension);
  const catDim = dimension[categoryDimension];
  const splitDim = dimension[splitDimension];

  const catCodes = options.activeCategoryCodes?.[categoryDimension] ?? getOrderedCodes(catDim.category.index);
  const splitCodes = options.activeCategoryCodes?.[splitDimension] ?? getOrderedCodes(splitDim.category.index);
  const categoryLabels = catCodes.map((code) => catDim.category.label?.[code] ?? code);

  // Compute strides
  const strides: number[] = new Array(id.length).fill(1);
  for (let i = id.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * size[i + 1];
  }

  function buildSeries(splitIdx: number): DataSeries {
    const splitCode = splitCodes[splitIdx];
    const points: DataPoint[] = catCodes.map((catCode) => {
      const catIdx = getOrderedCodes(catDim.category.index).indexOf(catCode);
      const originalSplitIdx = getOrderedCodes(splitDim.category.index).indexOf(splitCode);
      const coordinate = id.map((dimCode, i) => {
        if (i === catDimIdx) return catIdx;
        if (i === splitDimIdx) return originalSplitIdx;
        const selectedCode = options.activeCategoryCodes?.[dimCode]?.[0];
        return selectedCode ? getOrderedCodes(dimension[dimCode].category.index).indexOf(selectedCode) : 0;
      });
      const raw = value[computeFlatIndex(coordinate, strides)];
      return {
        value: raw === null || typeof raw === 'string' ? null : raw,
        label: catDim.category.label?.[catCode] ?? catCode,
        categoryCode: catCode,
      };
    });
    return {
      name: splitDim.category.label?.[splitCode] ?? splitCode,
      code: splitCode,
      points,
    };
  }

  return {
    leftSeries: buildSeries(0),
    rightSeries: buildSeries(splitCodes.length > 1 ? 1 : 0),
    categories: catCodes,
    categoryLabels,
    splitDimensionLabel: splitDim.label,
    categoryDimensionLabel: catDim.label,
  };
}
