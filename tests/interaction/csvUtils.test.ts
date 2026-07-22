import {
  createCsvContent,
  exportCsv,
  formatNumericCsvValue,
  getCsvDelimiter,
  quoteCsv,
  renderCsvRow,
} from '../../src/interaction/csvUtils';
import { getMetricUnit, product } from '../../src/interaction/exportTableUtils';
import { JsonStatDataset } from '../../src/types';

const NativeBlob = globalThis.Blob;

function createDataset(overrides?: Partial<JsonStatDataset>): JsonStatDataset {
  return {
    label: 'Population by Region',
    source: 'Statistics Finland',
    id: ['Region', 'Year', 'Content'],
    size: [1, 2, 1],
    dimension: {
      Region: {
        label: 'Region',
        category: {
          index: ['HEL'],
          label: { HEL: 'Helsinki' },
        },
      },
      Year: {
        label: 'Year',
        category: {
          index: ['2020', '2021'],
          label: { '2020': '2020', '2021': '2021' },
        },
      },
      Content: {
        label: 'Content',
        category: {
          index: ['POP'],
          label: { POP: 'Population' },
          unit: {
            POP: { label: 'persons' },
          },
        },
      },
    },
    value: [1.5, 2.75],
    role: { time: ['Year'], metric: ['Content'] },
    ...overrides,
  };
}

describe('csvUtils', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      writable: true,
      value: NativeBlob,
    });
    jest.restoreAllMocks();
  });

  it('quotes CSV string values and escapes inner quotes', () => {
    expect(quoteCsv('value')).toBe('"value"');
    expect(quoteCsv('a "quoted" value')).toBe('"a ""quoted"" value"');
  });

  it('chooses semicolon delimiter for fi/sv and comma otherwise', () => {
    expect(getCsvDelimiter('fi')).toBe(';');
    expect(getCsvDelimiter('sv-SE')).toBe(';');
    expect(getCsvDelimiter('en')).toBe(',');
    expect(getCsvDelimiter()).toBe(',');
  });

  it('formats numeric values using locale without grouping', () => {
    expect(formatNumericCsvValue(1234.5, 'en')).toBe('1234.5');
    expect(formatNumericCsvValue(1234.5, 'fi')).toBe('1234,5');
  });

  it('resolves metric unit from dataset', () => {
    expect(getMetricUnit(createDataset())).toBe('persons');
    expect(getMetricUnit(createDataset({ role: { metric: ['Missing'] } }))).toBeNull();
  });

  it('renders CSV row with empty cells, quoted text and localized numeric output', () => {
    const row = renderCsvRow(['A', '', null, undefined, 1.5], ';', 'fi');
    expect(row).toBe('"A";;;;1,5');
  });

  it('creates CSV content with title, headers, data, unit row and source row', () => {
    const csv = createCsvContent(createDataset(), 'fi');
    expect(csv).toContain('"Population by Region"');
    expect(csv).toContain('"2020";"2021"');
    expect(csv).toContain('1,5;2,75');
    expect(csv).toContain('"Yksikkö: persons"');
    expect(csv).toContain('"Lähde: Statistics Finland"');
  });

  it('renders empty output cells for null values in dataset data', () => {
    const csv = createCsvContent(createDataset({ value: [1.5, null] }), 'en');
    expect(csv).toContain('1.5,');
  });

  it('returns one for product of an empty array', () => {
    expect(product([])).toBe(1);
  });

  it('exportCsv creates UTF-8 BOM blob and triggers download with csv extension', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-05T14:30:22'));

    const blobCtor = jest.fn((parts: BlobPart[], options?: BlobPropertyBag) => ({ parts, type: options?.type } as unknown as Blob));
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      writable: true,
      value: blobCtor,
    });

    const createObjectURLMock = jest.fn((_blob: Blob) => 'blob:csv');
    const revokeObjectURLMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });

    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    exportCsv(createDataset(), 'en');

    expect(blobCtor).toHaveBeenCalledTimes(1);
    const blobParts = blobCtor.mock.calls[0][0] as BlobPart[];
    expect(blobParts[0]).toBe('\uFEFF');

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:csv');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('Population_by_Region_20261105_143022.csv');

    jest.useRealTimers();
  });
});
