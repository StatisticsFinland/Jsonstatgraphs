import type { JsonStatCategory, JsonStatDataset } from '../../src/types';

type JsonStatValue = number | null | string;

function resolveOrderedCodes(index: Record<string, number> | string[]): string[] {
  if (Array.isArray(index)) return index;
  return Object.keys(index).sort((a, b) => index[a] - index[b]);
}

function computeStrides(sizes: number[]): number[] {
  const strides = new Array<number>(sizes.length);
  strides[sizes.length - 1] = 1;
  for (let i = sizes.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * sizes[i + 1];
  }
  return strides;
}

function remapValues(
  srcValues: JsonStatValue[],
  newSize: number[],
  newStrides: number[],
  origStrides: number[],
  dimIndex: number,
  keepPositions: number[],
): JsonStatValue[] {
  const ndims = newSize.length;
  const newTotal = newSize.reduce((a, b) => a * b, 1);
  const result = new Array<JsonStatValue>(newTotal);
  for (let newIdx = 0; newIdx < newTotal; newIdx++) {
    let origIdx = 0;
    for (let d = 0; d < ndims; d++) {
      const newDimPos = Math.floor(newIdx / newStrides[d]) % newSize[d];
      const origDimPos = d === dimIndex ? keepPositions[newDimPos] : newDimPos;
      origIdx += origDimPos * origStrides[d];
    }
    result[newIdx] = srcValues[origIdx];
  }
  return result;
}

function buildNewCategoryIndex(
  currentIndex: Record<string, number> | string[],
  keepCodes: string[],
): Record<string, number> | string[] {
  if (Array.isArray(currentIndex)) return keepCodes;
  const indexMap: Record<string, number> = {};
  keepCodes.forEach((code, pos) => { indexMap[code] = pos; });
  return indexMap;
}

function filterByKeepCodes<V>(
  src: Record<string, V> | undefined,
  keepCodes: string[],
): Record<string, V> | undefined {
  if (!src) return undefined;
  return Object.fromEntries(keepCodes.filter((c) => c in src).map((c) => [c, src[c]]));
}

/**
 * Returns a new dataset with only the specified category codes on the given dimension.
 * Keeps the JSON-stat 2.0 structure valid (id, size, dimension, value arrays stay consistent).
 *
 * If `codes` is a number, takes the first N categories.
 */
export function sliceDataset(
  dataset: JsonStatDataset,
  dimensionId: string,
  codes: string[] | number,
): JsonStatDataset {
  const dimIndex = dataset.id.indexOf(dimensionId);
  if (dimIndex === -1) {
    throw new Error(`sliceDataset: dimension "${dimensionId}" not found in dataset`);
  }
  const dimension = dataset.dimension[dimensionId];
  const category = dimension.category;

  const orderedCodes = resolveOrderedCodes(category.index);
  const keepCodes = typeof codes === 'number' ? orderedCodes.slice(0, codes) : codes;
  const keepPositions = keepCodes.map((code) => orderedCodes.indexOf(code));
  for (let i = 0; i < keepCodes.length; i++) {
    if (keepPositions[i] === -1) {
      throw new Error(`sliceDataset: category code "${keepCodes[i]}" not found in dimension "${dimensionId}"`);
    }
  }

  const origStrides = computeStrides(dataset.size);
  const newSize = dataset.size.map((s, i) => (i === dimIndex ? keepCodes.length : s));
  const newStrides = computeStrides(newSize);

  const newValue = remapValues(dataset.value, newSize, newStrides, origStrides, dimIndex, keepPositions);

  const newCategory: JsonStatCategory = {
    index: buildNewCategoryIndex(category.index, keepCodes),
    ...filterByKeepCodes(category.label, keepCodes) !== undefined && { label: filterByKeepCodes(category.label, keepCodes) },
    ...filterByKeepCodes(category.unit, keepCodes) !== undefined && { unit: filterByKeepCodes(category.unit, keepCodes) },
  };

  return {
    ...(dataset.version !== undefined && { version: dataset.version }),
    ...(dataset.class !== undefined && { class: dataset.class }),
    ...(dataset.label !== undefined && { label: dataset.label }),
    ...(dataset.source !== undefined && { source: dataset.source }),
    ...(dataset.updated !== undefined && { updated: dataset.updated }),
    ...(dataset.role !== undefined && { role: dataset.role }),
    id: dataset.id,
    size: newSize,
    dimension: {
      ...dataset.dimension,
      [dimensionId]: { ...dimension, category: newCategory },
    },
    value: newValue,
    ...(dataset.extension !== undefined && { extension: dataset.extension }),
  };
}
