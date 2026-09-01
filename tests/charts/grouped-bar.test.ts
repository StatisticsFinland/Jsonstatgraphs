import { createGroupedBarChart } from '../../src/charts/grouped-bar';
import { ChartData, ChartConfig } from '../../src/types';

// Mock ResizeObserver
const twoSeriesData: ChartData = {
  series: [
    {
      name: 'Series A',
      code: 'a',
      points: [
        { value: 10, label: 'Cat1', categoryCode: 'cat1' },
        { value: 20, label: 'Cat2', categoryCode: 'cat2' },
        { value: 30, label: 'Cat3', categoryCode: 'cat3' },
      ],
    },
    {
      name: 'Series B',
      code: 'b',
      points: [
        { value: 40, label: 'Cat1', categoryCode: 'cat1' },
        { value: 50, label: 'Cat2', categoryCode: 'cat2' },
        { value: 60, label: 'Cat3', categoryCode: 'cat3' },
      ],
    },
  ],
  categories: ['cat1', 'cat2', 'cat3'],
  categoryLabels: ['Cat1', 'Cat2', 'Cat3'],
};

const threeSeriesData: ChartData = {
  series: [
    {
      name: 'X',
      code: 'x',
      points: [
        { value: 1, label: 'A', categoryCode: 'a' },
        { value: 2, label: 'B', categoryCode: 'b' },
        { value: 3, label: 'C', categoryCode: 'c' },
      ],
    },
    {
      name: 'Y',
      code: 'y',
      points: [
        { value: 4, label: 'A', categoryCode: 'a' },
        { value: 5, label: 'B', categoryCode: 'b' },
        { value: 6, label: 'C', categoryCode: 'c' },
      ],
    },
    {
      name: 'Z',
      code: 'z',
      points: [
        { value: 7, label: 'A', categoryCode: 'a' },
        { value: 8, label: 'B', categoryCode: 'b' },
        { value: 9, label: 'C', categoryCode: 'c' },
      ],
    },
  ],
  categories: ['a', 'b', 'c'],
  categoryLabels: ['A', 'B', 'C'],
};

const dataWithNull: ChartData = {
  series: [
    {
      name: 'Series A',
      code: 'a',
      points: [
        { value: 10,   label: 'Cat1', categoryCode: 'cat1' },
        { value: null, label: 'Cat2', categoryCode: 'cat2' },
        { value: 30,   label: 'Cat3', categoryCode: 'cat3' },
      ],
    },
    {
      name: 'Series B',
      code: 'b',
      points: [
        { value: 40,   label: 'Cat1', categoryCode: 'cat1' },
        { value: 50,   label: 'Cat2', categoryCode: 'cat2' },
        { value: null, label: 'Cat3', categoryCode: 'cat3' },
      ],
    },
  ],
  categories: ['cat1', 'cat2', 'cat3'],
  categoryLabels: ['Cat1', 'Cat2', 'Cat3'],
};

const defaultConfig: ChartConfig = {};

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth',  { value: 600, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
  document.body.appendChild(container);
});
afterEach(() => {
  container.remove();
});

