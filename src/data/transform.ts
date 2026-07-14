import { JsonStatDataset, ChartData, DataSeries, DataPoint, ScatterChartData, ScatterDataPoint, PyramidChartData } from '../types';

export interface TransformOptions {
  xDimension?: string;
  seriesDimension?: string;
}

/**
 * Returns ordered category codes from a dimension's category.index,
 * which may be either a string[] or Record<string, number>.
 */
export function getOrderedCodes(index: Record<string, number> | string[]): string[] {
  if (Array.isArray(index)) {
    return index;
  }
  // Object form: { "code": position }
  return Object.keys(index).sort((a, b) => index[a] - index[b]);
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

/** Computes the flat (row-major) index from per-dimension indices and strides. */
function computeFlatIndex(dimIndices: number[], strides: number[]): number {
  let idx = 0;
  for (let i = 0; i < strides.length; i++) {
    idx += dimIndices[i] * strides[i];
  }
  return idx;
}

/**
 * Transforms a JSON-stat 2.0 dataset into chart-ready series data.
 */
export function transformDataset(
  dataset: JsonStatDataset,
  options?: TransformOptions
): ChartData {
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
  const obsCodes = getOrderedCodes(obsDim.category.index);

  // Compute strides for row-major indexing
  const strides: number[] = new Array(id.length).fill(1);
  for (let i = id.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * size[i + 1];
  }

  const xLabel = contentDim.category.label?.[options.xContentValue] ?? options.xContentValue;
  const yLabel = contentDim.category.label?.[options.yContentValue] ?? options.yContentValue;
  const xUnit = contentDim.category.unit?.[options.xContentValue]?.label?.trim() || undefined;
  const yUnit = contentDim.category.unit?.[options.yContentValue]?.label?.trim() || undefined;

  const points: ScatterDataPoint[] = obsCodes.map((obsCode, obsPos) => {
    const xRaw = value[computeFlatIndex(id.map((_, i) => (i === contentDimIdx ? xPos : i === obsDimIdx ? obsPos : 0)), strides)];
    const yRaw = value[computeFlatIndex(id.map((_, i) => (i === contentDimIdx ? yPos : i === obsDimIdx ? obsPos : 0)), strides)];
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

  const catCodes = getOrderedCodes(catDim.category.index);
  const splitCodes = getOrderedCodes(splitDim.category.index);
  const categoryLabels = catCodes.map((code) => catDim.category.label?.[code] ?? code);

  // Compute strides
  const strides: number[] = new Array(id.length).fill(1);
  for (let i = id.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * size[i + 1];
  }

  function buildSeries(splitIdx: number): DataSeries {
    const splitCode = splitCodes[splitIdx];
    const points: DataPoint[] = catCodes.map((catCode, catIdx) => {
      const raw = value[computeFlatIndex(id.map((_, i) => (i === catDimIdx ? catIdx : i === splitDimIdx ? splitIdx : 0)), strides)];
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
