import { transformTableData } from '../data/table-transform';
import { getLocaleStrings } from '../locale/strings';
import { JsonStatDataset } from '../types';
import { buildExportFilename, downloadBlob } from './exportUtils';

function product(values: number[]): number {
  return values.reduce((acc, v) => acc * v, 1);
}

function decodeCombo(comboIdx: number, sizes: number[]): number[] {
  const indices: number[] = new Array(sizes.length);
  let remaining = comboIdx;
  for (let i = sizes.length - 1; i >= 0; i--) {
    indices[i] = remaining % sizes[i];
    remaining = Math.floor(remaining / sizes[i]);
  }
  return indices;
}

export function quoteCsv(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

export function getCsvDelimiter(locale?: string): string {
  const lang = locale?.substring(0, 2).toLowerCase();
  return lang === 'fi' || lang === 'sv' ? ';' : ',';
}

export function formatNumericCsvValue(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { useGrouping: false }).format(value);
}

export function getMetricUnit(dataset: JsonStatDataset): string | null {
  const metricCodes = dataset.role?.metric ?? dataset.id;
  for (const dimCode of metricCodes) {
    const dim = dataset.dimension[dimCode];
    if (!dim?.category?.unit) continue;
    const unitEntries = Object.values(dim.category.unit);
    const unitLabel = unitEntries.find(entry => entry?.label)?.label;
    if (unitLabel) return unitLabel;
  }
  return null;
}

export function renderCsvRow(cells: (string | number | null | undefined)[], delimiter: string, locale?: string): string {
  return cells
    .map(cell => {
      if (cell === null || cell === undefined || cell === '') return '';
      if (typeof cell === 'number') return formatNumericCsvValue(cell, locale);
      return quoteCsv(cell);
    })
    .join(delimiter);
}

export function createCsvContent(dataset: JsonStatDataset, locale: string): string {
  const strings = getLocaleStrings(locale);
  const delimiter = getCsvDelimiter(locale);
  const tableData = transformTableData(dataset);
  const rows: (string | number | null)[][] = [];

  rows.push([dataset.label ?? '']);

  const rowDims = tableData.rowDimensions;
  const colDims = tableData.columnDimensions;
  const colDimSizes = colDims.map(dim => dim.categories.length);

  for (let level = 0; level < colDims.length; level++) {
    const row: (string | number | null)[] = new Array(rowDims.length).fill('');
    const innerProduct = product(colDimSizes.slice(level + 1));
    const outerProduct = product(colDimSizes.slice(0, level));
    for (let outer = 0; outer < outerProduct; outer++) {
      for (const cat of colDims[level].categories) {
        for (let repeat = 0; repeat < innerProduct; repeat++) {
          row.push(cat.label);
        }
      }
    }
    rows.push(row);
  }

  const rowDimSizes = rowDims.map(dim => dim.categories.length);
  const totalRows = product(rowDimSizes);
  const totalCols = product(colDimSizes);

  for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
    const rowIndices = decodeCombo(rowIndex, rowDimSizes);
    const row: (string | number | null)[] = [];

    for (let dimIndex = 0; dimIndex < rowDims.length; dimIndex++) {
      const category = rowDims[dimIndex].categories[rowIndices[dimIndex]];
      row.push(category?.label ?? '');
    }

    const rowValues = tableData.values[rowIndex] ?? [];
    for (let colIndex = 0; colIndex < totalCols; colIndex++) {
      row.push(rowValues[colIndex]);
    }

    rows.push(row);
  }

  const unitLabel = getMetricUnit(dataset);
  if (unitLabel) {
    rows.push([`${strings.unit}: ${unitLabel}`]);
  }

  if (dataset.source) {
    rows.push([`${strings.source}: ${dataset.source}`]);
  }

  return rows.map(row => renderCsvRow(row, delimiter, locale)).join('\n');
}

export function exportCsv(dataset: JsonStatDataset, locale: string): void {
  const csvContent = createCsvContent(dataset, locale);
  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, buildExportFilename(dataset, 'csv'));
}