describe('createGroupedBarChart', () => {
  it('creates SVG in container', () => {
    createGroupedBarChart({ container, data: twoSeriesData, config: defaultConfig });
    const svg = container.querySelector('svg.jsc-chart');
    expect(svg).not.toBeNull();
  });

  it('draws correct number of rects — series × non-null categories', () => {
    createGroupedBarChart({ container, data: twoSeriesData, config: defaultConfig });
    // 2 series × 3 categories = 6 rects
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects.length).toBe(6);
  });

  it('three series draws all rects', () => {
    createGroupedBarChart({ container, data: threeSeriesData, config: defaultConfig });
    // 3 series × 3 categories = 9 rects
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects.length).toBe(9);
  });

  it('multi-series uses different fill colors per series', () => {
    createGroupedBarChart({ container, data: twoSeriesData, config: defaultConfig });
    const series0Rects = container.querySelectorAll('.jsc-series-0 .jsc-bar');
    const series1Rects = container.querySelectorAll('.jsc-series-1 .jsc-bar');
    expect(series0Rects.length).toBeGreaterThan(0);
    expect(series1Rects.length).toBeGreaterThan(0);
    const color0 = (series0Rects[0] as SVGRectElement).getAttribute('fill');
    const color1 = (series1Rects[0] as SVGRectElement).getAttribute('fill');
    expect(color0).not.toBeNull();
    expect(color1).not.toBeNull();
    expect(color0).not.toBe(color1);
  });

  it('null values omit rects', () => {
    createGroupedBarChart({ container, data: dataWithNull, config: defaultConfig });
    // Series A: 2 non-null (cat1, cat3), Series B: 2 non-null (cat1, cat2) = 4 total
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects.length).toBe(4);
  });

  it('horizontal grouped bar creates rects', () => {
    createGroupedBarChart({
      container,
      data: twoSeriesData,
      config: defaultConfig,
      chartType: 'groupedHorizontalBar',
    });
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects.length).toBe(6);
  });

  it('uses series order for top-to-bottom order in horizontal groups and legend', () => {
    const prioritizedData: ChartData = {
      ...twoSeriesData,
      series: [twoSeriesData.series[1], twoSeriesData.series[0]],
    };

    createGroupedBarChart({
      container,
      data: prioritizedData,
      config: defaultConfig,
      chartType: 'groupedHorizontalBar',
    });

    const firstBarY = Number.parseFloat(
      (container.querySelector('.jsc-series-0 .jsc-bar') as SVGRectElement).getAttribute('y') ?? '0'
    );
    const secondBarY = Number.parseFloat(
      (container.querySelector('.jsc-series-1 .jsc-bar') as SVGRectElement).getAttribute('y') ?? '0'
    );
    expect(firstBarY).toBeLessThan(secondBarY);
    expect(Array.from(container.querySelectorAll('.jsc-legend-item')).map(item => item.textContent?.trim())).toEqual([
      'Series B',
      'Series A',
    ]);
    expect(container.querySelector('.jsc-series-0 .jsc-bar')?.getAttribute('aria-label')).toContain('Series B');
  });

  it('ARIA: container has role="figure"', () => {
    createGroupedBarChart({ container, data: twoSeriesData, config: defaultConfig });
    expect(container.getAttribute('role')).toBe('figure');
  });

  it('ARIA: rects have role="listitem" and aria-label', () => {
    createGroupedBarChart({ container, data: twoSeriesData, config: defaultConfig });
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      expect(rect.getAttribute('role')).toBe('listitem');
      expect(rect.getAttribute('aria-label')).not.toBeNull();
    }
  });

  it('destroy() cleans up DOM', () => {
    const instance = createGroupedBarChart({ container, data: twoSeriesData, config: defaultConfig });
    expect(container.querySelector('svg')).not.toBeNull();
    instance.destroy();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.getAttribute('role')).toBeNull();
    expect(container.getAttribute('aria-label')).toBeNull();
  });

  it('update() re-renders with new data', () => {
    const instance = createGroupedBarChart({ container, data: twoSeriesData, config: defaultConfig });
    expect(container.querySelectorAll('.jsc-bar').length).toBe(6);

    instance.update(dataWithNull);
    // 4 non-null rects after update
    expect(container.querySelectorAll('.jsc-bar').length).toBe(4);
  });

  it('update() with new title updates aria-label on container', () => {
    const instance = createGroupedBarChart({ container, data: twoSeriesData, config: defaultConfig });
    instance.update(twoSeriesData, { title: 'Updated Title' });
    expect(container.getAttribute('aria-label')).toBe('Updated Title');
  });

  it('toggling a series off reflows remaining bars — inner bandwidth increases', () => {
    createGroupedBarChart({ container, data: twoSeriesData, config: defaultConfig });

    const initialBars = container.querySelectorAll('.jsc-series-0 .jsc-bar');
    expect(initialBars.length).toBeGreaterThan(0);
    const initialWidth = Number.parseFloat((initialBars[0] as SVGRectElement).getAttribute('width') ?? '0');

    // Click the legend button for series 1 to toggle it off
    const legendButtons = container.querySelectorAll('.jsc-legend-item');
    expect(legendButtons.length).toBeGreaterThanOrEqual(2);
    (legendButtons[1] as HTMLElement).click();

    // Series 1 group should no longer exist in the DOM
    expect(container.querySelectorAll('.jsc-series-1 .jsc-bar').length).toBe(0);

    // Series 0 bars should be wider (inner scale has more room with only 1 series)
    const afterBars = container.querySelectorAll('.jsc-series-0 .jsc-bar');
    expect(afterBars.length).toBeGreaterThan(0);
    const afterWidth = Number.parseFloat((afterBars[0] as SVGRectElement).getAttribute('width') ?? '0');
    expect(afterWidth).toBeGreaterThan(initialWidth);
  });

  it('toggling series off then on restores original bar count and width', () => {
    createGroupedBarChart({ container, data: twoSeriesData, config: defaultConfig });

    const initialWidth = Number.parseFloat(
      (container.querySelectorAll('.jsc-series-0 .jsc-bar')[0] as SVGRectElement).getAttribute('width') ?? '0'
    );

    const legendButtons = container.querySelectorAll('.jsc-legend-item');
    (legendButtons[1] as HTMLElement).click(); // toggle off
    (container.querySelectorAll('.jsc-legend-item')[1] as HTMLElement).click(); // toggle on (re-query after re-render)

    // After re-enabling, both series groups should be present
    expect(container.querySelectorAll('.jsc-series-0 .jsc-bar').length).toBe(3);
    expect(container.querySelectorAll('.jsc-series-1 .jsc-bar').length).toBe(3);

    // Width should return to original
    const restoredWidth = Number.parseFloat(
      (container.querySelectorAll('.jsc-series-0 .jsc-bar')[0] as SVGRectElement).getAttribute('width') ?? '0'
    );
    expect(restoredWidth).toBeCloseTo(initialWidth, 1);
  });

  it('update() resets hidden series so all bars reappear', () => {
    const instance = createGroupedBarChart({ container, data: twoSeriesData, config: defaultConfig });

    const legendButtons = container.querySelectorAll('.jsc-legend-item');
    (legendButtons[1] as HTMLElement).click(); // hide series 1
    expect(container.querySelectorAll('.jsc-series-1 .jsc-bar').length).toBe(0);

    instance.update(twoSeriesData);
    expect(container.querySelectorAll('.jsc-bar').length).toBe(6);
  });
});
