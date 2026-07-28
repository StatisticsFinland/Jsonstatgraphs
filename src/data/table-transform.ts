import { JsonStatDataset, Layout, SelectableSelections, TableDimension, TableData } from '../types';
import { computeStrides, getOrderedCodes } from './dataset-utils';
import { rebuildDataset } from './rebuild-dataset';
import { hasSelectableDatasetOptions, resolveSelectableDatasetOptions } from './selectable-settings';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a map of dimension code → size from a dataset. */
function buildSizeMap(id: string[], size: number[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < id.length; i++) {
    map.set(id[i], size[i]);
  }
  return map;
}

/** Build a map of dimension code → index in dataset.id. */
function buildCodeIndexMap(id: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < id.length; i++) {
    map.set(id[i], i);
  }
  return map;
}

/**
 * Validates a manual TableLayout against the dataset.
 * Throws descriptive errors on unknown codes, overlapping codes, or un-placed
 * multi-value dimensions.
 * Returns the list of hidden dimension codes.
 */
function validateManualLayout(
  id: string[],
  sizeMap: Map<string, number>,
  layout: Layout
): string[] {
  for (const code of layout.rows) {
    if (!sizeMap.has(code)) {
      throw new Error(`[JsonStatChart] Unknown dimension code in tableLayout: "${code}"`);
    }
  }
  for (const code of layout.columns) {
    if (!sizeMap.has(code)) {
      throw new Error(`[JsonStatChart] Unknown dimension code in tableLayout: "${code}"`);
    }
  }

  const rowSet = new Set(layout.rows);
  for (const code of layout.columns) {
    if (rowSet.has(code)) {
      throw new Error(
        `[JsonStatChart] Dimension "${code}" appears in both rows and columns of tableLayout`
      );
    }
  }

  const seenRows = new Set<string>();
  for (const code of layout.rows) {
    if (seenRows.has(code)) {
      throw new Error(`[JsonStatChart] Duplicate dimension code in tableLayout.rows: "${code}"`);
    }
    seenRows.add(code);
  }

  const seenCols = new Set<string>();
  for (const code of layout.columns) {
    if (seenCols.has(code)) {
      throw new Error(`[JsonStatChart] Duplicate dimension code in tableLayout.columns: "${code}"`);
    }
    seenCols.add(code);
  }

  const mentioned = new Set([...layout.rows, ...layout.columns]);
  return id.filter(code => !mentioned.has(code));
}

/**
 * Automatically distributes active (size > 1) dimensions into rows and columns:
 *  - Time role → columns
 *  - Geo role → rows
 *  - Remaining sorted by size descending (tiebreak: earlier in id) and
 *    alternated largest→rows, next→columns, …
 */
function autoOrientDimensions(
  id: string[],
  sizeMap: Map<string, number>,
  timeDims: Set<string>,
  geoDims: Set<string>
): { rows: string[]; columns: string[] } {
  const timeCols: string[] = [];
  const geoRows: string[] = [];
  const remaining: string[] = [];

  for (const code of id) {
    if ((sizeMap.get(code) ?? 0) <= 1) continue;
    if (timeDims.has(code)) {
      timeCols.push(code);
    } else if (geoDims.has(code)) {
      geoRows.push(code);
    } else {
      remaining.push(code);
    }
  }

  remaining.sort((a, b) => {
    const diff = (sizeMap.get(b) ?? 0) - (sizeMap.get(a) ?? 0);
    return diff === 0 ? id.indexOf(a) - id.indexOf(b) : diff;
  });

  const rows: string[] = [...geoRows];
  const columns: string[] = [...timeCols];

  for (let i = 0; i < remaining.length; i++) {
    if (i % 2 === 0) {
      rows.push(remaining[i]);
    } else {
      columns.push(remaining[i]);
    }
  }

  return { rows, columns };
}

/**
 * Decodes a flat Cartesian-product index into per-dimension category indices.
 * Row-major ordering: last dimension varies fastest.
 */
function decodeCombo(comboIdx: number, sizes: number[]): number[] {
  const indices: number[] = new Array(sizes.length);
  let remaining = comboIdx;
  for (let i = sizes.length - 1; i >= 0; i--) {
    indices[i] = remaining % sizes[i];
    remaining = Math.floor(remaining / sizes[i]);
  }
  return indices;
}

/**
 * Builds the 2D values grid by iterating over all row x column combos and
 * resolving each flat dataset index.
 */
