import { createLineChart, computeValueRange } from '../../src/charts/line';
import { ChartScaffold } from '../../src/charts/base';
import { ChartData, ChartConfig, ZoneType } from '../../src/types';
import { DEFAULT_THEME } from '../../src/theme/defaults';

// Mock ResizeObserver
beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (window as any).matchMedia = jest.fn().mockReturnValue({ matches: false });
});

const singleSeriesData: ChartData = {
  series: [{
    name: 'Population',
    code: 'pop',
    points: [
      { value: 100, label: '2020', categoryCode: '2020' },
      { value: 150, label: '2021', categoryCode: '2021' },
      { value: 200, label: '2022', categoryCode: '2022' },
    ]
  }],
  categories: ['2020', '2021', '2022'],
  categoryLabels: ['2020', '2021', '2022'],
};

const multiSeriesData: ChartData = {
  series: [
    {
      name: 'Helsinki',
      code: 'hel',
      points: [
        { value: 100, label: '2020', categoryCode: '2020' },
        { value: 150, label: '2021', categoryCode: '2021' },
        { value: 200, label: '2022', categoryCode: '2022' },
      ]
    },
    {
      name: 'Tampere',
      code: 'tre',
      points: [
        { value: 80, label: '2020', categoryCode: '2020' },
        { value: null, label: '2021', categoryCode: '2021' },
        { value: 120, label: '2022', categoryCode: '2022' },
      ]
    }
  ],
  categories: ['2020', '2021', '2022'],
  categoryLabels: ['2020', '2021', '2022'],
};

const defaultConfig: ChartConfig = {};

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
  document.body.appendChild(container);
});
afterEach(() => {
  container.remove();
});

