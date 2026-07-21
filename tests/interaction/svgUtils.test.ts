import { exportSvg, findExportableSvg, serializeSvg, supportsSvgExport } from '../../src/interaction/svgUtils';
import { JsonStatDataset } from '../../src/types';

const NativeBlob = globalThis.Blob;

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

describe('svgUtils', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      writable: true,
      value: NativeBlob,
    });
    jest.restoreAllMocks();
  });

  it('supports SVG export for chart types except table and keyFigure', () => {
    expect(supportsSvgExport('line')).toBe(true);
    expect(supportsSvgExport('map')).toBe(true);
    expect(supportsSvgExport('table')).toBe(false);
    expect(supportsSvgExport('keyFigure')).toBe(false);
  });

  it('finds first SVG element in container', () => {
    container.innerHTML = '<div><svg id="one"></svg><svg id="two"></svg></div>';
    const svg = findExportableSvg(container);
    expect(svg).not.toBeNull();
    expect(svg?.id).toBe('one');
  });

  it('serializes SVG element using XMLSerializer', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');

    const result = serializeSvg(svg);
    expect(result).toContain('<svg');
    expect(result).toContain('viewBox="0 0 100 100"');
  });

  it('returns false when chart type does not support SVG export', () => {
    const dataset = createDataset('Population');
    container.innerHTML = '<svg></svg>';

    const result = exportSvg(container, dataset, 'table');
    expect(result).toBe(false);
  });

  it('returns false when no SVG exists in container', () => {
    const dataset = createDataset('Population');

    const result = exportSvg(container, dataset, 'line');
    expect(result).toBe(false);
  });

  it('creates SVG blob and triggers download when export succeeds', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-05T14:30:22'));

    const blobCtor = jest.fn((parts: BlobPart[], options?: BlobPropertyBag) => ({ parts, type: options?.type } as unknown as Blob));
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      writable: true,
      value: blobCtor,
    });

    const createObjectURLMock = jest.fn((_blob: Blob) => 'blob:svg');
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
    container.innerHTML = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';

    const result = exportSvg(container, createDataset('Population by Region'), 'line');

    expect(result).toBe(true);
    expect(blobCtor).toHaveBeenCalledTimes(1);
    const blobParts = blobCtor.mock.calls[0][0] as BlobPart[];
    expect(String(blobParts[0])).toContain('<svg');

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:svg');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('Population_by_Region_20261105_143022.svg');

    jest.useRealTimers();
  });
});
