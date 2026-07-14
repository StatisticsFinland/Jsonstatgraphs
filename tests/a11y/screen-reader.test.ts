import { createScreenReaderTable } from '../../src/a11y/screen-reader';
import { ChartData } from '../../src/types';

const mockData: ChartData = {
  series: [
    {
      name: 'Sales',
      code: 'sales',
      points: [
        { value: 1000, label: 'Q1', categoryCode: 'q1' },
        { value: 2500, label: 'Q2', categoryCode: 'q2' },
        { value: null, label: 'Q3', categoryCode: 'q3' },
      ],
    },
    {
      name: 'Costs',
      code: 'costs',
      points: [
        { value: 800, label: 'Q1', categoryCode: 'q1' },
        { value: 1200, label: 'Q2', categoryCode: 'q2' },
        { value: 950, label: 'Q3', categoryCode: 'q3' },
      ],
    },
  ],
  categories: ['q1', 'q2', 'q3'],
  categoryLabels: ['Q1', 'Q2', 'Q3'],
};

describe('createScreenReaderTable', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('creates a table element in the container', () => {
    createScreenReaderTable(container, mockData);
    const table = container.querySelector('table.jsc-sr-only');
    expect(table).not.toBeNull();
  });

  it('table is visually hidden (sr-only styles)', () => {
    createScreenReaderTable(container, mockData);
    const table = container.querySelector('table.jsc-sr-only') as HTMLTableElement;
    expect(table.style.position).toBe('absolute');
    expect(table.style.width).toBe('1px');
    expect(table.style.clipPath).toBe('inset(50%)');
  });

  it('sets caption text', () => {
    createScreenReaderTable(container, mockData, 'Sales Data');
    const caption = container.querySelector('caption');
    expect(caption?.textContent).toBe('Sales Data');
  });

  it('uses default caption when none provided', () => {
    createScreenReaderTable(container, mockData);
    const caption = container.querySelector('caption');
    expect(caption?.textContent).toBe('Data table');
  });

  it('creates header row with series names', () => {
    createScreenReaderTable(container, mockData);
    const headerThs = container.querySelectorAll('thead th');
    const texts = Array.from(headerThs).map((th) => th.textContent);
    expect(texts).toContain('Sales');
    expect(texts).toContain('Costs');
  });

  it('creates body rows for each category', () => {
    createScreenReaderTable(container, mockData);
    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows.length).toBe(3);
  });

  it('row headers show category labels', () => {
    createScreenReaderTable(container, mockData);
    const rowHeaders = container.querySelectorAll('tbody th[scope="row"]');
    const texts = Array.from(rowHeaders).map((th) => th.textContent);
    expect(texts).toContain('Q1');
    expect(texts).toContain('Q2');
    expect(texts).toContain('Q3');
  });

  it('cells show numeric values', () => {
    createScreenReaderTable(container, mockData);
    // First body row, first data cell = Sales Q1 = 1000
    const firstRow = container.querySelector('tbody tr:first-child');
    const cells = firstRow?.querySelectorAll('td');
    expect(cells?.[0].textContent).toBe((1000).toLocaleString());
  });

  it('null values show dash', () => {
    createScreenReaderTable(container, mockData);
    // Third body row (Q3), first data cell = Sales Q3 = null
    const thirdRow = container.querySelector('tbody tr:nth-child(3)');
    const cells = thirdRow?.querySelectorAll('td');
    expect(cells?.[0].textContent).toBe('\u2013');
  });

  it('locale parameter formats numbers with toLocaleString', () => {
    const localeData: ChartData = {
      series: [
        {
          name: 'Values',
          code: 'values',
          points: [{ value: 1234567.89, label: 'A', categoryCode: 'a' }],
        },
      ],
      categories: ['a'],
      categoryLabels: ['A'],
    };
    createScreenReaderTable(container, localeData, 'Test', 'de-DE');
    const td = container.querySelector('tbody td') as HTMLTableCellElement;
    expect(td.textContent).toBe((1234567.89).toLocaleString('de-DE'));
  });

  it('corner th has default text "Category" when no categoryLabel provided', () => {
    createScreenReaderTable(container, mockData);
    const cornerTh = container.querySelector('thead th:first-child') as HTMLTableCellElement;
    expect(cornerTh.textContent).toBe('Category');
  });

  it('corner th uses provided categoryLabel', () => {
    createScreenReaderTable(container, mockData, undefined, undefined, 'Quarter');
    const cornerTh = container.querySelector('thead th:first-child') as HTMLTableCellElement;
    expect(cornerTh.textContent).toBe('Quarter');
  });

  it('returns the table element', () => {
    const result = createScreenReaderTable(container, mockData);
    const tableInDom = container.querySelector('table.jsc-sr-only');
    expect(result).toBe(tableInDom);
  });
});


