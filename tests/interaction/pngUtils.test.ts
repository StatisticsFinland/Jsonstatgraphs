import { exportPng } from '../../src/interaction/pngUtils';
import { JsonStatDataset } from '../../src/types';

const NativeImage = globalThis.Image;

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

describe('pngUtils', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      writable: true,
      value: NativeImage,
    });
    jest.restoreAllMocks();
  });

  it('returns false when chart type does not support PNG export', async () => {
    container.innerHTML = '<svg width="100" height="80"></svg>';
    await expect(exportPng(container, createDataset('Population'), 'table')).resolves.toBe(false);
  });

  it('returns false when no SVG exists in container', async () => {
    await expect(exportPng(container, createDataset('Population'), 'line')).resolves.toBe(false);
  });

  it('returns false when SVG dimensions are invalid', async () => {
    container.innerHTML = '<svg></svg>';
    await expect(exportPng(container, createDataset('Population'), 'line')).resolves.toBe(false);
  });

  it('returns false when image loading fails and revokes temporary SVG URL', async () => {
    const createObjectURLMock = jest.fn((_blob: Blob) => 'blob:svg-temp');
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

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onerror?.();
      }
    }

    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      writable: true,
      value: MockImage,
    });

    container.innerHTML = '<svg width="100" height="80"></svg>';

    await expect(exportPng(container, createDataset('Population by Region'), 'line')).resolves.toBe(false);
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:svg-temp');
  });

  it('rasterizes SVG to canvas and downloads PNG when export succeeds', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-05T14:30:22'));

    const drawImage = jest.fn();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage } as unknown as CanvasRenderingContext2D));
    jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback) => {
      callback(new Blob(['png-data'], { type: 'image/png' }));
    });

    const createObjectURLMock = jest.fn((_blob: Blob) => 'blob:url');
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

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    }

    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      writable: true,
      value: MockImage,
    });

    container.innerHTML = '<svg width="120" height="90" viewBox="0 0 120 90"><rect width="120" height="90"/></svg>';

    await expect(exportPng(container, createDataset('Population by Region'), 'line')).resolves.toBe(true);

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(2);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('Population_by_Region_20261105_143022.png');

    jest.useRealTimers();
  });
});
