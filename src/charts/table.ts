import { TableData, ChartConfig, type ResolvedTheme } from '../types';
import { resolveTheme } from '../theme/theme';
import { renderHtmlFooter } from './footer';
import { getLocaleStrings } from '../locale/strings';

export interface TableChartConfig {
  container: HTMLElement;
  data: TableData;
  config: ChartConfig;
}

export interface TableChartInstance {
  update(data: TableData, config?: ChartConfig): void;
  destroy(): void;
}

function applyHeaderStyle(el: HTMLElement, theme: ResolvedTheme): void {
  el.style.border = `1px solid ${theme.colorBorder}`;
  el.style.padding = '6px 10px';
  el.style.fontWeight = String(theme.fontWeightBold);
  el.style.background = theme.colorBackground;
  el.style.textAlign = 'center';
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

function buildColumnDimRows(
  thead: HTMLTableSectionElement,
  data: TableData,
  colDimSizes: number[],
  theme: ResolvedTheme
): void {
  for (let level = 0; level < data.columnDimensions.length; level++) {
    const colDim = data.columnDimensions[level];
    const tr = document.createElement('tr');

    if (level === 0 && data.rowDimensions.length > 0) {
      const cornerTh = document.createElement('th');
      if (data.rowDimensions.length > 1) {
        cornerTh.setAttribute('colspan', String(data.rowDimensions.length));
      }
      if (data.columnDimensions.length > 1) {
        cornerTh.setAttribute('rowspan', String(data.columnDimensions.length));
      }
      applyHeaderStyle(cornerTh, theme);
      tr.appendChild(cornerTh);
    }

    const innerProduct = product(colDimSizes.slice(level + 1));
    const outerProduct = product(colDimSizes.slice(0, level));

    for (let rep = 0; rep < outerProduct; rep++) {
      for (const cat of colDim.categories) {
        const th = document.createElement('th');
        th.setAttribute('scope', innerProduct > 1 ? 'colgroup' : 'col');
        if (innerProduct > 1) {
          th.setAttribute('colspan', String(innerProduct));
        }
        th.className = 'jsc-table-header';
        th.textContent = cat.label;
        applyHeaderStyle(th, theme);
        tr.appendChild(th);
      }
    }

    thead.appendChild(tr);
  }
}

function buildFallbackThead(
  thead: HTMLTableSectionElement,
  data: TableData,
  theme: ResolvedTheme,
  locale?: string
): void {
  const tr = document.createElement('tr');
  if (data.rowDimensions.length > 0) {
    const cornerTh = document.createElement('th');
    if (data.rowDimensions.length > 1) {
      cornerTh.setAttribute('colspan', String(data.rowDimensions.length));
    }
    cornerTh.className = 'jsc-table-header';
    applyHeaderStyle(cornerTh, theme);
    tr.appendChild(cornerTh);
  }
  const strings = getLocaleStrings(locale);
  const dataTh = document.createElement('th');
  dataTh.setAttribute('scope', 'col');
  dataTh.className = 'jsc-table-header';
  dataTh.textContent = strings.tableValue;
  applyHeaderStyle(dataTh, theme);
  tr.appendChild(dataTh);
  thead.appendChild(tr);
}

function buildThead(table: HTMLTableElement, data: TableData, colDimSizes: number[], theme: ResolvedTheme, locale?: string): void {
  const thead = document.createElement('thead');
  if (data.columnDimensions.length > 0) {
    buildColumnDimRows(thead, data, colDimSizes, theme);
  } else if (data.rowDimensions.length > 0) {
    buildFallbackThead(thead, data, theme, locale);
  }
  if (thead.rows.length > 0) {
    table.appendChild(thead);
  }
}

function buildRowHeaderCells(tr: HTMLTableRowElement, rowIndex: number, data: TableData, rowDimSizes: number[], theme: ResolvedTheme): void {
  for (let level = 0; level < data.rowDimensions.length; level++) {
    const dim = data.rowDimensions[level];
    const innerProduct = product(rowDimSizes.slice(level + 1));

    if (rowIndex % innerProduct === 0) {
      const catIndex = Math.floor(rowIndex / innerProduct) % dim.categories.length;
      const th = document.createElement('th');
      th.setAttribute('scope', innerProduct > 1 ? 'rowgroup' : 'row');
      th.className = 'jsc-table-row-header';
      if (innerProduct > 1) {
        th.setAttribute('rowspan', String(innerProduct));
      }
      th.textContent = dim.categories[catIndex].label;
      applyHeaderStyle(th, theme);
      th.style.textAlign = 'left';
      tr.appendChild(th);
    }
  }
}

function buildTbody(table: HTMLTableElement, data: TableData, rowDimSizes: number[], totalRows: number, totalCols: number, config: ChartConfig, theme: ResolvedTheme): void {
  const tbody = document.createElement('tbody');

  for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
    const tr = document.createElement('tr');
    buildRowHeaderCells(tr, rowIndex, data, rowDimSizes, theme);

    const rowValues = data.values[rowIndex] ?? [];
    for (let colIndex = 0; colIndex < totalCols; colIndex++) {
      const td = document.createElement('td');
      td.className = 'jsc-table-cell';
      const val = rowValues[colIndex] ?? null;
      td.textContent = val === null ? '\u2013' : val.toLocaleString(config.locale);
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
  config: ChartConfig
): void {
  wrapper.innerHTML = '';

  // Focus ring style for source links
  const styleEl = document.createElement('style');
  styleEl.textContent =
    '.jsc-table-wrapper a:focus-visible { outline: 2px solid var(--jsc-color-focus-ring, #0066cc); outline-offset: 2px; }';
  wrapper.appendChild(styleEl);

  const theme = resolveTheme(wrapper.parentElement, config.theme);

  if (config.title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'jsc-table-title';
    titleEl.style.fontSize = theme.fontSizeTitle;
    titleEl.style.fontWeight = String(theme.fontWeightBold);
    titleEl.style.fontFamily = theme.fontFamily;
    titleEl.style.color = theme.colorText;
    titleEl.style.marginBottom = '8px';
    titleEl.textContent = config.title;
    wrapper.appendChild(titleEl);
  }

  if (config.subtitle) {
    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'jsc-table-subtitle';
    subtitleEl.style.fontSize = theme.fontSizeLabel;
    subtitleEl.style.fontWeight = String(theme.fontWeightNormal);
    subtitleEl.style.fontFamily = theme.fontFamily;
    subtitleEl.style.color = theme.colorTextSecondary;
    subtitleEl.style.marginBottom = '8px';
    subtitleEl.textContent = config.subtitle;
    wrapper.appendChild(subtitleEl);
  }

  const scrollDiv = document.createElement('div');
  scrollDiv.className = 'jsc-table-scroll';
  scrollDiv.style.overflowX = 'auto';

  const table = document.createElement('table');
  table.className = 'jsc-table';
  table.style.borderCollapse = 'collapse';
  table.style.width = '100%';
  table.style.fontFamily = theme.fontFamily;
  table.style.fontSize = theme.fontSizeLabel;
  table.style.color = theme.colorText;

  // Caption — visually hidden, for screen readers only
  const strings = getLocaleStrings(config.locale);
  const captionEl = document.createElement('caption');
  captionEl.textContent = config.title ?? config.ariaLabel ?? strings.tableCaption;
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

  buildThead(table, data, colDimSizes, theme, config.locale);
  buildTbody(table, data, rowDimSizes, totalRows, totalCols, config, theme);

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
  wrapper.style.paddingTop = 'var(--jsc-burger-menu-table-top-spacing, 0px)';
  container.appendChild(wrapper);

  const ariaLabel = config.ariaLabel ?? config.title ?? getLocaleStrings(config.locale).tableCaption;
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', ariaLabel);

  renderTable(wrapper, data, config);

  return {
    update(newData: TableData, newConfig?: ChartConfig): void {
      data = newData;
      if (newConfig !== undefined) config = newConfig;
      const label = config.ariaLabel ?? config.title ?? getLocaleStrings(config.locale).tableCaption;
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', label);
      renderTable(wrapper, data, config);
    },

    destroy(): void {
      wrapper.remove();
      container.removeAttribute('role');
      container.removeAttribute('aria-label');
    },
  };
}

