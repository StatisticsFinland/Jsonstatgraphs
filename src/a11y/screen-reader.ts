import { ChartData } from '../types';

export function createScreenReaderTable(
  container: HTMLElement,
  data: ChartData,
  caption?: string,
  locale?: string,
  categoryLabel?: string
): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'jsc-sr-only';

  // Visually-hidden styles (standard SR-only technique)
  table.style.position = 'absolute';
  table.style.width = '1px';
  table.style.height = '1px';
  table.style.padding = '0';
  table.style.margin = '-1px';
  table.style.overflow = 'hidden';
  table.style.clipPath = 'inset(50%)';
  table.style.whiteSpace = 'nowrap';
  table.style.border = '0';

  // <caption>
  const captionEl = document.createElement('caption');
  captionEl.textContent = caption ?? 'Data table';
  table.appendChild(captionEl);

  // <thead>
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  // Empty corner header for row-label column
  const cornerTh = document.createElement('th');
  cornerTh.setAttribute('scope', 'col');
  cornerTh.textContent = categoryLabel ?? 'Category';
  headerRow.appendChild(cornerTh);

  for (const series of data.series) {
    const th = document.createElement('th');
    th.setAttribute('scope', 'col');
    th.textContent = series.name;
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // <tbody>
  const tbody = document.createElement('tbody');

  for (let i = 0; i < data.categoryLabels.length; i++) {
    const tr = document.createElement('tr');

    const rowHeader = document.createElement('th');
    rowHeader.setAttribute('scope', 'row');
    rowHeader.textContent = data.categoryLabels[i];
    tr.appendChild(rowHeader);

    for (const series of data.series) {
      const td = document.createElement('td');
      const point = series.points[i];
      td.textContent = point?.value == null ? '\u2013' : point.value.toLocaleString(locale);
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.appendChild(table);

  return table;
}
