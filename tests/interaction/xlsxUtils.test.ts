import { createXlsxBytes, createXlsxBytesWithOptionalCompression, escapeXml, exportXlsx, toExcelColumnName } from '../../src/interaction/xlsxUtils';
import { JsonStatDataset } from '../../src/types';

const NativeBlob = globalThis.Blob;

function decodeUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

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
            POP: { label: 'persons & "people" <all>' },
          },
        },
      },
    },
    value: [1.5, 2.75],
    role: { time: ['Year'], metric: ['Content'] },
    ...overrides,
  };
}

describe('xlsxUtils', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      writable: true,
      value: NativeBlob,
    });
    jest.restoreAllMocks();
  });

  it('escapes XML reserved characters including apostrophe and quotes', () => {
    expect(escapeXml("5 < 7 & \"quoted\" 'text' >")).toBe('5 &lt; 7 &amp; &quot;quoted&quot; &apos;text&apos; &gt;');
  });

  it('strips XML-invalid control characters before escaping', () => {
    expect(escapeXml('a\u0000b\u0008c\u000Bd\u001Fe')).toBe('abcde');
  });

  it('creates Excel-style column names', () => {
    expect(toExcelColumnName(1)).toBe('A');
    expect(toExcelColumnName(26)).toBe('Z');
    expect(toExcelColumnName(27)).toBe('AA');
    expect(toExcelColumnName(52)).toBe('AZ');
    expect(toExcelColumnName(53)).toBe('BA');
  });

  it('creates XLSX ZIP bytes containing required OOXML entries and escaped text', () => {
    const dataset = createDataset();
    const bytes = createXlsxBytes(dataset, 'en');
    const asText = decodeUtf8(bytes);

    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(asText).toContain('[Content_Types].xml');
    expect(asText).toContain('_rels/.rels');
    expect(asText).toContain('xl/workbook.xml');
    expect(asText).toContain('xl/_rels/workbook.xml.rels');
    expect(asText).toContain('xl/worksheets/sheet1.xml');
    expect(asText).toContain('<sheet name="Sheet1" sheetId="1" r:id="rId1"/>');
    expect(asText).toContain('<c r="A1" t="inlineStr"><is><t>Population by Region</t></is></c>');
    expect(asText).toContain('<c r="A2" t="inlineStr"><is><t>2020</t></is></c>');
    expect(asText).toContain('<c r="A3"><v>1.5</v></c>');
    expect(asText).toContain('Unit: persons &amp; &quot;people&quot; &lt;all&gt;');
    expect(asText).toContain('Source: Statistics Finland');
  });

  it('creates XLSX bytes with optional compression path and valid ZIP signature', async () => {
    const dataset = createDataset();
    const bytes = await createXlsxBytesWithOptionalCompression(dataset, 'en');

    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it('creates worksheet values with empty output cell for null dataset values', () => {
    const dataset = createDataset({ value: [1.5, null] });
    const asText = decodeUtf8(createXlsxBytes(dataset, 'en'));

    expect(asText).toContain('<c r="A3"><v>1.5</v></c>');
    expect(asText).not.toContain('<c r="B3"><v>');
  });

  it('exportXlsx creates spreadsheet blob and triggers download with xlsx extension', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-05T14:30:22'));

    const blobCtor = jest.fn((parts: BlobPart[], options?: BlobPropertyBag) => ({ parts, type: options?.type } as unknown as Blob));
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      writable: true,
      value: blobCtor,
    });

    const createObjectURLMock = jest.fn((_blob: Blob) => 'blob:xlsx');
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

    await exportXlsx(createDataset(), 'en');

    expect(blobCtor).toHaveBeenCalledTimes(1);
    expect(blobCtor.mock.calls[0][1]).toEqual({
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:xlsx');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('Population_by_Region_20261105_143022.xlsx');

    jest.useRealTimers();
  });
});
