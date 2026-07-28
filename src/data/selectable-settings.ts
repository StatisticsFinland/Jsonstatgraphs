import type { ChartConfig, JsonStatDataset, SelectableConfig, SelectableSelections } from '../types';
import { getOrderedCodes } from './dataset-utils';

export interface SelectableDatasetOptions {
  layout?: ChartConfig['layout'];
  selectableSelections?: SelectableSelections;
  defaultSelectableSelections?: SelectableSelections;
  multiSelectableDimensionCode?: string;
}

function fail(message: string): never {
  throw new Error(`[JsonStatChart] ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateSelections(
  dataset: JsonStatDataset,
  selections: unknown,
  source: string,
): void {
  if (selections === undefined) return;
  if (!isRecord(selections)) fail(`${source} must be a dictionary of dimension selections`);

  for (const [dimensionCode, categoryCodes] of Object.entries(selections)) {
    const dimension = dataset.dimension[dimensionCode];
    if (!dimension) fail(`Unknown dimension code in ${source}: "${dimensionCode}"`);
    if (!Array.isArray(categoryCodes) || categoryCodes.some(code => typeof code !== 'string')) {
      fail(`${source}.${dimensionCode} must be an array of category codes`);
    }

    const knownCodes = new Set(getOrderedCodes(dimension.category.index));
    for (const categoryCode of categoryCodes) {
      if (!knownCodes.has(categoryCode)) {
        fail(`Unknown category code in ${source}.${dimensionCode}: "${categoryCode}"`);
      }
    }
  }
}

function validateLayout(dataset: JsonStatDataset, layout: unknown): void {
  if (layout === undefined) return;
  if (!isRecord(layout) || !Array.isArray(layout.rows) || !Array.isArray(layout.columns)) {
    fail('layout must define rows and columns arrays');
  }
  if (layout.rows.some(code => typeof code !== 'string') || layout.columns.some(code => typeof code !== 'string')) {
    fail('layout rows and columns must contain dimension codes');
  }
  const seenRows = new Set<string>();
  const seenColumns = new Set<string>();

  for (const code of layout.rows) {
    if (!dataset.dimension[code]) fail(`Unknown dimension code in layout.rows: "${code}"`);
    if (seenRows.has(code)) fail(`Duplicate dimension code in layout.rows: "${code}"`);
    seenRows.add(code);
  }
  for (const code of layout.columns) {
    if (!dataset.dimension[code]) fail(`Unknown dimension code in layout.columns: "${code}"`);
    if (seenColumns.has(code)) fail(`Duplicate dimension code in layout.columns: "${code}"`);
    if (seenRows.has(code)) fail(`Dimension "${code}" appears in both rows and columns of layout`);
    seenColumns.add(code);
  }
}

function getDatasetSelectableConfig(dataset: JsonStatDataset): SelectableConfig | undefined {
  const value = dataset.extension?.selectableConfig;
  if (value === undefined) return undefined;
  if (!isRecord(value)) fail('extension.selectableConfig must be an object');
  return value as SelectableConfig;
}

/** Resolves selectable inputs at the data-source boundary before rebuilding. */
export function resolveSelectableDatasetOptions(
  dataset: JsonStatDataset,
  config: Pick<ChartConfig, 'layout' | 'defaultSelectableSelections' | 'multiSelectableDimensionCode'> = {},
  selectableSelections?: SelectableSelections,
): SelectableDatasetOptions {
  const extensionConfig = getDatasetSelectableConfig(dataset);
  const resolved = {
    layout: config.layout,
    selectableSelections: selectableSelections ?? extensionConfig?.selectableSelections,
    defaultSelectableSelections: config.defaultSelectableSelections ?? extensionConfig?.defaultSelectableSelections,
    multiSelectableDimensionCode: config.multiSelectableDimensionCode ?? extensionConfig?.multiSelectableDimensionCode,
  };
  validateLayout(dataset, resolved.layout);
  validateSelections(dataset, resolved.selectableSelections, 'selectableSelections');
  validateSelections(dataset, resolved.defaultSelectableSelections, 'defaultSelectableSelections');
  if (resolved.multiSelectableDimensionCode && !dataset.dimension[resolved.multiSelectableDimensionCode]) {
    fail(`Unknown multiSelectableDimensionCode: "${resolved.multiSelectableDimensionCode}"`);
  }
  return resolved;
}

export function hasSelectableDatasetOptions(options: SelectableDatasetOptions): boolean {
  return options.layout !== undefined
    || options.selectableSelections !== undefined
    || options.defaultSelectableSelections !== undefined
    || options.multiSelectableDimensionCode !== undefined;
}
