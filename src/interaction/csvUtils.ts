import { transformTableData } from '../data/table-transform';
import { rebuildDataset } from '../data/rebuild-dataset';
import { hasSelectableDatasetOptions, resolveSelectableDatasetOptions } from '../data/selectable-settings';
import { getLocaleStrings } from '../locale/strings';
import { JsonStatDataset } from '../types';
import { buildExportFilename, downloadBlob } from './exportUtils';
import { decodeCombo, getMetricUnit, product } from './exportTableUtils';
import { resolveDatasetSource } from '../data/source';

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
  const selectableOptions = resolveSelectableDatasetOptions(dataset);
  const activeDataset = hasSelectableDatasetOptions(selectableOptions)
    ? rebuildDataset(dataset, selectableOptions).dataset
    : dataset;
  const tableData = transformTableData(activeDataset, { layout: selectableOptions.layout });
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

  const unitLabel = getMetricUnit(activeDataset);
  if (unitLabel) {
    rows.push([`${strings.unit}: ${unitLabel}`]);
  }

  const source = resolveDatasetSource(activeDataset);
  if (source) {
    rows.push([`${strings.source}: ${source}`]);
  }

  return rows.map(row => renderCsvRow(row, delimiter, locale)).join('\n');
}

export function exportCsv(dataset: JsonStatDataset, locale: string): void {
  const csvContent = createCsvContent(dataset, locale);
  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, buildExportFilename(dataset, 'csv'));
}
