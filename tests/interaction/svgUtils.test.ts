import {
  buildExportableSvg,
  exportSvg,
  findExportableSvg,
  serializeSvg,
  supportsSvgExport,
} from '../../src/interaction/svgUtils';
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

  it('builds exportable SVG with legend content when legend exists', () => {
    container.innerHTML = [
      '<svg width="120" height="90" viewBox="0 0 120 90"><rect width="120" height="90"/></svg>',
      '<div class="jsc-legend">',
      '  <button class="jsc-legend-item" style="opacity: 0.4; color: rgb(51, 51, 51);">',
      '    <span class="jsc-legend-swatch" style="display:inline-block;width:14px;height:14px;background: rgb(78, 121, 167);border-radius:2px;"></span>',
      '    <span style="text-decoration: line-through;">Series A</span>',
      '  </button>',
      '</div>',
    ].join('');

    const svg = container.querySelector('svg') as SVGSVGElement;
    const legend = container.querySelector('.jsc-legend') as HTMLElement;
    const item = container.querySelector('.jsc-legend-item') as HTMLElement;
    const swatch = container.querySelector('.jsc-legend-swatch') as HTMLElement;
    const label = item.querySelector('span:last-child') as HTMLElement;

    Object.defineProperty(svg, 'clientWidth', { value: 120, configurable: true });
    Object.defineProperty(svg, 'clientHeight', { value: 90, configurable: true });
    jest.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 120,
      height: 90,
      top: 0,
      right: 120,
      bottom: 90,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(legend, 'offsetHeight', { value: 20, configurable: true });
    jest.spyOn(legend, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 90,
      width: 120,
      height: 20,
      top: 90,
      right: 120,
      bottom: 110,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    jest.spyOn(item, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 90,
      width: 100,
      height: 16,
      top: 90,
      right: 100,
      bottom: 106,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    jest.spyOn(swatch, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 91,
      width: 14,
      height: 14,
      top: 91,
      right: 14,
      bottom: 105,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    jest.spyOn(label, 'getBoundingClientRect').mockReturnValue({
      x: 18,
      y: 90,
      width: 56,
      height: 16,
      top: 90,
      right: 74,
      bottom: 106,
      left: 18,
      toJSON: () => ({}),
    } as DOMRect);

    const exportableSvg = buildExportableSvg(container);
    expect(exportableSvg).not.toBeNull();
    expect(exportableSvg).not.toBe(svg);
    expect(exportableSvg?.querySelector('[data-jsc-export-legend="true"]')).not.toBeNull();
    expect(exportableSvg?.getAttribute('viewBox')).toBe('0 0 120 90');
    expect(exportableSvg?.getAttribute('height')).toBe('90');
    expect(exportableSvg?.getAttribute('width')).toBe('120');
    expect(exportableSvg?.querySelector('text')?.textContent).toBe('Series A');
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
