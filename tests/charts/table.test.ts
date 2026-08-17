import { createTableChart } from '../../src/charts/table';
import { TableData, ChartConfig } from '../../src/types';

// 2D table: Region (rows) × Year (columns)
const tableData2D: TableData = {
  rowDimensions: [
    {
      code: 'Region',
      label: 'Region',
      categories: [
        { code: 'HEL', label: 'Helsinki' },
        { code: 'TRE', label: 'Tampere' },
      ],
    },
  ],
  columnDimensions: [
    {
      code: 'Year',
      label: 'Year',
      categories: [
        { code: '2020', label: '2020' },
        { code: '2021', label: '2021' },
      ],
    },
  ],
  values: [
    [100000, 150000],
    [80000, null],
  ],
  hiddenDimensions: [],
};

// 3D table: Region (rows) × Year+Indicator (columns)
const tableData3D: TableData = {
  rowDimensions: [
    {
      code: 'Region',
      label: 'Region',
      categories: [
        { code: 'HEL', label: 'Helsinki' },
        { code: 'TRE', label: 'Tampere' },
      ],
    },
  ],
  columnDimensions: [
    {
      code: 'Year',
      label: 'Year',
      categories: [
        { code: '2020', label: '2020' },
        { code: '2021', label: '2021' },
      ],
    },
    {
      code: 'Indicator',
      label: 'Indicator',
      categories: [
        { code: 'pop', label: 'Population' },
        { code: 'area', label: 'Area' },
      ],
    },
  ],
  // 2 rows × 4 columns (2 years × 2 indicators)
  values: [
    [100, 50, 110, 52],
    [80, 30, 85, 31],
  ],
  hiddenDimensions: [],
};

// Single series (no row dims)
const singleDimData: TableData = {
  rowDimensions: [],
  columnDimensions: [
    {
      code: 'Year',
      label: 'Year',
      categories: [
        { code: '2020', label: '2020' },
        { code: '2021', label: '2021' },
      ],
    },
  ],
  values: [[1000, 2000]],
  hiddenDimensions: [{ code: 'Region', label: 'Region', value: 'Helsinki' }],
};

const scalarTableData: TableData = {
  rowDimensions: [],
  columnDimensions: [],
  values: [[42]],
  hiddenDimensions: [{ code: 'Measure', label: 'Measure', value: 'Value' }],
};

// 2 row dimensions: Region × Gender
const tableData2RowDim: TableData = {
  rowDimensions: [
    {
      code: 'Region',
      label: 'Region',
      categories: [
        { code: 'HEL', label: 'Helsinki' },
        { code: 'TRE', label: 'Tampere' },
      ],
    },
    {
      code: 'Gender',
      label: 'Gender',
      categories: [
        { code: 'M', label: 'Male' },
        { code: 'F', label: 'Female' },
      ],
    },
  ],
  columnDimensions: [
    {
      code: 'Year',
      label: 'Year',
      categories: [{ code: '2020', label: '2020' }],
    },
  ],
  values: [
    [100], // HEL + Male
    [110], // HEL + Female
    [80],  // TRE + Male
    [90],  // TRE + Female
  ],
  hiddenDimensions: [],
};

const defaultConfig: ChartConfig = {};

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => {
  container.remove();
});

