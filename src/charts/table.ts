import { TableData, ChartConfig, type ResolvedTheme } from '../types';
import { resolveTheme } from '../theme/theme';
import { renderHtmlFooter } from './footer';
import { getLocaleStrings } from '../locale/strings';

export interface TableChartConfig {
  container: HTMLElement;
  data: TableData;
  config: ChartConfig;
  burgerMenuVisible?: boolean;
}

export interface TableChartInstance {
  update(data: TableData, config?: ChartConfig): void;
  destroy(): void;
}

let tableIdCounter = 0;

function applyHeaderStyle(el: HTMLElement, theme: ResolvedTheme): void {
  el.style.border = `1px solid ${theme.colorBorder}`;
  el.style.padding = '6px 10px';
  el.style.fontWeight = String(theme.fontWeightBold);
  el.style.background = theme.colorBackground;
  el.style.textAlign = 'center';
  el.style.overflowWrap = 'anywhere';
}

function applyCellStyle(el: HTMLElement, theme: ResolvedTheme): void {
  el.style.border = `1px solid ${theme.colorBorder}`;
  el.style.padding = '6px 10px';
  el.style.textAlign = 'right';
}

/** Returns the product of an array of numbers (empty product = 1). */
function product(values: number[]): number {
  return values.reduce((acc, v) => acc * v, 1);
}

function appendCornerHeader(
  row: HTMLTableRowElement,
  rowDimensionCount: number,
  columnDimensionCount: number,
  theme: ResolvedTheme,
): void {
  const cornerHeader = document.createElement('td');
  if (rowDimensionCount > 1) {
    cornerHeader.colSpan = rowDimensionCount;
  }
  if (columnDimensionCount > 1) {
    cornerHeader.rowSpan = columnDimensionCount;
  }
  applyHeaderStyle(cornerHeader, theme);
  row.appendChild(cornerHeader);
}

interface ColumnHeaderBuildOptions {
  row: HTMLTableRowElement;
  columnDimension: TableData['columnDimensions'][number];
  level: number;
  innerProduct: number;
  outerProduct: number;
  tableId: string;
  theme: ResolvedTheme;
  columnHeaderIds: string[][];
}

function appendColumnHeaders(options: ColumnHeaderBuildOptions): void {
  const { row, columnDimension, level, innerProduct, outerProduct, tableId, theme, columnHeaderIds } = options;
  for (let repetition = 0; repetition < outerProduct; repetition++) {
    for (let categoryIndex = 0; categoryIndex < columnDimension.categories.length; categoryIndex++) {
      const category = columnDimension.categories[categoryIndex];
      const header = document.createElement('th');
      const headerId = `${tableId}-col-${level}-${repetition}-${categoryIndex}`;
      header.id = headerId;
      if (innerProduct === 1) header.scope = 'col';
      if (innerProduct > 1) header.colSpan = innerProduct;
      header.className = 'jsc-table-header';
      header.textContent = category.label;
      applyHeaderStyle(header, theme);
      row.appendChild(header);

      const startColumn = (repetition * columnDimension.categories.length + categoryIndex) * innerProduct;
      for (let offset = 0; offset < innerProduct; offset++) {
        columnHeaderIds[startColumn + offset].push(headerId);
      }
    }
  }
}

function buildColumnDimRows(
  thead: HTMLTableSectionElement,
  data: TableData,
  colDimSizes: number[],
  theme: ResolvedTheme,
  tableId: string,
): string[][] {
  const columnHeaderIds = Array.from({ length: product(colDimSizes) }, () => [] as string[]);
  for (let level = 0; level < data.columnDimensions.length; level++) {
    const colDim = data.columnDimensions[level];
    const tr = document.createElement('tr');

    if (level === 0 && data.rowDimensions.length > 0) {
      appendCornerHeader(tr, data.rowDimensions.length, data.columnDimensions.length, theme);
    }

    const innerProduct = product(colDimSizes.slice(level + 1));
    const outerProduct = product(colDimSizes.slice(0, level));
    appendColumnHeaders({
      row: tr,
      columnDimension: colDim,
      level,
      innerProduct,
      outerProduct,
      tableId,
      theme,
      columnHeaderIds,
    });

    thead.appendChild(tr);
  }
  return columnHeaderIds;
}

