import { JsonStatDataset, ChartData, DataSeries, DataPoint, ScatterChartData, ScatterDataPoint, PyramidChartData, Layout, SelectableSelections } from '../types';
import { rebuildDataset } from './rebuild-dataset';
import { hasSelectableDatasetOptions, resolveSelectableDatasetOptions } from './selectable-settings';
import { computeFlatIndex, getOrderedCodes } from './dataset-utils';

export { getOrderedCodes } from './dataset-utils';

export interface TransformOptions {
  layout?: Layout;
  selectableSelections?: SelectableSelections;
  defaultSelectableSelections?: SelectableSelections;
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

/**
 * Transforms a JSON-stat 2.0 dataset into chart-ready series data.
 */
export function transformDataset(
  dataset: JsonStatDataset,
  options?: TransformOptions
): ChartData {
  const selectableOptions = resolveSelectableDatasetOptions(dataset, options, options?.selectableSelections);
  if (hasSelectableDatasetOptions(selectableOptions)) {
    const rebuilt = rebuildDataset(dataset, selectableOptions);
    if (selectableOptions.layout) {
      const declaredCodes = new Set([...selectableOptions.layout.rows, ...selectableOptions.layout.columns]);
      const multiSelectableCode = selectableOptions.multiSelectableDimensionCode;
      const projectedRows = multiSelectableCode
        && !declaredCodes.has(multiSelectableCode)
        && getOrderedCodes(rebuilt.dataset.dimension[multiSelectableCode].category.index).length > 1
        ? [multiSelectableCode, ...selectableOptions.layout.rows]
        : selectableOptions.layout.rows;
      return transformLayoutDataset(rebuilt.dataset, {
        rows: projectedRows,
        columns: selectableOptions.layout.columns,
      });
    }
    return transformDataset(rebuilt.dataset, {
      xDimension: options?.xDimension,
      seriesDimension: options?.seriesDimension,
    });
  }
  const { id, size, dimension, value } = dataset;

  // --- 1. Determine x-axis dimension ---
  let xDimId: string;
  if (options?.xDimension) {
    xDimId = options.xDimension;
  } else {
    const timeDims = dataset.role?.time ?? [];
    const metricDims = new Set(dataset.role?.metric ?? []);
    // Step 1: Time dimension with size > 1 (first wins)
    const timeDimWithSize = timeDims.find((d) => size[id.indexOf(d)] > 1);
    if (timeDimWithSize) {
      // Step 1: Time dimension with size > 1 (first wins)
      xDimId = timeDimWithSize;
    } else if (timeDims.length > 0) {
      // Time dims exist but all have size ≤ 1
      // Step 2: Largest non-metric dimension with size > 1
      const candidates = id.filter(
        (dimId) =>
          !metricDims.has(dimId) &&
          !Object.keys(dimension[dimId].category.unit ?? {}).length &&
          size[id.indexOf(dimId)] > 1
      );
      if (candidates.length > 0) {
        xDimId = candidates.reduce((best, dimId) =>
          size[id.indexOf(dimId)] > size[id.indexOf(best)] ? dimId : best
        , candidates[0]);
      } else {
        // Step 3: Time dimension even if size 1
        xDimId = timeDims[0];
      }
    } else {
      // No time dims → preserve old behavior: last non-metric non-content dim wins
      const anyCandidates = id.filter(
        (dimId) =>
          !metricDims.has(dimId) &&
          !Object.keys(dimension[dimId].category.unit ?? {}).length
      );
      xDimId = anyCandidates.length > 0
        ? anyCandidates.at(-1)!
        : id.at(-1)!;
    }
  }

  const xDimIndex = id.indexOf(xDimId);
  if (xDimIndex === -1) {
    throw new Error(`xDimension "${xDimId}" not found in dataset.id`);
  }

  // --- 2. Determine series dimension ---
  let seriesDimId: string | null = null;
  if (options?.seriesDimension) {
    seriesDimId = options.seriesDimension;
  } else if (id.length === 2) {
    seriesDimId = id.find((d) => d !== xDimId) ?? null;
  } else if (id.length >= 3) {
    // Find non-x dimensions with size > 1, excluding metric dimensions and
    // dimensions with category.unit metadata (reliable content-dimension signal)
    const metricDims = new Set(dataset.role?.metric ?? []);
    const candidates = id.filter(
      (dimId, i) =>
        dimId !== xDimId &&
        size[i] > 1 &&
        !metricDims.has(dimId) &&
        !Object.keys(dimension[dimId].category.unit ?? {}).length
    );
    if (candidates.length === 1) {
      seriesDimId = candidates[0];
    } else if (candidates.length > 1) {
      // Use the smallest (fewest categories) as the series dimension; first in id wins on ties
      seriesDimId = candidates.reduce((best, dimId) =>
        size[id.indexOf(dimId)] < size[id.indexOf(best)] ? dimId : best
      , candidates[0]);
    }
    // No qualifying candidates: single series (seriesDimId stays null)
  }
  // id.length === 1: single implicit series (seriesDimId stays null)

  // --- 3. Extract x-axis categories ---
  const xCatDef = dimension[xDimId].category;
  const xCodes = getOrderedCodes(xCatDef.index);
  const xLabels = xCodes.map((code) => getLabel(xCatDef.label, code));

  // --- 4. Compute strides for row-major indexing ---
  // stride[i] = product of sizes of all dimensions after i
  const strides: number[] = new Array(id.length).fill(1);
  for (let i = id.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * size[i + 1];
  }

  // --- 5. Build series ---
  const series: DataSeries[] = [];

  if (seriesDimId !== null) {
    const seriesDimIdx = id.indexOf(seriesDimId);
    const seriesCatDef = dimension[seriesDimId].category;
    const seriesCodes = getOrderedCodes(seriesCatDef.index);

    for (const seriesCode of seriesCodes) {
      const seriesPos = Array.isArray(seriesCatDef.index)
        ? seriesCatDef.index.indexOf(seriesCode)
        : seriesCatDef.index[seriesCode];

      const points: DataPoint[] = xCodes.map((xCode, xPos) => {
        const dimIndices = id.map((dimId, i) => {
          if (i === xDimIndex) return xPos;
          if (i === seriesDimIdx) return seriesPos;
          return 0; // fixed at first value for extra dimensions
        });
        const raw = value[computeFlatIndex(dimIndices, strides)];
        return {
          value: resolveValue(raw),
          label: xLabels[xPos],
          categoryCode: xCode,
        };
      });

      series.push({
        name: getLabel(seriesCatDef.label, seriesCode),
        code: seriesCode,
        points,
      });
    }
  } else {
    // Single implicit series (1 dimension, or 3+ with no series dim)
    const points: DataPoint[] = xCodes.map((xCode, xPos) => {
      const dimIndices = id.map((_, i) => {
        if (i === xDimIndex) return xPos;
        return 0;
      });
      const raw = value[computeFlatIndex(dimIndices, strides)];
      return {
        value: resolveValue(raw),
        label: xLabels[xPos],
        categoryCode: xCode,
      };
    });

    series.push({
      name: dimension[xDimId].label ?? xDimId,
      code: xDimId,
      points,
    });
  }

  // --- 6. Derive xLabel and yLabel ---
  const xLabel: string = dimension[xDimId].label ?? xDimId;

  let derivedYLabel: string | undefined;
  const contentDimId = dataset.role?.metric?.[0] ??
    id.find((dimId) => dimId !== xDimId && dimId !== seriesDimId);
  if (contentDimId) {
    const contentDim = dimension[contentDimId];
    if (contentDim?.category?.unit) {
      const unitCodes = Object.keys(contentDim.category.unit);
      if (unitCodes.length === 1) {
        const unitLabel = contentDim.category.unit[unitCodes[0]]?.label?.trim() || undefined;
        if (unitLabel) derivedYLabel = unitLabel;
      } else if (unitCodes.length > 1) {
        // yLabel is only derived when ALL unit entries have a defined label AND all are identical
        const labels = unitCodes.map(c => contentDim.category.unit![c]?.label?.trim() || undefined);
        if (labels.every(l => l !== undefined)) {
          const unique = new Set(labels);
          if (unique.size === 1) derivedYLabel = labels[0];
        }
      }
    }
  }

  return {
    series,
    categories: xCodes,
    categoryLabels: xLabels,
    xLabel,
    seriesLabel: seriesDimId ? (dimension[seriesDimId].label ?? seriesDimId) : undefined,
    yLabel: derivedYLabel,
  };
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