describe('createTableChart', () => {
  // --- Basic rendering ---

  it('creates a table in the container', () => {
    createTableChart({ container, data: tableData2D, config: defaultConfig });
    const table = container.querySelector('table.jsc-table');
    expect(table).not.toBeNull();
  });

  it('renders a value header for scalar tables', () => {
    createTableChart({ container, data: scalarTableData, config: defaultConfig });
    const valueHeader = container.querySelector('thead th[scope="col"]');

    expect(valueHeader?.textContent).toBe('Value');
    expect(container.querySelectorAll('tbody td')).toHaveLength(1);
  });

  it('wraps table in scrollable div', () => {
    createTableChart({ container, data: tableData2D, config: defaultConfig });
    const wrapper = container.querySelector('div.jsc-table-wrapper');
    expect(wrapper).not.toBeNull();
    const scrollDiv = wrapper!.querySelector('div.jsc-table-scroll');
    expect(scrollDiv).not.toBeNull();
    expect((scrollDiv as HTMLElement).style.overflowX).toBe('auto');
  });

  it('reserves a taller burger menu row when the table has no heading content', () => {
    createTableChart({ container, data: tableData2D, config: defaultConfig, burgerMenuVisible: true });

    const heading = container.querySelector('div.jsc-table-heading') as HTMLElement;
    expect(heading).not.toBeNull();
    expect(heading.style.minHeight).toBe('3rem');
    expect(heading.style.paddingRight).toBe('3rem');
  });

  it('keeps the existing heading height when a title is present', () => {
    createTableChart({
      container,
      data: tableData2D,
      config: { ...defaultConfig, title: 'Table title' },
      burgerMenuVisible: true,
    });

    const heading = container.querySelector('div.jsc-table-heading') as HTMLElement;
    expect(heading.style.minHeight).toBe('2.5rem');
    expect(heading.style.paddingLeft).toBe('20px');
    expect(heading.style.marginBottom).toBe('8px');
  });

  it('correct number of body rows', () => {
    createTableChart({ container, data: tableData2D, config: defaultConfig });
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
  });

  it('correct number of body columns', () => {
    createTableChart({ container, data: tableData2D, config: defaultConfig });
    const rows = container.querySelectorAll('tbody tr');
    rows.forEach((row) => {
      expect(row.querySelectorAll('td').length).toBe(2);
    });
  });

  // --- Column headers (multi-level) ---

  it('single column dimension renders one header row', () => {
    createTableChart({ container, data: tableData2D, config: defaultConfig });
    const theadRows = container.querySelectorAll('thead tr');
    expect(theadRows.length).toBe(1);
    // corner (Region label) + 2020 + 2021
    expect(theadRows[0].querySelectorAll('th').length).toBe(3);
  });

  it('multi-level column headers with colspan', () => {
    createTableChart({ container, data: tableData3D, config: defaultConfig });
    const theadRows = container.querySelectorAll('thead tr');
    expect(theadRows.length).toBe(2);

    // First row: corner (rowspan=2) + 2020 (colspan=2) + 2021 (colspan=2)
    const firstRowThs = theadRows[0].querySelectorAll('th');
    expect(firstRowThs.length).toBe(3);
    expect(firstRowThs[1].getAttribute('colspan')).toBe('2');
    expect(firstRowThs[2].getAttribute('colspan')).toBe('2');

    // Second row: 4 Indicator headers (Population, Area, Population, Area)
    const secondRowThs = theadRows[1].querySelectorAll('th');
    expect(secondRowThs.length).toBe(4);
  });

  // --- Row headers ---

  it('row headers display category labels', () => {
    createTableChart({ container, data: tableData2D, config: defaultConfig });
    const rowHeaders = container.querySelectorAll('tbody th[scope="row"]');
    expect(rowHeaders[0].textContent).toBe('Helsinki');
    expect(rowHeaders[1].textContent).toBe('Tampere');
  });

  it('multi-level row headers with rowspan', () => {
    createTableChart({ container, data: tableData2RowDim, config: defaultConfig });
    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows.length).toBe(4);

    // Row 0: Helsinki (rowspan=2) + Male
    const row0Ths = bodyRows[0].querySelectorAll('th');
    expect(row0Ths.length).toBe(2);
    expect(row0Ths[0].textContent).toBe('Helsinki');
    expect(row0Ths[0].getAttribute('rowspan')).toBe('2');
    expect(row0Ths[1].textContent).toBe('Male');

    // Row 1: only Female (Helsinki spans from row 0)
    const row1Ths = bodyRows[1].querySelectorAll('th');
    expect(row1Ths.length).toBe(1);
    expect(row1Ths[0].textContent).toBe('Female');

    // Row 2: Tampere (rowspan=2) + Male
    const row2Ths = bodyRows[2].querySelectorAll('th');
    expect(row2Ths.length).toBe(2);
    expect(row2Ths[0].textContent).toBe('Tampere');
    expect(row2Ths[0].getAttribute('rowspan')).toBe('2');
  });

  // --- Data values ---

  it('displays null values as en dash', () => {
    createTableChart({ container, data: tableData2D, config: defaultConfig });
    const cells = container.querySelectorAll('tbody td');
    const texts = Array.from(cells).map((c) => c.textContent);
    expect(texts).toContain('\u2013');
  });

  it('formats numbers with locale', () => {
    const config: ChartConfig = { locale: 'en-US' };
    createTableChart({ container, data: tableData2D, config });
    const cells = container.querySelectorAll('tbody td');
    const texts = Array.from(cells).map((c) => c.textContent);
    expect(texts[0]).toBe((100000).toLocaleString('en-US'));
  });

  // --- Metadata ---

  it('renders title when provided', () => {
    const config: ChartConfig = { title: 'Population' };
    createTableChart({ container, data: tableData2D, config });
    const titleEl = container.querySelector('div.jsc-table-title');
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toBe('Population');
  });

  it('renders subtitle when provided', () => {
    const config: ChartConfig = { subtitle: 'By region' };
    createTableChart({ container, data: tableData2D, config });
    const subtitleEl = container.querySelector('div.jsc-table-subtitle');
    expect(subtitleEl).not.toBeNull();
    expect(subtitleEl!.textContent).toBe('By region');
  });

  it('wraps the title and ellipsizes the subtitle within the protected heading area', () => {
    const config: ChartConfig = { title: 'Population', subtitle: 'By region' };
    createTableChart({ container, data: tableData2D, config });

    const titleEl = container.querySelector('div.jsc-table-title') as HTMLElement;
    const subtitleEl = container.querySelector('div.jsc-table-subtitle') as HTMLElement;
    expect(titleEl.style.overflowWrap).toBe('break-word');
    expect(titleEl.style.whiteSpace).toBe('');
    expect(subtitleEl.style.textOverflow).toBe('ellipsis');
    expect(subtitleEl.style.whiteSpace).toBe('nowrap');
  });

  it('renders footer items', () => {
    const config: ChartConfig = {
      footerItems: [{ type: 'source', label: 'Source:', value: 'Statistics Finland' }],
    };
    createTableChart({ container, data: tableData2D, config });
    const footer = container.querySelector('.jsc-key-figure-footer');
    expect(footer).not.toBeNull();
  });

  // --- Caption (accessibility) ---

  it('renders visually hidden caption', () => {
    createTableChart({ container, data: tableData2D, config: defaultConfig });
    const caption = container.querySelector('caption');
    expect(caption).not.toBeNull();
    expect(caption!.style.clipPath).toBe('inset(50%)');
  });

  it('uses title as caption text', () => {
    const config: ChartConfig = { title: 'Pop' };
    createTableChart({ container, data: tableData2D, config });
    const caption = container.querySelector('caption');
    expect(caption!.textContent).toBe('Pop');
  });

  // --- ARIA ---

  it('applies role="region" to container', () => {
    createTableChart({ container, data: tableData2D, config: defaultConfig });
    expect(container.getAttribute('role')).toBe('region');
  });

  it('applies aria-label to container', () => {
    const config: ChartConfig = { ariaLabel: 'Population data' };
    createTableChart({ container, data: tableData2D, config });
    expect(container.getAttribute('aria-label')).toBe('Population data');
  });

  it('uses title as fallback aria-label', () => {
    const config: ChartConfig = { title: 'City populations' };
    createTableChart({ container, data: tableData2D, config });
    expect(container.getAttribute('aria-label')).toBe('City populations');
  });

  // --- Footer alignment ---

  it('footer items are left-aligned and stacked', () => {
    const config: ChartConfig = {
      footerItems: [
        { type: 'source', label: 'Source:', value: 'Statistics Finland' },
        { type: 'updated', label: 'Updated:', value: '2024-01-15' },
      ],
    };
    createTableChart({ container, data: tableData2D, config });
    const footer = container.querySelector('.jsc-key-figure-footer') as HTMLElement;
    expect(footer).not.toBeNull();
    expect(footer.style.flexDirection).toBe('column');
    expect(footer.style.alignItems).toBe('flex-start');
  });

  it('renders source as clickable link when sourceLink is provided', () => {
    const config: ChartConfig = {
      footerItems: [
        { type: 'source', label: 'Source:', value: 'Statistics Finland' },
      ],
      sourceLink: 'https://stat.fi',
    };
    createTableChart({ container, data: tableData2D, config });
    const link = container.querySelector('.jsc-key-figure-footer a') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.href).toBe('https://stat.fi/');
    expect(link.target).toBe('_blank');
    expect(link.textContent).toBe('Statistics Finland');
  });

  // --- Lifecycle ---

  it('destroy() removes wrapper', () => {
    const instance = createTableChart({ container, data: tableData2D, config: defaultConfig });
    instance.destroy();
    expect(container.querySelector('.jsc-table-wrapper')).toBeNull();
  });

  it('destroy() removes ARIA attributes', () => {
    const instance = createTableChart({ container, data: tableData2D, config: defaultConfig });
    instance.destroy();
    expect(container.getAttribute('role')).toBeNull();
    expect(container.getAttribute('aria-label')).toBeNull();
  });

  it('update() re-renders with new data', () => {
    const instance = createTableChart({ container, data: singleDimData, config: defaultConfig });
    // singleDimData: no row dims, 2 col categories → tbody has 1 row with 2 td
    expect(container.querySelectorAll('tbody td').length).toBe(2);

    instance.update(tableData2D);
    // tableData2D: 2 rows × 2 cols → 4 td total
    expect(container.querySelectorAll('tbody td').length).toBe(4);
  });

  it('update() preserves burger menu spacing from the chart config', () => {
    const instance = createTableChart({
      container,
      data: tableData2D,
      config: { ...defaultConfig, burgerMenuVisible: true },
    });

    instance.update(tableData2D);

    const heading = container.querySelector('div.jsc-table-heading') as HTMLElement;
    expect(heading.style.minHeight).toBe('3rem');
  });

  it('update() re-renders with new config', () => {
    const instance = createTableChart({ container, data: tableData2D, config: defaultConfig });
    expect(container.querySelector('caption')!.textContent).toBe('Data table');

    instance.update(tableData2D, { title: 'Updated title' });
    expect(container.querySelector('caption')!.textContent).toBe('Updated title');
  });

  // --- Corner cells ---

  it('corner cell has correct rowspan for multi-level column dimensions', () => {
    createTableChart({ container, data: tableData3D, config: defaultConfig });
    const firstTheadRow = container.querySelector('thead tr');
    const cornerTh = firstTheadRow!.querySelector('th');
    expect(cornerTh!.getAttribute('rowspan')).toBe('2');
    expect(cornerTh!.textContent).toBe('');
  });

  it('corner cell has correct colspan for multiple row dimensions', () => {
    createTableChart({ container, data: tableData2RowDim, config: defaultConfig });
    const firstTheadRow = container.querySelector('thead tr');
    const cornerTh = firstTheadRow!.querySelector('th');
    expect(cornerTh!.getAttribute('colspan')).toBe('2');
    expect(cornerTh!.textContent).toBe('');
  });

  // --- Fallback column header ---

  it('fallback data column header has textContent "Value"', () => {
    const rowOnlyData: TableData = {
      rowDimensions: [
        {
          code: 'Year',
          label: 'Year',
          categories: [
            { code: '2020', label: '2020' },
            { code: '2021', label: '2021' },
          ],
        },
      ],
      columnDimensions: [],
      values: [[100], [200]],
      hiddenDimensions: [],
    };
    createTableChart({ container, data: rowOnlyData, config: defaultConfig });
    const theadThs = container.querySelectorAll('thead tr th');
    // last th is the data column
    const dataTh = theadThs[theadThs.length - 1];
    expect(dataTh.textContent).toBe('Value');
  });

  // --- Scope attributes for spanning headers ---

  it('multi-level column headers use scope="colgroup" when colspan > 1', () => {
    createTableChart({ container, data: tableData3D, config: defaultConfig });
    const firstTheadRow = container.querySelector('thead tr');
    const ths = firstTheadRow!.querySelectorAll('th');
    // ths[1] and ths[2] are Year 2020 and 2021, each with colspan=2
    expect(ths[1].getAttribute('scope')).toBe('colgroup');
    expect(ths[2].getAttribute('scope')).toBe('colgroup');
  });

  it('single-category column headers keep scope="col"', () => {
    createTableChart({ container, data: tableData3D, config: defaultConfig });
    // Second thead row has Indicator headers, innerProduct=1 → scope="col"
    const theadRows = container.querySelectorAll('thead tr');
    const indicatorThs = theadRows[1].querySelectorAll('th');
    indicatorThs.forEach((th) => {
      expect(th.getAttribute('scope')).toBe('col');
    });
  });

  it('multi-level row headers use scope="rowgroup" when rowspan > 1', () => {
    const multiRowDimData: TableData = {
      rowDimensions: [
        {
          code: 'Region',
          label: 'Region',
          categories: [
            { code: 'HEL', label: 'Helsinki' },
            { code: 'TRE', label: 'Tampere' },
          ],
        },
        {
          code: 'Gender',
          label: 'Gender',
          categories: [
            { code: 'M', label: 'Male' },
            { code: 'F', label: 'Female' },
          ],
        },
      ],
      columnDimensions: [
        {
          code: 'Year',
          label: 'Year',
          categories: [{ code: '2020', label: '2020' }],
        },
      ],
      values: [[10], [20], [30], [40]],
      hiddenDimensions: [],
    };
    createTableChart({ container, data: multiRowDimData, config: defaultConfig });
    const bodyRows = container.querySelectorAll('tbody tr');

    // Row 0: Helsinki (rowspan=2 → rowgroup) + Male (rowspan=1 → row)
    const row0Ths = bodyRows[0].querySelectorAll('th');
    expect(row0Ths[0].getAttribute('scope')).toBe('rowgroup');
    expect(row0Ths[1].getAttribute('scope')).toBe('row');

    // Row 2: Tampere (rowspan=2 → rowgroup) + Male (rowspan=1 → row)
    const row2Ths = bodyRows[2].querySelectorAll('th');
    expect(row2Ths[0].getAttribute('scope')).toBe('rowgroup');
  });
});
