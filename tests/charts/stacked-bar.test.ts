import { createStackedBarChart } from '../../src/charts/stacked-bar';
import { ChartData, ChartConfig } from '../../src/types';

// Mock ResizeObserver
const stackedData: ChartData = {
  series: [
    {
      name: 'Agriculture',
      code: 'agr',
      points: [
        { value: 30, label: '2020', categoryCode: '2020' },
        { value: 25, label: '2021', categoryCode: '2021' },
      ],
    },
    {
      name: 'Industry',
      code: 'ind',
      points: [
        { value: 40, label: '2020', categoryCode: '2020' },
        { value: 45, label: '2021', categoryCode: '2021' },
      ],
    },
    {
      name: 'Services',
      code: 'srv',
      points: [
        { value: 30, label: '2020', categoryCode: '2020' },
        { value: null, label: '2021', categoryCode: '2021' },
      ],
    },
  ],
  categories: ['2020', '2021'],
  categoryLabels: ['2020', '2021'],
};

const twoSeriesData: ChartData = {
  series: [
    {
      name: 'Series A',
      code: 'a',
      points: [
        { value: 10, label: 'Cat1', categoryCode: 'cat1' },
        { value: 20, label: 'Cat2', categoryCode: 'cat2' },
      ],
    },
    {
      name: 'Series B',
      code: 'b',
      points: [
        { value: 40, label: 'Cat1', categoryCode: 'cat1' },
        { value: 30, label: 'Cat2', categoryCode: 'cat2' },
      ],
    },
  ],
  categories: ['cat1', 'cat2'],
  categoryLabels: ['Cat1', 'Cat2'],
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

describe('createStackedBarChart', () => {
  it('creates SVG in container', () => {
    createStackedBarChart({ container, data: stackedData, config: defaultConfig });
    const svg = container.querySelector('svg.jsc-chart');
    expect(svg).not.toBeNull();
  });

  it('stacked vertical: draws correct number of rects (null segments omitted)', () => {
    createStackedBarChart({
      container,
      data: stackedData,
      config: defaultConfig,
      chartType: 'stackedVerticalBar',
    });
    // 3 series × 2 categories = 6, minus 1 null (Services/2021) = 5
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects).toHaveLength(5);
  });

  it('stacked horizontal: draws rects', () => {
    createStackedBarChart({
      container,
      data: stackedData,
      config: defaultConfig,
      chartType: 'stackedHorizontalBar',
    });
    // Same: 5 non-null rects
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects).toHaveLength(5);
  });

  it('percent vertical: draws rects and uses 100 as value range upper bound', () => {
    createStackedBarChart({
      container,
      data: twoSeriesData,
      config: defaultConfig,
      chartType: 'percentVerticalBar',
    });
    // 2 series × 2 categories = 4 rects (no nulls)
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects).toHaveLength(4);

    // The y-axis should have tick labels reaching 100
    const tickTexts = Array.from(container.querySelectorAll('.jsc-axis-y text, text')).map(
      el => el.textContent ?? ''
    );
    const has100 = tickTexts.some(t => t.trim() === '100' || t.includes('100'));
    expect(has100).toBe(true);
  });

  it('percent horizontal: renders rects', () => {
    createStackedBarChart({
      container,
      data: twoSeriesData,
      config: defaultConfig,
      chartType: 'percentHorizontalBar',
    });
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects).toHaveLength(4);
  });

  it('null values are omitted — no rect rendered for null segments', () => {
    createStackedBarChart({
      container,
      data: stackedData,
      config: defaultConfig,
      chartType: 'stackedVerticalBar',
    });
    // Only 5 rects: Services/2021 is null, should not have a rect
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects).toHaveLength(5);

    // The Services series (idx 2) should have exactly 1 rect (only 2020)
    const serviceRects = container.querySelectorAll('.jsc-series-2 .jsc-bar');
    expect(serviceRects).toHaveLength(1);
  });

  it('does not crash and keeps keyboard navigation working when a null sits between two valid categories', () => {
    const dataWithMiddleNull: ChartData = {
      series: [
        {
          name: 'Agriculture',
          code: 'agr',
          points: [
            { value: 10, label: '2020', categoryCode: '2020' },
            { value: null, label: '2021', categoryCode: '2021' },
            { value: 30, label: '2022', categoryCode: '2022' },
          ],
        },
        {
          name: 'Industry',
          code: 'ind',
          points: [
            { value: 40, label: '2020', categoryCode: '2020' },
            { value: 45, label: '2021', categoryCode: '2021' },
            { value: 20, label: '2022', categoryCode: '2022' },
          ],
        },
      ],
      categories: ['2020', '2021', '2022'],
      categoryLabels: ['2020', '2021', '2022'],
    };

    expect(() => {
      createStackedBarChart({
        container,
        data: dataWithMiddleNull,
        config: defaultConfig,
        chartType: 'stackedVerticalBar',
      });
    }).not.toThrow();

    const agricultureRects = container.querySelectorAll('.jsc-series-0 .jsc-bar');
    expect(agricultureRects).toHaveLength(2);

    // Arrow-key navigation across the gap must not throw or dereference a hole.
    (agricultureRects[0] as SVGElement).focus();
    expect(() => {
      agricultureRects[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );
    }).not.toThrow();
    expect(document.activeElement).toBe(agricultureRects[1]);
  });


  it('ARIA: container has role="region"', () => {
    createStackedBarChart({ container, data: stackedData, config: defaultConfig });
    expect(container.getAttribute('role')).toBe('region');
  });

  it('ARIA: rects have role="listitem" and aria-label', () => {
    createStackedBarChart({ container, data: stackedData, config: defaultConfig });
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      expect(rect.getAttribute('role')).toBe('listitem');
      expect(rect.getAttribute('aria-label')).not.toBeNull();
    }
  });

  it('destroy() cleans up DOM', () => {
    const instance = createStackedBarChart({ container, data: stackedData, config: defaultConfig });
    expect(container.querySelector('svg')).not.toBeNull();
    instance.destroy();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.getAttribute('role')).toBeNull();
    expect(container.getAttribute('aria-label')).toBeNull();
  });

  it('update() re-renders with new data', () => {
    const instance = createStackedBarChart({
      container,
      data: stackedData,
      config: defaultConfig,
      chartType: 'stackedVerticalBar',
    });
    // Initially 5 rects
    expect(container.querySelectorAll('.jsc-bar')).toHaveLength(5);

    // Update with data where all values are non-null: 2 series × 2 categories = 4 rects
    instance.update(twoSeriesData);
    expect(container.querySelectorAll('.jsc-bar')).toHaveLength(4);
  });

  it('update() with new title updates aria-label on container', () => {
    const instance = createStackedBarChart({ container, data: stackedData, config: defaultConfig });
    instance.update(stackedData, { title: 'Updated Stacked Title' });
    expect(container.getAttribute('aria-label')).toBe('Updated Stacked Title');
  });

  it('series groups have correct classes', () => {
    createStackedBarChart({
      container,
      data: stackedData,
      config: defaultConfig,
      chartType: 'stackedVerticalBar',
    });
    expect(container.querySelector('.jsc-series-0')).not.toBeNull();
    expect(container.querySelector('.jsc-series-1')).not.toBeNull();
    expect(container.querySelector('.jsc-series-2')).not.toBeNull();
  });

  it('rects have stroke for WCAG contrast', () => {
    createStackedBarChart({ container, data: stackedData, config: defaultConfig });
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      expect(rect.getAttribute('stroke')).not.toBeNull();
      expect(rect.getAttribute('stroke-width')).toBe('1');
    }
  });

  it('rejects negative values: renders error div instead of chart', () => {
    const negativeData: ChartData = {
      series: [
        { name: 'A', code: 'a', points: [{ value: -10, label: 'X', categoryCode: 'x' }] },
        { name: 'B', code: 'b', points: [{ value: 20, label: 'X', categoryCode: 'x' }] },
      ],
      categories: ['x'],
      categoryLabels: ['X'],
    };
    createStackedBarChart({ container, data: negativeData, config: defaultConfig });
    const errorDiv = container.querySelector('.jsc-error');
    expect(errorDiv).not.toBeNull();
    expect(errorDiv!.textContent).toContain('negative');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('rejects negative values: destroy() cleans up error div', () => {
    const negativeData: ChartData = {
      series: [
        { name: 'A', code: 'a', points: [{ value: -5, label: 'X', categoryCode: 'x' }] },
      ],
      categories: ['x'],
      categoryLabels: ['X'],
    };
    const instance = createStackedBarChart({ container, data: negativeData, config: defaultConfig });
    expect(container.querySelector('.jsc-error')).not.toBeNull();
    instance.destroy();
    expect(container.querySelector('.jsc-error')).toBeNull();
  });

  it('percent mode: formattedValue includes percentage', () => {
    createStackedBarChart({
      container,
      data: twoSeriesData,
      config: defaultConfig,
      chartType: 'percentVerticalBar',
    });
    const rects = container.querySelectorAll('.jsc-bar');
    expect(rects.length).toBeGreaterThan(0);
    // In percent mode, aria-label should include '%'
    let foundPercent = false;
    for (const rect of rects) {
      const label = rect.getAttribute('aria-label') ?? '';
      if (label.includes('%')) {
        foundPercent = true;
        break;
      }
    }
    expect(foundPercent).toBe(true);
  });

  it('toggling a series off reflows stacks — hidden series group is removed from DOM', () => {
    createStackedBarChart({
      container,
      data: twoSeriesData,
      config: defaultConfig,
      chartType: 'stackedVerticalBar',
    });

    // Initially both series groups are present
    expect(container.querySelectorAll('.jsc-series-0 .jsc-bar')).toHaveLength(2);
    expect(container.querySelectorAll('.jsc-series-1 .jsc-bar')).toHaveLength(2);

    const legendButtons = container.querySelectorAll('.jsc-legend-item');
    expect(legendButtons.length).toBeGreaterThanOrEqual(2);
    (legendButtons[1] as HTMLElement).click(); // toggle off Series B

    // Series 1 group should no longer exist in the DOM
    expect(container.querySelectorAll('.jsc-series-1 .jsc-bar')).toHaveLength(0);

    // Series 0 bars should still be present
    expect(container.querySelectorAll('.jsc-series-0 .jsc-bar')).toHaveLength(2);
  });

  it('toggling series off then on restores original bar count', () => {
    createStackedBarChart({
      container,
      data: twoSeriesData,
      config: defaultConfig,
      chartType: 'stackedVerticalBar',
    });

    const legendButtons = container.querySelectorAll('.jsc-legend-item');
    (legendButtons[1] as HTMLElement).click(); // toggle off
    (container.querySelectorAll('.jsc-legend-item')[1] as HTMLElement).click(); // toggle on

    expect(container.querySelectorAll('.jsc-series-0 .jsc-bar')).toHaveLength(2);
    expect(container.querySelectorAll('.jsc-series-1 .jsc-bar')).toHaveLength(2);
  });

  it('percent mode: bars still fill 100% after toggling a series off', () => {
    createStackedBarChart({
      container,
      data: twoSeriesData,
      config: defaultConfig,
      chartType: 'percentVerticalBar',
    });

    // Before toggle: two series, both present
    expect(container.querySelectorAll('.jsc-bar')).toHaveLength(4);

    const legendButtons = container.querySelectorAll('.jsc-legend-item');
    (legendButtons[1] as HTMLElement).click(); // hide Series B

    // Only Series A bars should remain
    expect(container.querySelectorAll('.jsc-series-0 .jsc-bar')).toHaveLength(2);
    expect(container.querySelectorAll('.jsc-series-1 .jsc-bar')).toHaveLength(0);

    // The remaining series A bars should show 100% in their aria-label
    // (since percent is recomputed from visible series only)
    const rects = container.querySelectorAll('.jsc-series-0 .jsc-bar');
    for (const rect of rects) {
      const label = rect.getAttribute('aria-label') ?? '';
      expect(label).toContain('100');
    }
  });

  it('update() resets hidden series so all bars reappear', () => {
    const instance = createStackedBarChart({
      container,
      data: twoSeriesData,
      config: defaultConfig,
      chartType: 'stackedVerticalBar',
    });

    const legendButtons = container.querySelectorAll('.jsc-legend-item');
    (legendButtons[1] as HTMLElement).click(); // hide Series B
    expect(container.querySelectorAll('.jsc-series-1 .jsc-bar')).toHaveLength(0);

    instance.update(twoSeriesData);
    expect(container.querySelectorAll('.jsc-bar')).toHaveLength(4);
  });

  it('accessibility mode applies patterned fills to bars', () => {
    createStackedBarChart({
      container,
      data: stackedData,
      config: { ...defaultConfig, accessibilityMode: true },
      chartType: 'stackedVerticalBar',
    });

    const firstBar = container.querySelector('.jsc-bar') as SVGRectElement;
    expect(firstBar).not.toBeNull();
    expect(firstBar.getAttribute('fill')).toContain('url(#jsc-pattern-');
  });
});