function buildValuesGrid(
  dataset: JsonStatDataset,
  rows: string[],
  columns: string[],
  codeToIdx: Map<string, number>,
  strides: number[]
): (number | null)[][] {
  const { id, value } = dataset;

  const rowSizes = rows.map(code => dataset.size[codeToIdx.get(code) ?? 0]);
  const colSizes = columns.map(code => dataset.size[codeToIdx.get(code) ?? 0]);

  const numRowCombos = rowSizes.reduce((acc, s) => acc * s, 1);
  const numColCombos = colSizes.reduce((acc, s) => acc * s, 1);

  const grid: (number | null)[][] = [];

  for (let r = 0; r < numRowCombos; r++) {
    const rowCatIndices = decodeCombo(r, rowSizes);
    const row: (number | null)[] = [];

    for (let c = 0; c < numColCombos; c++) {
      const colCatIndices = decodeCombo(c, colSizes);

      // Per-dimension category indices in dataset.id order; hidden dims stay 0.
      const dimCatIndices: number[] = new Array(id.length).fill(0);
      for (let ri = 0; ri < rows.length; ri++) {
        dimCatIndices[codeToIdx.get(rows[ri]) ?? 0] = rowCatIndices[ri];
      }
      for (let ci = 0; ci < columns.length; ci++) {
        dimCatIndices[codeToIdx.get(columns[ci]) ?? 0] = colCatIndices[ci];
      }

      let flatIdx = 0;
      for (let i = 0; i < id.length; i++) {
        flatIdx += dimCatIndices[i] * strides[i];
      }

      const v = value[flatIdx];
      row.push(v === null || typeof v === 'string' ? null : v);
    }

    grid.push(row);
  }

  return grid;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determines which dimensions go to rows, columns, or are hidden.
 *
 * **Manual path** (when `manualLayout` is provided):
 *  - Validates all codes exist in the dataset.
 *  - Validates no code appears in both rows and columns.
 *  - Any dimension not mentioned must have size 1 (hidden), otherwise throws.
 *
 * **Auto path:**
 *  - Size-1 dimensions → hidden.
 *  - Time role dimensions → columns.
 *  - Geo role dimensions → rows.
 *  - Remaining active dimensions sorted by size descending (tiebreak: earlier
 *    in `dataset.id` wins), then alternated: largest → rows, next → columns, …
 *  - If all dimensions are size 1, the last dimension in `dataset.id` is
 *    promoted to a single column so the table still has structure.
 */
export function computeTableOrientation(
  dataset: JsonStatDataset,
  manualLayout?: Layout
): { rows: string[]; columns: string[]; hidden: string[] } {
  const { id, size } = dataset;
  const sizeMap = buildSizeMap(id, size);

  if (manualLayout) {
    const hidden = validateManualLayout(id, sizeMap, manualLayout);
    return { rows: manualLayout.rows, columns: manualLayout.columns, hidden };
  }

  const hidden = id.filter((_, i) => size[i] === 1);
  const hasActiveDims = id.some((_, i) => size[i] > 1);

  // Edge case: all dims have size 1 → promote last dim to a single column.
  if (!hasActiveDims) {
    const lastCode = id.at(-1) ?? id[0];
    return {
      rows: [],
      columns: [lastCode],
      hidden: hidden.filter(c => c !== lastCode),
    };
  }

  const timeDims = new Set(dataset.role?.time ?? []);
  const geoDims = new Set(dataset.role?.geo ?? []);
  const { rows, columns } = autoOrientDimensions(id, sizeMap, timeDims, geoDims);

  return { rows, columns, hidden };
}

/**
 * Transforms a JSON-stat 2.0 dataset into a `TableData` structure suitable for
 * rendering as an N-dimensional pivot table.
 *
 *  1. Determines row/column/hidden orientation via `computeTableOrientation`.
 *  2. Builds `TableDimension` metadata for each placed dimension.
 *  3. Enumerates all row x column Cartesian-product combinations and looks up
 *     each cell value via the row-major stride formula over the original
 *     dimension order (hidden dims are fixed at category index 0).
 *  4. Collects hidden dimension metadata (label + single category label).
 */
export function transformTableData(
  dataset: JsonStatDataset,
  options?: {
    layout?: Layout;
    /** @deprecated Use layout. */
    tableLayout?: Layout;
    selectableSelections?: SelectableSelections;
    defaultSelectableSelections?: SelectableSelections;
    multiSelectableDimensionCode?: string;
  }
): TableData {
  const layout = options?.layout ?? options?.tableLayout;
  const selectableOptions = resolveSelectableDatasetOptions(dataset, { ...options, layout }, options?.selectableSelections);
  const activeDataset = hasSelectableDatasetOptions(selectableOptions)
    ? rebuildDataset(dataset, selectableOptions).dataset
    : dataset;
  const { id, size, dimension } = activeDataset;
  const { rows, columns, hidden } = computeTableOrientation(activeDataset, layout);

  const codeToIdx = buildCodeIndexMap(id);
  const strides = computeStrides(size);

  function getOrderedCategoryCodes(code: string): string[] {
    return getOrderedCodes(dimension[code].category.index);
  }

  function getDimLabel(code: string): string {
    return dimension[code].label ?? code;
  }

  function getCatLabel(dimCode: string, catCode: string): string {
    return dimension[dimCode].category.label?.[catCode] ?? catCode;
  }

  function buildTableDimension(code: string): TableDimension {
    const codes = getOrderedCategoryCodes(code);
    return {
      code,
      label: getDimLabel(code),
      categories: codes.map(catCode => ({ code: catCode, label: getCatLabel(code, catCode) })),
    };
  }

  const rowDimensions = rows.map(buildTableDimension);
  const columnDimensions = columns.map(buildTableDimension);
  const values = buildValuesGrid(activeDataset, rows, columns, codeToIdx, strides);

  const hiddenDimensions = hidden.map(code => {
    const codes = getOrderedCategoryCodes(code);
    const catCode = codes[0] ?? '';
    return { code, label: getDimLabel(code), value: getCatLabel(code, catCode) };
  });

  return { rowDimensions, columnDimensions, values, hiddenDimensions };
}