function buildFallbackThead(
  thead: HTMLTableSectionElement,
  data: TableData,
  theme: ResolvedTheme,
  tableId: string,
  locale?: string
): string[][] {
  const tr = document.createElement('tr');
  if (data.rowDimensions.length > 0) {
    const cornerTh = document.createElement('td');
    if (data.rowDimensions.length > 1) {
      cornerTh.setAttribute('colspan', String(data.rowDimensions.length));
    }
    cornerTh.className = 'jsc-table-header';
    applyHeaderStyle(cornerTh, theme);
    tr.appendChild(cornerTh);
  }
  const strings = getLocaleStrings(locale);
  const dataTh = document.createElement('th');
  dataTh.id = `${tableId}-value`;
  dataTh.setAttribute('scope', 'col');
  dataTh.className = 'jsc-table-header';
  dataTh.textContent = strings.tableValue;
  applyHeaderStyle(dataTh, theme);
  tr.appendChild(dataTh);
  thead.appendChild(tr);
  return [[dataTh.id]];
}

function buildThead(table: HTMLTableElement, data: TableData, colDimSizes: number[], theme: ResolvedTheme, tableId: string, locale?: string): string[][] {
  const thead = document.createElement('thead');
  const columnHeaderIds = data.columnDimensions.length > 0
    ? buildColumnDimRows(thead, data, colDimSizes, theme, tableId)
    : buildFallbackThead(thead, data, theme, tableId, locale);
  if (thead.rows.length > 0) {
    table.appendChild(thead);
  }
  return columnHeaderIds;
}

function buildRowHeaderCells(tr: HTMLTableRowElement, rowIndex: number, data: TableData, rowDimSizes: number[], theme: ResolvedTheme, tableId: string, rowHeaderIds: string[][]): void {
  for (let level = 0; level < data.rowDimensions.length; level++) {
    const dim = data.rowDimensions[level];
    const innerProduct = product(rowDimSizes.slice(level + 1));

    if (rowIndex % innerProduct === 0) {
      const catIndex = Math.floor(rowIndex / innerProduct) % dim.categories.length;
      const th = document.createElement('th');
      const headerId = `${tableId}-row-${level}-${rowIndex}`;
      th.id = headerId;
      if (innerProduct === 1) {
        th.setAttribute('scope', 'row');
      }
      th.className = 'jsc-table-row-header';
      if (innerProduct > 1) {
        th.setAttribute('rowspan', String(innerProduct));
      }
      th.textContent = dim.categories[catIndex].label;
      applyHeaderStyle(th, theme);
      th.style.textAlign = 'left';
      tr.appendChild(th);

      for (let offset = 0; offset < innerProduct && rowIndex + offset < rowHeaderIds.length; offset++) {
        rowHeaderIds[rowIndex + offset].push(headerId);
      }
    }
  }
}

interface TbodyBuildOptions {
  table: HTMLTableElement;
  data: TableData;
  rowDimSizes: number[];
  totalRows: number;
  totalCols: number;
  columnHeaderIds: string[][];
  tableId: string;
  config: ChartConfig;
  theme: ResolvedTheme;
}

