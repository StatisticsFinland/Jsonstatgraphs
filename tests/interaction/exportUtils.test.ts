import { buildExportFilename, downloadBlob, formatTimestamp, sanitizeFilenameBase } from '../../src/interaction/exportUtils';
import { JsonStatDataset } from '../../src/types';

function createDataset(label?: string): JsonStatDataset {
  return {
    label,
    id: ['A'],
    size: [1],
    dimension: {
      A: {
        category: { index: ['a'] },
      },
    },
    value: [1],
  };
}

describe('exportUtils', () => {
  it('sanitizeFilenameBase normalizes unsafe characters and whitespace', () => {
    expect(sanitizeFilenameBase('Population by Region / 2026')).toBe('Population_by_Region_2026');
  });

  it('sanitizeFilenameBase falls back to export when empty after sanitization', () => {
    expect(sanitizeFilenameBase('***')).toBe('export');
  });

  it('formatTimestamp renders local datetime as YYYYMMDD_HHMMSS', () => {
    const date = new Date(2026, 10, 5, 14, 30, 22);
    expect(formatTimestamp(date)).toBe('20261105_143022');
  });

  it('buildExportFilename uses sanitized dataset label and extension', () => {
    const dataset = createDataset('Population by Region');
    const filename = buildExportFilename(dataset, 'csv', new Date(2026, 10, 5, 14, 30, 22));
    expect(filename).toBe('Population_by_Region_20261105_143022.csv');
  });

  it('buildExportFilename falls back to export when dataset label is missing', () => {
    const dataset = createDataset(undefined);
    const filename = buildExportFilename(dataset, 'csv', new Date(2026, 10, 5, 14, 30, 22));
    expect(filename).toBe('export_20261105_143022.csv');
  });

  it('downloadBlob creates object URL, clicks temporary anchor and revokes URL', () => {
    const createObjectURLMock = jest.fn((_blob: Blob) => 'blob:test');
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
    const blob = new Blob(['hello'], { type: 'text/plain' });

    downloadBlob(blob, 'test.txt');

    expect(createObjectURLMock).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('test.txt');
    expect(anchor.href).toBe('blob:test');
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test');
  });
});
