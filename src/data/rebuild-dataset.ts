import type { JsonStatCategory, JsonStatDataset, JsonStatDimension } from '../types';
import { computeFlatIndex, computeStrides, getOrderedCodes } from './dataset-utils';
import type { SelectableDatasetOptions } from './selectable-settings';

interface ActiveCategory {
  code: string;
  sourceIndex: number;
}

interface ActiveDimension {
  code: string;
  sourceIndex: number;
  categories: ActiveCategory[];
}

export interface RebuiltDatasetResult {
  dataset: JsonStatDataset;
}

function fail(message: string): never {
  throw new Error(`[JsonStatChart] ${message}`);
}

export function resolveSelectedCodes(
  requested: string[] | undefined,
  defaults: string[] | undefined,
  categoryCodes: string[],
  isTimeDimension: boolean,
  dimensionCode?: string,
): string[] {
  if (requested?.length) return requested;
  if (defaults?.length) return defaults;
  if (requested !== undefined) fail(`No selections were provided for dimension: "${dimensionCode ?? 'unknown'}"`);
  return [categoryCodes[isTimeDimension ? categoryCodes.length - 1 : 0]];
}

function getSelectableCodes(options: SelectableDatasetOptions): Set<string> {
  return new Set([
    ...Object.keys(options.selectableSelections ?? {}),
    ...Object.keys(options.defaultSelectableSelections ?? {}),
    ...(options.multiSelectableDimensionCode ? [options.multiSelectableDimensionCode] : []),
  ]);
}

function filterRecord<T>(record: Record<string, T> | undefined, codes: string[]): Record<string, T> | undefined {
  if (!record) return undefined;
  return Object.fromEntries(codes.flatMap(code => code in record ? [[code, record[code]]] : []));
}

function rebuildCategory(category: JsonStatCategory, codes: string[]): JsonStatCategory {
  const index = Array.isArray(category.index)
    ? codes
    : Object.fromEntries(codes.map((code, index) => [code, index]));
  return {
    ...category,
    index,
    ...(category.label && { label: filterRecord(category.label, codes) }),
    ...(category.unit && { unit: filterRecord(category.unit, codes) }),
  };
}

function rebuildDimension(dimension: JsonStatDimension, codes: string[]): JsonStatDimension {
  return { ...dimension, category: rebuildCategory(dimension.category, codes) };
}

function decodeIndex(flatIndex: number, size: number[], strides: number[]): number[] {
  return size.map((dimensionSize, index) => Math.floor(flatIndex / strides[index]) % dimensionSize);
}

/** Filters selectable categories and optionally permutes an N-dimensional JSON-stat dataset. */
export function rebuildDataset(
  dataset: JsonStatDataset,
  options: SelectableDatasetOptions,
): RebuiltDatasetResult {
  const selectableCodes = getSelectableCodes(options);
  const activeDimensions = dataset.id.map((code, sourceIndex): ActiveDimension => {
    const categoryCodes = getOrderedCodes(dataset.dimension[code].category.index);
    const selected = selectableCodes.has(code)
      ? new Set(resolveSelectedCodes(
        options.selectableSelections?.[code],
        options.defaultSelectableSelections?.[code],
        categoryCodes,
        dataset.role?.time?.includes(code) ?? false,
        code,
      ))
      : undefined;
    const categories = categoryCodes
      .map((categoryCode, categoryIndex) => ({ code: categoryCode, sourceIndex: categoryIndex }))
      .filter(category => selected === undefined || selected.has(category.code));
    if (categories.length === 0) fail(`No active values remain for dimension: "${code}"`);
    return { code, sourceIndex, categories };
  });

  const declaredOrder = options.layout ? [...options.layout.rows, ...options.layout.columns] : [];
  const declaredCodes = new Set(declaredOrder);
  const targetCodes = options.layout
    ? [...declaredOrder, ...dataset.id.filter(code => !declaredCodes.has(code))]
    : [...dataset.id];
  const activeByCode = new Map(activeDimensions.map(dimension => [dimension.code, dimension]));
  const targetDimensions = targetCodes.map(code => activeByCode.get(code)!);
  const targetSize = targetDimensions.map(dimension => dimension.categories.length);
  const targetStrides = computeStrides(targetSize);
  const sourceStrides = computeStrides(dataset.size);
  const valueCount = targetSize.reduce((product, size) => product * size, 1);
  const value = Array.from({ length: valueCount }, (_, targetFlatIndex) => {
    const targetCoordinates = decodeIndex(targetFlatIndex, targetSize, targetStrides);
    const sourceCoordinates = new Array<number>(dataset.id.length).fill(0);
    targetDimensions.forEach((dimension, targetIndex) => {
      sourceCoordinates[dimension.sourceIndex] = dimension.categories[targetCoordinates[targetIndex]].sourceIndex;
    });
    return dataset.value[computeFlatIndex(sourceCoordinates, sourceStrides)];
  });

  const dimension = Object.fromEntries(targetDimensions.map(activeDimension => {
    const codes = activeDimension.categories.map(category => category.code);
    return [activeDimension.code, rebuildDimension(dataset.dimension[activeDimension.code], codes)];
  }));
  const extension = dataset.extension
    ? Object.fromEntries(Object.entries(dataset.extension).filter(([key]) => key !== 'selectableConfig'))
    : undefined;

  return {
    dataset: {
      ...dataset,
      id: targetCodes,
      size: targetSize,
      dimension,
      value,
      extension,
    },
  };
}