function buildTbody(options: TbodyBuildOptions): void {
  const { table, data, rowDimSizes, totalRows, totalCols, columnHeaderIds, tableId, config, theme } = options;
  const tbody = document.createElement('tbody');
  const rowHeaderIds = Array.from({ length: totalRows }, () => [] as string[]);

  for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
    const tr = document.createElement('tr');
    buildRowHeaderCells(tr, rowIndex, data, rowDimSizes, theme, tableId, rowHeaderIds);

    const rowValues = data.values[rowIndex] ?? [];
    for (let colIndex = 0; colIndex < totalCols; colIndex++) {
      const td = document.createElement('td');
      td.className = 'jsc-table-cell';
      const headerIds = [...rowHeaderIds[rowIndex], ...(columnHeaderIds[colIndex] ?? [])];
      if (headerIds.length > 0) {
        td.setAttribute('headers', headerIds.join(' '));
      }
      const val = rowValues[colIndex] ?? null;
      td.textContent = val === null
        ? (data.missingValueDescriptions?.[rowIndex]?.[colIndex] ?? '\u2013')
        : val.toLocaleString(config.locale);
      applyCellStyle(td, theme);
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
}

function renderTable(
  wrapper: HTMLDivElement,
  data: TableData,
  config: ChartConfig,
  burgerMenuVisible = false,
): void {
  wrapper.innerHTML = '';
  const tableId = `jsc-table-${++tableIdCounter}`;

  // Focus ring style for source links
  const styleEl = document.createElement('style');
  styleEl.textContent =
    '.jsc-table-wrapper a:focus-visible { outline: 2px solid var(--jsc-color-focus-ring, #0066cc); outline-offset: 2px; }';
  wrapper.appendChild(styleEl);

  const theme = resolveTheme(wrapper.parentElement, config.theme);

  const headerEl = document.createElement('div');
  headerEl.className = 'jsc-table-heading';
  headerEl.style.boxSizing = 'border-box';
  const hasHeaderContent = Boolean(config.title?.trim() || config.subtitle?.trim());
  headerEl.style.minHeight = burgerMenuVisible && !hasHeaderContent ? '3rem' : '2.5rem';
  headerEl.style.paddingLeft = '20px';
  headerEl.style.paddingRight = '3rem';
  headerEl.style.marginBottom = '8px';
  headerEl.style.display = 'flex';
  headerEl.style.flexDirection = 'column';
  headerEl.style.justifyContent = 'center';
  headerEl.style.gap = '4px';

  if (config.title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'jsc-table-title';
    titleEl.setAttribute('aria-hidden', 'true');
    titleEl.style.fontSize = theme.fontSizeTitle;
    titleEl.style.fontWeight = String(theme.fontWeightBold);
    titleEl.style.fontFamily = theme.fontFamily;
    titleEl.style.color = theme.colorText;
    titleEl.style.overflowWrap = 'break-word';
    titleEl.textContent = config.title;
    headerEl.appendChild(titleEl);
  }

  if (config.subtitle) {
    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'jsc-table-subtitle';
    subtitleEl.style.fontSize = theme.fontSizeLabel;
    subtitleEl.style.fontWeight = String(theme.fontWeightNormal);
    subtitleEl.style.fontFamily = theme.fontFamily;
    subtitleEl.style.color = theme.colorTextSecondary;
    subtitleEl.style.overflowWrap = 'break-word';
    subtitleEl.textContent = config.subtitle;
    headerEl.appendChild(subtitleEl);
  }

  wrapper.appendChild(headerEl);

  const scrollDiv = document.createElement('div');
  scrollDiv.className = 'jsc-table-scroll';
  scrollDiv.style.overflowX = 'auto';

  const table = document.createElement('table');
  table.id = tableId;
  table.className = 'jsc-table';
  table.style.borderCollapse = 'collapse';
  table.style.width = '100%';
  table.style.fontFamily = theme.fontFamily;
  table.style.fontSize = theme.fontSizeLabel;
  table.style.color = theme.colorText;

  // Caption — visually hidden, for screen readers only
  const strings = getLocaleStrings(config.locale);
  const captionEl = document.createElement('caption');
  captionEl.textContent = config.ariaLabel ?? config.title ?? strings.tableCaption;
  captionEl.style.captionSide = 'top';
  captionEl.style.position = 'absolute';
  captionEl.style.width = '1px';
  captionEl.style.height = '1px';
  captionEl.style.overflow = 'hidden';
  captionEl.style.clipPath = 'inset(50%)';
  captionEl.style.whiteSpace = 'nowrap';
  table.appendChild(captionEl);

  const rowDimSizes = data.rowDimensions.map((d) => d.categories.length);
  const colDimSizes = data.columnDimensions.map((d) => d.categories.length);
  const totalRows = product(rowDimSizes);
  const totalCols = product(colDimSizes);

  const columnHeaderIds = buildThead(table, data, colDimSizes, theme, tableId, config.locale);
  buildTbody({ table, data, rowDimSizes, totalRows, totalCols, columnHeaderIds, tableId, config, theme });

  scrollDiv.appendChild(table);
  wrapper.appendChild(scrollDiv);

  if (config.footerItems && config.footerItems.length > 0) {
    renderHtmlFooter({
      parent: wrapper,
      footerItems: config.footerItems,
      sourceLink: config.sourceLink,
      theme,
      align: 'left',
    });
  }
}

export function createTableChart(chartConfig: TableChartConfig): TableChartInstance {
  const { container } = chartConfig;
  let data = chartConfig.data;
  let config = chartConfig.config;

  const wrapper = document.createElement('div');
  wrapper.className = 'jsc-table-wrapper';
  container.appendChild(wrapper);

  renderTable(wrapper, data, config, config.burgerMenuVisible ?? chartConfig.burgerMenuVisible);

  return {
    update(newData: TableData, newConfig?: ChartConfig): void {
      data = newData;
      if (newConfig !== undefined) config = newConfig;
      renderTable(wrapper, data, config, config.burgerMenuVisible ?? chartConfig.burgerMenuVisible);
    },

    destroy(): void {
      wrapper.remove();
      container.removeAttribute('role');
      container.removeAttribute('aria-label');
      container.removeAttribute('aria-labelledby');
      container.removeAttribute('aria-roledescription');
    },
  };
}