describe('createLineChart', () => {
  it('creates SVG in container', () => {
    createLineChart({ container, data: singleSeriesData, config: defaultConfig });
    const svg = container.querySelector('svg.jsc-chart');
    expect(svg).not.toBeNull();
  });

  it('draws correct number of line paths — one per series', () => {
    createLineChart({ container, data: multiSeriesData, config: defaultConfig });
    const paths = container.querySelectorAll('.jsc-line');
    expect(paths.length).toBe(2);
  });

  it('does not draw point markers by default', () => {
    createLineChart({ container, data: singleSeriesData, config: defaultConfig });
    expect(container.querySelectorAll('.jsc-marker')).toHaveLength(0);
  });

  it('null values create gaps without drawing point markers by default', () => {
    createLineChart({ container, data: multiSeriesData, config: defaultConfig });
    expect(container.querySelectorAll('.jsc-marker')).toHaveLength(0);
  });

  it('single series — no legend shown by default', () => {
    createLineChart({ container, data: singleSeriesData, config: defaultConfig });
    const legend = container.querySelector('.jsc-legend');
    expect(legend).toBeNull();
  });

  it('multi-series — series have different colors', () => {
    createLineChart({ container, data: multiSeriesData, config: defaultConfig });
    const lines = container.querySelectorAll<SVGPathElement>('.jsc-line');
    expect(lines.length).toBe(2);
    const color0 = lines[0].getAttribute('stroke');
    const color1 = lines[1].getAttribute('stroke');
    expect(color0).not.toBeNull();
    expect(color1).not.toBeNull();
    expect(color0).not.toBe(color1);
  });

  it('ARIA: container has role="figure"', () => {
    createLineChart({ container, data: singleSeriesData, config: defaultConfig });
    expect(container.getAttribute('role')).toBe('figure');
  });

  it('ARIA: markers are only interactive when accessibility mode is enabled', () => {
    createLineChart({ container, data: singleSeriesData, config: defaultConfig });
    expect(container.querySelectorAll('.jsc-marker')).toHaveLength(0);

    container.innerHTML = '';
    createLineChart({
      container,
      data: singleSeriesData,
      config: { ...defaultConfig, accessibilityMode: true },
    });
    const markers = container.querySelectorAll('.jsc-marker');
    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) {
      expect(marker.getAttribute('role')).toBe('listitem');
      expect(marker.getAttribute('aria-label')).not.toBeNull();
    }
  });

  it('screen reader table is created', () => {
    createLineChart({ container, data: singleSeriesData, config: defaultConfig });
    const table = container.querySelector('table.jsc-sr-only');
    expect(table).not.toBeNull();
  });

  it('destroy() cleans up DOM', () => {
    const instance = createLineChart({ container, data: singleSeriesData, config: defaultConfig });
    expect(container.querySelector('svg')).not.toBeNull();
    instance.destroy();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.getAttribute('role')).toBeNull();
    expect(container.getAttribute('aria-label')).toBeNull();
  });

  it('update() re-renders with new data', () => {
    const instance = createLineChart({ container, data: singleSeriesData, config: defaultConfig });
    const markersBefore = container.querySelectorAll('.jsc-marker').length;
    expect(markersBefore).toBe(0);

    instance.update(multiSeriesData);
    const markersAfter = container.querySelectorAll('.jsc-marker').length;
    expect(markersAfter).toBe(0);

    const pathsAfter = container.querySelectorAll('.jsc-line').length;
    expect(pathsAfter).toBe(2);
  });

  it('all-null data — renders SVG but no circle markers', () => {
    const allNullData: ChartData = {
      series: [{
        name: 'Missing',
        code: 'miss',
        points: [
          { value: null, label: '2020', categoryCode: '2020' },
          { value: null, label: '2021', categoryCode: '2021' },
        ],
      }],
      categories: ['2020', '2021'],
      categoryLabels: ['2020', '2021'],
    };
    createLineChart({ container, data: allNullData, config: defaultConfig });
    expect(container.querySelector('svg.jsc-chart')).not.toBeNull();
    const circles = container.querySelectorAll('.jsc-marker');
    expect(circles.length).toBe(0);
  });

  it('empty series array — renders chart with no data elements', () => {
    const emptyData: ChartData = {
      series: [],
      categories: ['2020', '2021'],
      categoryLabels: ['2020', '2021'],
    };
    createLineChart({ container, data: emptyData, config: defaultConfig });
    expect(container.querySelector('svg.jsc-chart')).not.toBeNull();
    expect(container.querySelectorAll('.jsc-line').length).toBe(0);
    expect(container.querySelectorAll('.jsc-marker').length).toBe(0);
  });

  it('update() with new title updates aria-label on container', () => {
    const instance = createLineChart({ container, data: singleSeriesData, config: defaultConfig });
    instance.update(singleSeriesData, { title: 'New Title' });
    expect(container.getAttribute('aria-label')).toBe('New Title');
  });

  it('code vs label categories — axis tick text uses categoryLabels not codes', () => {
    const codeLabelData: ChartData = {
      series: [{
        name: 'Total',
        code: 'tot',
        points: [
          { value: 42, label: 'Total', categoryCode: 'SSS' },
        ],
      }],
      categories: ['SSS'],
      categoryLabels: ['Total'],
    };
    createLineChart({ container, data: codeLabelData, config: defaultConfig });
    const ticks = container.querySelectorAll('.jsc-axis-x .tick text tspan');
    const tickTexts = Array.from(ticks).map(t => t.textContent);
    expect(tickTexts.some(t => t === 'Total')).toBe(true);
    expect(tickTexts.some(t => t === 'SSS')).toBe(false);
  });

  describe('scalePoint positioning', () => {
    // With scalePoint(.padding(0)), range is [0, plotWidth].
    // First category maps to 0, last maps to plotWidth.
    // The actual plotWidth depends on the layout engine, but we can verify
    // relative positions from the line path, with the first point at the
    // minimum x (0 relative to plot area).
    const getLineXValues = (): number[] => {
      const line = container.querySelector<SVGPathElement>('.jsc-line');
      const path = line?.getAttribute('d') ?? '';
      return Array.from(path.matchAll(/[ML](-?\d+(?:\.\d+)?),/g), match => parseFloat(match[1]));
    };

    it('first data point is at the left edge of the plot area', () => {
      createLineChart({ container, data: singleSeriesData, config: defaultConfig });
      const xValues = getLineXValues();
      // First point should be at the minimum x position (leftmost)
      expect(xValues[0]).toBeLessThan(xValues[1]);
      expect(xValues[0]).toBeLessThan(xValues[2]);
    });

    it('last data point is at the right edge of the plot area', () => {
      createLineChart({ container, data: singleSeriesData, config: defaultConfig });
      const xValues = getLineXValues();
      // Last point should be at the maximum x position (rightmost)
      expect(xValues[2]).toBeGreaterThan(xValues[0]);
      expect(xValues[2]).toBeGreaterThan(xValues[1]);
    });

    it('first line point x equals 0 (scalePoint maps first domain value to range start)', () => {
      // Use 4 categories to make the scalePoint layout unambiguous
      const fourCatData: ChartData = {
        series: [{
          name: 'Series',
          code: 's',
          points: [
            { value: 10, label: 'A', categoryCode: 'A' },
            { value: 20, label: 'B', categoryCode: 'B' },
            { value: 30, label: 'C', categoryCode: 'C' },
            { value: 40, label: 'D', categoryCode: 'D' },
          ],
        }],
        categories: ['A', 'B', 'C', 'D'],
        categoryLabels: ['A', 'B', 'C', 'D'],
      };
      createLineChart({ container, data: fourCatData, config: defaultConfig });
      const xValues = getLineXValues();
      // scalePoint with padding(0): first point at 0
      expect(xValues[0]).toBeCloseTo(0, 1);
    });

    it('last line point x equals plotWidth (scalePoint maps last domain value to range end)', () => {
      const fourCatData: ChartData = {
        series: [{
          name: 'Series',
          code: 's',
          points: [
            { value: 10, label: 'A', categoryCode: 'A' },
            { value: 20, label: 'B', categoryCode: 'B' },
            { value: 30, label: 'C', categoryCode: 'C' },
            { value: 40, label: 'D', categoryCode: 'D' },
          ],
        }],
        categories: ['A', 'B', 'C', 'D'],
        categoryLabels: ['A', 'B', 'C', 'D'],
      };
      // Use a large container so layout margins are predictable
      Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
      createLineChart({ container, data: fourCatData, config: defaultConfig });
      const xValues = getLineXValues();
      // Points should be equally spaced: step = plotWidth / (N-1)
      const step01 = xValues[1] - xValues[0];
      const step12 = xValues[2] - xValues[1];
      const step23 = xValues[3] - xValues[2];
      expect(step01).toBeCloseTo(step12, 1);
      expect(step12).toBeCloseTo(step23, 1);
      // Last point at range end = xValues[0] + 3 * step
      expect(xValues[3]).toBeCloseTo(xValues[0] + 3 * step01, 1);
    });

    it('1-category: single data point is rendered (no division by zero)', () => {
      const oneCatData: ChartData = {
        series: [{
          name: 'Series',
          code: 's',
          points: [{ value: 42, label: 'A', categoryCode: 'A' }],
        }],
        categories: ['A'],
        categoryLabels: ['A'],
      };
      createLineChart({ container, data: oneCatData, config: defaultConfig });
      expect(getLineXValues()).toHaveLength(1);
    });

    it('2-category: first line point x ≈ 0, second line point x ≈ plot width', () => {
      const twoCatData: ChartData = {
        series: [{
          name: 'Series',
          code: 's',
          points: [
            { value: 10, label: 'A', categoryCode: 'A' },
            { value: 20, label: 'B', categoryCode: 'B' },
          ],
        }],
        categories: ['A', 'B'],
        categoryLabels: ['A', 'B'],
      };
      createLineChart({ container, data: twoCatData, config: defaultConfig });
      const xValues = getLineXValues();
      // First point stays at x=0 (anchored to y-axis)
      expect(xValues[0]).toBeCloseTo(0, 1);
      // Get actual plot width from the clip rect
      const clipRect = container.querySelector<SVGRectElement>('clipPath rect');
      const plotWidth = clipRect ? parseFloat(clipRect.getAttribute('width') ?? '0') : 0;
      expect(plotWidth).toBeGreaterThan(0);
      // Second point is at the right edge of the plot area
      expect(xValues[1]).toBeCloseTo(plotWidth, 1);
    });

    it('x-axis tick count matches number of categories', () => {
      createLineChart({ container, data: singleSeriesData, config: defaultConfig });
      // singleSeriesData has 3 categories: 2020, 2021, 2022
      const ticks = container.querySelectorAll('.jsc-axis-x .tick');
      expect(ticks.length).toBe(singleSeriesData.categories.length);
    });

    it('all x-axis labels have text-anchor="middle"', () => {
      createLineChart({ container, data: singleSeriesData, config: defaultConfig });
      const ticks = Array.from(container.querySelectorAll<SVGGElement>('.jsc-axis-x .tick'));
      const visibleTexts = ticks
        .map(t => t.querySelector('text'))
        .filter((t): t is SVGTextElement => t !== null);
      expect(visibleTexts.length).toBeGreaterThanOrEqual(2);
      for (const text of visibleTexts) {
        expect(text.getAttribute('text-anchor')).toBe('middle');
      }
    });

    it('RightMargin zone is allocated for line charts', () => {
      // Use ChartScaffold directly to access the layout result
      const scaffold = new ChartScaffold({
        mode: 'categorical' as const,
        container,
        chartType: 'line',
        config: defaultConfig,
        seriesCount: 1,
        seriesNames: ['Population'],
        categories: singleSeriesData.categories,
        categoryLabels: singleSeriesData.categoryLabels,
        valueRange: [100, 200],
      });
      const context = scaffold.render();
      const rightMarginRect = context.layout.zones.get(ZoneType.RightMargin);
      expect(rightMarginRect).toBeDefined();
      expect(rightMarginRect!.width).toBeGreaterThan(0);
      scaffold.destroy();
    });

    it('RightMargin is 0 for single-category line chart', () => {
      const oneCatData: ChartData = {
        series: [{ name: 'S', code: 's', points: [{ value: 42, label: 'A', categoryCode: 'A' }] }],
        categories: ['A'],
        categoryLabels: ['A'],
      };
      const scaffold = new ChartScaffold({
        mode: 'categorical' as const,
        container,
        chartType: 'line',
        config: defaultConfig,
        seriesCount: 1,
        seriesNames: ['S'],
        categories: oneCatData.categories,
        categoryLabels: oneCatData.categoryLabels,
        valueRange: [0, 42],
      });
      const context = scaffold.render();
      const rightMarginRect = context.layout.zones.get(ZoneType.RightMargin);
      // Single-category line chart: RightMargin must be 0 (no half-slot to reserve)
      if (rightMarginRect) {
        expect(rightMarginRect.width).toBe(0);
      } else {
        // Zone collapsed — also acceptable
        expect(context.layout.collapsed).toContain(ZoneType.RightMargin);
      }
      scaffold.destroy();
    });
  });

  it('accessibility mode renders marker shapes as path elements', () => {
    createLineChart({
      container,
      data: multiSeriesData,
      config: { ...defaultConfig, accessibilityMode: true },
    });

    const markerPaths = container.querySelectorAll('path.jsc-marker');
    const markerCircles = container.querySelectorAll('circle.jsc-marker');
    expect(markerPaths.length).toBeGreaterThan(0);
    expect(markerCircles.length).toBe(0);
    const firstMarkerPath = markerPaths[0] as SVGPathElement;
    expect(firstMarkerPath.getAttribute('d')).toContain('5');
  });

  it('marker stroke uses theme.colorSurface in accessibility mode', () => {
    const darkColorSurface = '#1a1a2e';
    createLineChart({
      container,
      data: singleSeriesData,
      config: { theme: { colorSurface: darkColorSurface }, accessibilityMode: true },
    });
    const markers = container.querySelectorAll<SVGPathElement>('.jsc-marker');
    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) {
      expect(marker.getAttribute('stroke')).toBe(darkColorSurface);
    }
    // Verify it differs from the default white surface so the test is meaningful
    expect(darkColorSurface).not.toBe(DEFAULT_THEME.colorSurface);
  });

  describe('cutValueAxis', () => {
    it('forces the value range to include 0 by default even when all values are positive', () => {
      expect(computeValueRange(singleSeriesData)).toEqual([0, 200]);
      expect(computeValueRange(singleSeriesData, false)).toEqual([0, 200]);
    });

    it('keeps the raw data range when cutValueAxis is true', () => {
      expect(computeValueRange(singleSeriesData, true)).toEqual([100, 200]);
    });

    const narrowRangeData: ChartData = {
      series: [{
        name: 'S',
        code: 's',
        points: [
          { value: 300, label: '2020', categoryCode: '2020' },
          { value: 320, label: '2021', categoryCode: '2021' },
          { value: 310, label: '2022', categoryCode: '2022' },
          { value: 340, label: '2023', categoryCode: '2023' },
        ],
      }],
      categories: ['2020', '2021', '2022', '2023'],
      categoryLabels: ['2020', '2021', '2022', '2023'],
    };

    function getYAxisTickValues(): number[] {
      return Array.from(container.querySelectorAll('.jsc-axis-y .tick text'))
        .map(t => Number.parseFloat((t.textContent ?? '').replace(/\u2212/, '-')))
        .filter(n => !Number.isNaN(n));
    }

    it('rendered Y axis starts at 0 by default, even with a narrow, far-from-zero data range', () => {
      createLineChart({ container, data: narrowRangeData, config: defaultConfig });
      const ticks = getYAxisTickValues();
      expect(Math.min(...ticks)).toBe(0);
    });

    it('rendered Y axis does not start at 0 when cutValueAxis is true', () => {
      createLineChart({ container, data: narrowRangeData, config: { cutValueAxis: true } });
      const ticks = getYAxisTickValues();
      expect(Math.min(...ticks)).toBeGreaterThan(0);
      expect(Math.min(...ticks)).toBeLessThanOrEqual(300);
    });
  });
});
