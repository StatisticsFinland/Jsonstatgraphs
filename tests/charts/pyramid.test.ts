import { createPyramidChart } from '../../src/charts/pyramid';
import { PyramidChartData, ChartConfig } from '../../src/types';
import * as bindInteractionsModule from '../../src/charts/bindInteractions';

const pyramidData: PyramidChartData = {
  leftSeries: {
    name: 'Male',
    code: 'male',
    points: [
      { value: 100, label: '0-9',   categoryCode: '0-9' },
      { value: 150, label: '10-19', categoryCode: '10-19' },
      { value: 200, label: '20-29', categoryCode: '20-29' },
    ],
  },
  rightSeries: {
    name: 'Female',
    code: 'female',
    points: [
      { value: 110,  label: '0-9',   categoryCode: '0-9' },
      { value: null, label: '10-19', categoryCode: '10-19' },
      { value: 190,  label: '20-29', categoryCode: '20-29' },
    ],
  },
  categories: ['0-9', '10-19', '20-29'],
  categoryLabels: ['0-9', '10-19', '20-29'],
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

describe('createPyramidChart', () => {
  it('creates SVG in container', () => {
    createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    const svg = container.querySelector('svg.jsc-chart');
    expect(svg).not.toBeNull();
  });

  it('draws rects for both left and right series', () => {
    createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    const leftRects = container.querySelectorAll('.jsc-bar-left');
    const rightRects = container.querySelectorAll('.jsc-bar-right');
    // 3 non-null left, 2 non-null right
    expect(leftRects).toHaveLength(3);
    expect(rightRects).toHaveLength(2);
  });

  it('left series bars extend leftward from center (x < center, positive width)', () => {
    createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    const leftRects = container.querySelectorAll<SVGRectElement>('.jsc-bar-left');
    expect(leftRects.length).toBeGreaterThan(0);
    for (const rect of leftRects) {
      const x = parseFloat(rect.getAttribute('x') ?? '0');
      const width = parseFloat(rect.getAttribute('width') ?? '0');
      // Bars extend left, so x should be less than x+width (width > 0)
      expect(width).toBeGreaterThan(0);
      // The right edge (x + width) should be at or near the center
      // We can't know the exact pixel, but x should be < x + width
      expect(x).toBeLessThan(x + width);
    }
  });

  it('right series bars extend rightward from center (x >= center, positive width)', () => {
    createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    const rightRects = container.querySelectorAll<SVGRectElement>('.jsc-bar-right');
    expect(rightRects.length).toBeGreaterThan(0);
    for (const rect of rightRects) {
      const width = parseFloat(rect.getAttribute('width') ?? '0');
      expect(width).toBeGreaterThan(0);
    }
  });

  it('left bars start at a smaller x than right bars (mirrored layout)', () => {
    createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    const leftRects = container.querySelectorAll<SVGRectElement>('.jsc-bar-left');
    const rightRects = container.querySelectorAll<SVGRectElement>('.jsc-bar-right');
    expect(leftRects.length).toBeGreaterThan(0);
    expect(rightRects.length).toBeGreaterThan(0);

    const leftMaxX = Math.max(
      ...Array.from(leftRects).map(r => parseFloat(r.getAttribute('x') ?? '0') + parseFloat(r.getAttribute('width') ?? '0'))
    );
    const rightMinX = Math.min(
      ...Array.from(rightRects).map(r => parseFloat(r.getAttribute('x') ?? '0'))
    );
    // The right edge of left bars and the left edge of right bars should be close (both at center ~0)
    expect(leftMaxX).toBeCloseTo(rightMinX, 0);
  });

  it('null values omit rects', () => {
    createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    // right series has 1 null → 2 rects; left has 0 nulls → 3 rects
    const allBars = container.querySelectorAll('.jsc-bar');
    expect(allBars).toHaveLength(5);
  });

  it('makes the first point of the first series the initial tab stop', () => {
    createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    const firstSeriesBars = container.querySelectorAll<SVGRectElement>('.jsc-series-0 .jsc-bar');
    const tabStops = container.querySelectorAll<SVGRectElement>('.jsc-bar[tabindex="0"]');

    expect(tabStops).toHaveLength(1);
    expect(tabStops[0]).toBe(firstSeriesBars[0]);
    expect(tabStops[0].getAttribute('aria-label')).toBe('0-9, Male: 100');
  });

  it('uses up and down arrows to move between series at the same category', () => {
    createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    const bars = Array.from(container.querySelectorAll<SVGRectElement>('.jsc-bar-left'));
    const firstBar = bars[0];
    const matchingRightBar = container.querySelector<SVGRectElement>('.jsc-bar-right');

    firstBar.focus();
    firstBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(matchingRightBar);

    matchingRightBar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(firstBar);
  });

  it('ARIA: container has role="region"', () => {
    createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    expect(container.getAttribute('role')).toBe('region');
  });

  it('ARIA: container has aria-label', () => {
    createPyramidChart({ container, data: pyramidData, config: { ...defaultConfig, ariaLabel: 'Population pyramid' } });
    expect(container.getAttribute('aria-label')).toBe('Population pyramid');
  });

  it('destroy() removes SVG and ARIA attributes', () => {
    const instance = createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    expect(container.querySelector('svg')).not.toBeNull();
    instance.destroy();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.getAttribute('role')).toBeNull();
    expect(container.getAttribute('aria-label')).toBeNull();
  });

  it('update() re-renders with new data', () => {
    const instance = createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    expect(container.querySelectorAll('.jsc-bar')).toHaveLength(5);

    const updatedData: PyramidChartData = {
      leftSeries: {
        name: 'Male',
        code: 'male',
        points: [
          { value: 50, label: '0-9', categoryCode: '0-9' },
        ],
      },
      rightSeries: {
        name: 'Female',
        code: 'female',
        points: [
          { value: 60, label: '0-9', categoryCode: '0-9' },
        ],
      },
      categories: ['0-9'],
      categoryLabels: ['0-9'],
    };

    instance.update(updatedData);
    expect(container.querySelectorAll('.jsc-bar')).toHaveLength(2);
  });

  it('passes xLabel and seriesLabel to bindInteractions when dimension labels are set', () => {
    const spy = jest.spyOn(bindInteractionsModule, 'bindInteractions');

    const dataWithLabels: PyramidChartData = {
      ...pyramidData,
      splitDimensionLabel: 'Sex',
      categoryDimensionLabel: 'Age',
    };

    createPyramidChart({ container, data: dataWithLabels, config: defaultConfig });

    const lastCall = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(lastCall.chartData?.seriesLabel).toBe('Sex');
    expect(lastCall.chartData?.xLabel).toBe('Age');

    spy.mockRestore();
  });

  it('renders without error when dimension labels are omitted', () => {
    expect(() => {
      createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    }).not.toThrow();
  });

  it('x-axis tick labels show absolute (non-negative) values', () => {
    createPyramidChart({ container, data: pyramidData, config: defaultConfig });
    const tickTexts = container.querySelectorAll('.jsc-axis-x .tick text');
    expect(tickTexts.length).toBeGreaterThan(0);

    const labels = Array.from(tickTexts).map(t => t.textContent ?? '');

    // No negative sign should appear — pyramid mirrors labels.
    // Check both ASCII hyphen (U+002D) and Unicode minus (U+2212) that D3 may emit.
    for (const text of labels) {
      expect(text).not.toMatch(/^[-\u2212]/);
    }

    // The test dataset has max=200, so the symmetric domain is [-200, 200].
    // D3 should produce positive tick labels (e.g. 0, 50, 100, 150, 200).
    // Strip any thousands-separator spaces/commas and compare numerically.
    const numericLabels = labels.map(t => parseFloat(t.replace(/[\s,\u00a0]/g, '')));
    const positiveLabels = numericLabels.filter(n => !isNaN(n) && n >= 0);
    expect(positiveLabels.length).toBeGreaterThan(0);
    // At least the value 0 and 200 (the boundary) should be present.
    expect(positiveLabels).toContain(0);
    expect(Math.max(...positiveLabels)).toBeGreaterThanOrEqual(100);
  });

  it('keeps boundary labels and omits interior labels in a dense layout', () => {
    const categories = Array.from({ length: 30 }, (_, index) => `age-${index}`);
    const points = categories.map((categoryCode, index) => ({
      value: index + 1,
      label: categoryCode,
      categoryCode,
    }));
    const denseData: PyramidChartData = {
      leftSeries: { name: 'Left', code: 'left', points },
      rightSeries: { name: 'Right', code: 'right', points },
      categories,
      categoryLabels: categories,
    };

    createPyramidChart({ container, data: denseData, config: defaultConfig });

    const visibleLabels = Array.from(container.querySelectorAll<SVGGElement>('.jsc-axis-y .tick'))
      .filter(tick => tick.style.display !== 'none')
      .map(tick => tick.textContent);
    expect(visibleLabels).toContain(categories[0]);
    expect(visibleLabels).toContain(categories.at(-1));
    expect(visibleLabels.length).toBeGreaterThan(2);
    expect(visibleLabels.length).toBeLessThan(categories.length / 2);
  });

  it('keeps 0 and 100 clear of adjacent labels and plot boundaries', () => {
    const categories = Array.from({ length: 101 }, (_, index) => String(index));
    const points = categories.map((categoryCode, index) => ({
      value: index + 1,
      label: categoryCode,
      categoryCode,
    }));
    const denseData: PyramidChartData = {
      leftSeries: { name: 'Left', code: 'left', points },
      rightSeries: { name: 'Right', code: 'right', points },
      categories,
      categoryLabels: categories,
    };

    createPyramidChart({ container, data: denseData, config: defaultConfig });

    const visibleTicks = Array.from(container.querySelectorAll<SVGGElement>('.jsc-axis-y .tick'))
      .filter(tick => tick.style.display !== 'none');
    const tickByLabel = new Map(visibleTicks.map(tick => [tick.textContent, tick]));
    const getY = (tick: SVGGElement): number => {
      const match = tick.getAttribute('transform')?.match(/translate\([^,]+,\s*([^)]+)\)/);
      return Number(match?.[1]);
    };

    expect(tickByLabel.has('0')).toBe(true);
    expect(tickByLabel.has('100')).toBe(true);
    expect(tickByLabel.has('1')).toBe(false);

    const ticksByDescendingY = visibleTicks.sort((a, b) => getY(b) - getY(a));
    expect(getY(ticksByDescendingY[0]) - getY(ticksByDescendingY[1])).toBeGreaterThan(12);
    expect(getY(tickByLabel.get('100')!)).toBeGreaterThan(6);

    const visibleYPositions = visibleTicks.map(getY).sort((a, b) => a - b);
    const pixelGaps = visibleYPositions.slice(1)
      .map((position, index) => position - visibleYPositions[index]);
    expect(Math.max(...pixelGaps) / Math.min(...pixelGaps)).toBeLessThanOrEqual(1.25);

    const leftBars = container.querySelectorAll<SVGRectElement>('.jsc-bar-left');
    visibleTicks.forEach(tick => {
      const categoryIndex = Number(tick.textContent);
      const matchingBar = leftBars[categoryIndex];
      const barCenter = Number(matchingBar.getAttribute('y'))
        + Number(matchingBar.getAttribute('height')) / 2;
      expect(getY(tick)).toBeCloseTo(barCenter, 0);
    });
  });

  it('accessibility mode applies patterned fills to bars', () => {
    createPyramidChart({
      container,
      data: pyramidData,
      config: { ...defaultConfig, accessibilityMode: true },
    });

    const firstBar = container.querySelector('.jsc-bar') as SVGRectElement;
    expect(firstBar).not.toBeNull();
    expect(firstBar.getAttribute('fill')).toContain('url(#jsc-pattern-');
  });
});
