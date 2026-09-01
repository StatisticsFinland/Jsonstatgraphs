import { createBarChart } from '../../src/charts/bar';
import { ChartData, ChartConfig } from '../../src/types';

// Mock ResizeObserver
const singleSeriesData: ChartData = {
  series: [{
    name: 'Population',
    code: 'pop',
    points: [
      { value: 100, label: '2020', categoryCode: '2020' },
      { value: 150, label: '2021', categoryCode: '2021' },
      { value: 200, label: '2022', categoryCode: '2022' },
    ],
  }],
  categories: ['2020', '2021', '2022'],
  categoryLabels: ['2020', '2021', '2022'],
};

const dataWithNull: ChartData = {
  series: [{
    name: 'Revenue',
    code: 'rev',
    points: [
      { value: 50,   label: 'Q1', categoryCode: 'Q1' },
      { value: null, label: 'Q2', categoryCode: 'Q2' },
      { value: 80,   label: 'Q3', categoryCode: 'Q3' },
      { value: null, label: 'Q4', categoryCode: 'Q4' },
    ],
  }],
  categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  categoryLabels: ['Q1', 'Q2', 'Q3', 'Q4'],
};

const negativeData: ChartData = {
  series: [{
    name: 'Balance',
    code: 'bal',
    points: [
      { value: -30,  label: '2019', categoryCode: '2019' },
      { value: 20,   label: '2020', categoryCode: '2020' },
      { value: -10,  label: '2021', categoryCode: '2021' },
    ],
  }],
  categories: ['2019', '2020', '2021'],
  categoryLabels: ['2019', '2020', '2021'],
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

describe('createBarChart', () => {
  it('creates SVG in container', () => {
    createBarChart({ container, data: singleSeriesData, config: defaultConfig });
    const svg = container.querySelector('svg.jsc-chart');
    expect(svg).not.toBeNull();
  });

  it('draws correct number of rects — one per non-null value', () => {
    createBarChart({ container, data: singleSeriesData, config: defaultConfig });
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects).toHaveLength(3);
  });

  it('null values omit rects', () => {
    createBarChart({ container, data: dataWithNull, config: defaultConfig });
    const rects = container.querySelectorAll('.jsc-bar');
    // 2 non-null out of 4 points
    expect(rects).toHaveLength(2);
  });

  it('horizontal bar chart creates rects', () => {
    createBarChart({
      container,
      data: singleSeriesData,
      config: defaultConfig,
      chartType: 'horizontalBar',
    });
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects).toHaveLength(3);
  });

  it('ARIA: container has role="region"', () => {
    createBarChart({ container, data: singleSeriesData, config: defaultConfig });
    expect(container.getAttribute('role')).toBe('region');
  });

  it('ARIA: rects have role="listitem" and aria-label', () => {
    createBarChart({ container, data: singleSeriesData, config: defaultConfig });
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      expect(rect.getAttribute('role')).toBe('listitem');
      expect(rect.getAttribute('aria-label')).not.toBeNull();
    }
  });

  it('destroy() cleans up DOM', () => {
    const instance = createBarChart({ container, data: singleSeriesData, config: defaultConfig });
    expect(container.querySelector('svg')).not.toBeNull();
    instance.destroy();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.getAttribute('role')).toBeNull();
    expect(container.getAttribute('aria-label')).toBeNull();
  });

  it('update() re-renders with new data', () => {
    const instance = createBarChart({ container, data: singleSeriesData, config: defaultConfig });
    expect(container.querySelectorAll('.jsc-bar')).toHaveLength(3);

    instance.update(dataWithNull);
    // 2 non-null points after update
    expect(container.querySelectorAll('.jsc-bar')).toHaveLength(2);
  });

  it('negative values render bars correctly — bars present for all non-null points', () => {
    createBarChart({ container, data: negativeData, config: defaultConfig });
    const rects = container.querySelectorAll('.jsc-bar');
    // 3 non-null points (including negatives)
    expect(rects).toHaveLength(3);
  });

  it('only first series is rendered for multi-series data', () => {
    const multiSeries: ChartData = {
      series: [
        {
          name: 'Series A',
          code: 'a',
          points: [
            { value: 10, label: 'X', categoryCode: 'X' },
            { value: 20, label: 'Y', categoryCode: 'Y' },
          ],
        },
        {
          name: 'Series B',
          code: 'b',
          points: [
            { value: 30, label: 'X', categoryCode: 'X' },
            { value: 40, label: 'Y', categoryCode: 'Y' },
          ],
        },
      ],
      categories: ['X', 'Y'],
      categoryLabels: ['X', 'Y'],
    };
    createBarChart({ container, data: multiSeries, config: defaultConfig });
    // Only 2 bars from first series
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects).toHaveLength(2);
  });

  it('update() with new title updates aria-label on container', () => {
    const instance = createBarChart({ container, data: singleSeriesData, config: defaultConfig });
    instance.update(singleSeriesData, { title: 'Updated Title' });
    expect(container.getAttribute('aria-label')).toBe('Updated Title');
  });

  it('bar chart uses scaleBand — first bar x is NOT at 0 (has paddingOuter offset)', () => {
    createBarChart({ container, data: singleSeriesData, config: defaultConfig });
    const rects = container.querySelectorAll<SVGRectElement>('.jsc-bar');
    expect(rects.length).toBeGreaterThan(0);
    // With scaleBand paddingOuter(0.5), the first bar starts offset from 0
    const firstX = parseFloat(rects[0].getAttribute('x') ?? '0');
    // The x value here is relative to the plot area (bar.ts adds plotArea.x separately),
    // so the first bar's x attribute > 0 due to scaleBand paddingOuter
    expect(firstX).toBeGreaterThan(0);
  });
});
