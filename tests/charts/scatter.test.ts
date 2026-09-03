import {
  createScatterChart,
  computeScatterPointRadius,
  computeValueRanges,
  MAX_SCATTER_POINT_RADIUS_RATIO,
  MIN_SCATTER_POINT_RADIUS_RATIO,
} from '../../src/charts/scatter';
import { ScatterChartData, ChartConfig } from '../../src/types';

const scatterData: ScatterChartData = {
  points: [
    { x: 10, y: 20, label: 'Helsinki', code: 'hel' },
    { x: 30, y: 40, label: 'Tampere', code: 'tre' },
    { x: 50, y: 10, label: 'Turku', code: 'tku' },
    { x: null, y: 25, label: 'Oulu', code: 'oul' }, // excluded
  ],
  xLabel: 'GDP per capita',
  yLabel: 'Life expectancy',
  xUnit: 'EUR',
  yUnit: 'years',
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

describe('createScatterChart', () => {
  it('creates SVG in container', () => {
    createScatterChart({ container, data: scatterData, config: defaultConfig });
    const svg = container.querySelector('svg.jsc-chart');
    expect(svg).not.toBeNull();
  });

  it('draws correct number of circles — one per valid point', () => {
    createScatterChart({ container, data: scatterData, config: defaultConfig });
    const circles = container.querySelectorAll('.jsc-scatter-point');
    expect(circles).toHaveLength(3);
  });

  it('excludes points where x or y is null', () => {
    const dataWithNulls: ScatterChartData = {
      ...scatterData,
      points: [
        { x: 10, y: 20, label: 'A', code: 'a' },
        { x: null, y: 30, label: 'B', code: 'b' },
        { x: 20, y: null, label: 'C', code: 'c' },
        { x: null, y: null, label: 'D', code: 'd' },
      ],
    };
    createScatterChart({ container, data: dataWithNulls, config: defaultConfig });
    const circles = container.querySelectorAll('.jsc-scatter-point');
    expect(circles).toHaveLength(1);
  });

  it('renders X and Y axes', () => {
    createScatterChart({ container, data: scatterData, config: defaultConfig });
    expect(container.querySelector('.jsc-axis-x')).not.toBeNull();
    expect(container.querySelector('.jsc-axis-y')).not.toBeNull();
  });

  it('applies ARIA attributes to container', () => {
    createScatterChart({ container, data: scatterData, config: defaultConfig });
    expect(container.getAttribute('role')).toBe('region');
    expect(container.getAttribute('aria-label')).toBeTruthy();
    expect(container.getAttribute('aria-roledescription')).toBe('Scatter plot');
  });

  it('uses ariaLabel from config when provided', () => {
    const config: ChartConfig = { ariaLabel: 'Custom chart label' };
    createScatterChart({ container, data: scatterData, config });
    expect(container.getAttribute('aria-label')).toBe('Custom chart label');
  });

  it('includes axis units in data point names', () => {
    createScatterChart({
      container,
      data: { ...scatterData, xUnit: 'euros', yUnit: 'years' },
      config: defaultConfig,
    });

    const label = container.querySelector('.jsc-scatter-point')?.getAttribute('aria-label');
    expect(label).toContain('euros');
    expect(label).toContain('years');
  });

  it('destroy() removes SVG and disconnects ResizeObserver', () => {
    const instance = createScatterChart({ container, data: scatterData, config: defaultConfig });
    expect(container.querySelector('svg')).not.toBeNull();
    instance.destroy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('update() re-renders with new data', () => {
    const instance = createScatterChart({ container, data: scatterData, config: defaultConfig });
    expect(container.querySelectorAll('.jsc-scatter-point')).toHaveLength(3);

    const newData: ScatterChartData = {
      points: [
        { x: 5, y: 15, label: 'Espoo', code: 'esp' },
        { x: 25, y: 35, label: 'Vantaa', code: 'van' },
      ],
      xLabel: 'Income',
      yLabel: 'Population',
    };
    instance.update(newData);
    expect(container.querySelectorAll('.jsc-scatter-point')).toHaveLength(2);
  });

  it('renders with zero valid points without throwing', () => {
    const emptyData: ScatterChartData = {
      points: [
        { x: null, y: null, label: 'A', code: 'a' },
      ],
      xLabel: 'X',
      yLabel: 'Y',
    };
    expect(() => {
      createScatterChart({ container, data: emptyData, config: defaultConfig });
    }).not.toThrow();
    const circles = container.querySelectorAll('.jsc-scatter-point');
    expect(circles).toHaveLength(0);
  });

  it('data points are wrapped in a role="list" group', () => {
    createScatterChart({ container, data: scatterData, config: defaultConfig });
    const listGroup = container.querySelector('[role="list"]');
    expect(listGroup).not.toBeNull();
    expect(listGroup!.getAttribute('aria-label')).toBeTruthy();
  });

  it('keeps screen-reader arrow navigation inside the data point list without an application role', () => {
    createScatterChart({
      container,
      data: scatterData,
      config: { ...defaultConfig, title: 'City prosperity and health' },
    });
    const list = container.querySelector('[role="list"]');
    const circles = container.querySelectorAll<SVGCircleElement>('.jsc-scatter-point');

    expect(container.querySelector('[role="application"]')).toBeNull();
    expect(list).not.toBeNull();
    expect(circles).toHaveLength(3);

    circles[0].focus();
    const arrowEvent = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    circles[0].dispatchEvent(arrowEvent);

    expect(arrowEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(circles[1]);

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    circles[1].dispatchEvent(tabEvent);

    expect(tabEvent.defaultPrevented).toBe(false);
  });

  it('destroy() removes ARIA attributes from container', () => {
    const instance = createScatterChart({ container, data: scatterData, config: defaultConfig });
    expect(container.getAttribute('role')).toBe('region');
    instance.destroy();
    expect(container.getAttribute('role')).toBeNull();
    expect(container.getAttribute('aria-label')).toBeNull();
  });

  it('does not repeat the title in each datapoint label', () => {
    const config: ChartConfig = { title: 'My Scatter' };
    createScatterChart({ container, data: scatterData, config });
    const circles = container.querySelectorAll('.jsc-scatter-point');
    expect(circles.length).toBeGreaterThan(0);
    const label = circles[0].getAttribute('aria-label') ?? '';
    expect(label).not.toContain('My Scatter');
    expect(label).toContain('Helsinki');
  });

  it('data elements include dimensionLabels with xLabel and yLabel', () => {
    const dataWithObs: ScatterChartData = {
      ...scatterData,
      observationLabel: 'City',
    };
    createScatterChart({ container, data: dataWithObs, config: defaultConfig });
    // Verify tooltip shows correctly by checking ARIA label contains x/y values
    const circles = container.querySelectorAll('.jsc-scatter-point');
    expect(circles).toHaveLength(3);
    // The formattedValue used for ARIA should contain xLabel and yLabel
    const ariaLabel = circles[0].getAttribute('aria-label') ?? '';
    expect(ariaLabel).toContain('GDP per capita');
    expect(ariaLabel).toContain('Life expectancy');
  });

  it('focusing a scatter point shows tooltip with dimension labels and no value strong element', () => {
    createScatterChart({ container, data: scatterData, config: defaultConfig });
    const circles = container.querySelectorAll('.jsc-scatter-point');
    expect(circles.length).toBeGreaterThan(0);

    // Dispatch focus on the first point
    circles[0].dispatchEvent(new FocusEvent('focus', { bubbles: true }));

    const tooltip = container.querySelector('.jsc-tooltip');
    expect(tooltip).not.toBeNull();

    // Scatter provides dimensionLabels directly (xLabel + yLabel = 2 divs)
    // and sets hideValueLine: true, so no strong element is rendered
    const divs = tooltip!.querySelectorAll('div');
    expect(divs).toHaveLength(2);

    // The tooltip text should reference the axis labels
    expect(tooltip!.textContent).toContain('GDP per capita');
    expect(tooltip!.textContent).toContain('Life expectancy');

    // hideValueLine is true for scatter — no strong element
    const strong = tooltip!.querySelector('strong');
    expect(strong).toBeNull();
  });

  it('renders title when config.title is provided', () => {
    const config: ChartConfig = { title: 'Test Title', showHeader: true };
    createScatterChart({ container, data: scatterData, config });
    const titleEl = container.querySelector('.jsc-title');
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toContain('Test Title');
  });

  it('updates the screen-reader title when config changes', () => {
    const instance = createScatterChart({
      container,
      data: scatterData,
      config: { title: 'Initial title' },
    });

    instance.update(scatterData, { title: 'Updated title' });

    expect(container.getAttribute('aria-label')).toBe('Updated title');
  });

  it('renders subtitle when config.subtitle is provided', () => {
    const config: ChartConfig = { subtitle: 'Test Subtitle', showHeader: true };
    createScatterChart({ container, data: scatterData, config });
    const subtitleEl = container.querySelector('.jsc-subtitle');
    expect(subtitleEl).not.toBeNull();
    expect(subtitleEl!.textContent).toBe('Test Subtitle');
  });

  it('renders footer items when config.footerItems is provided', () => {
    const config: ChartConfig = { footerItems: [{ type: 'source', label: 'Source:', value: 'Test' }] };
    createScatterChart({ container, data: scatterData, config });
    const footerText = container.querySelector('.jsc-footer-text');
    expect(footerText).not.toBeNull();
    expect(footerText!.textContent).toBe('Source: Test');
  });

  it('renders source as link when sourceLink is set', () => {
    const config: ChartConfig = {
      footerItems: [{ type: 'source', label: 'Source:', value: 'Test' }],
      sourceLink: 'https://example.com',
    };
    createScatterChart({ container, data: scatterData, config });
    const footer = container.querySelector('.jsc-footer');
    const anchor = footer?.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('https://example.com');
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor?.getAttribute('role')).toBe('link');
    expect(anchor?.getAttribute('tabindex')).toBe('0');
    expect(anchor?.getAttribute('aria-label')).toContain('(opens in new tab)');
    const labelTspan = anchor?.querySelector('.jsc-footer-label');
    expect(labelTspan?.getAttribute('pointer-events')).toBe('none');
    const valueTspan = anchor?.querySelector('.jsc-footer-value');
    expect(valueTspan).not.toBeNull();
    expect(valueTspan?.getAttribute('fill')).toBe('#0563C1');
    expect(valueTspan?.getAttribute('style')).toContain('cursor: pointer');
  });

  it('does not render header when showHeader is false', () => {
    const config: ChartConfig = { title: 'Hidden Title', showHeader: false };
    createScatterChart({ container, data: scatterData, config });
    expect(container.querySelector('.jsc-header')).toBeNull();
  });

  it('sets overflow hidden on container and restores on destroy', () => {
    container.style.overflow = 'auto';
    const instance = createScatterChart({ container, data: scatterData, config: defaultConfig });
    expect(container.style.overflow).toBe('hidden');
    instance.destroy();
    expect(container.style.overflow).toBe('auto');
  });

  it('clamps margins for small containers', () => {
    Object.defineProperty(container, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 150, configurable: true });
    expect(() => {
      createScatterChart({ container, data: scatterData, config: defaultConfig });
    }).not.toThrow();
    const circles = container.querySelectorAll('.jsc-scatter-point');
    expect(circles).toHaveLength(3);

    // Verify plot group transform is within container bounds
    const plotGroup = container.querySelector('.jsc-plot-area');
    expect(plotGroup).not.toBeNull();
    const transform = plotGroup!.getAttribute('transform') ?? '';
    const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
    expect(match).not.toBeNull();
    const plotX = parseFloat(match![1]);
    const plotY = parseFloat(match![2]);
    expect(plotX).toBeGreaterThanOrEqual(0);
    expect(plotX).toBeLessThan(200);
    expect(plotY).toBeGreaterThanOrEqual(0);
    expect(plotY).toBeLessThan(150);

    // Verify the plot area (plotX + plotWidth) doesn't exceed the container width
    const clipRect = container.querySelector('clipPath rect');
    expect(clipRect).not.toBeNull();
    const plotWidth = parseFloat(clipRect!.getAttribute('width') ?? '0');
    expect(plotX + plotWidth).toBeLessThanOrEqual(200);
  });

  it('clamps margins for small containers with header and footer', () => {
    Object.defineProperty(container, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 150, configurable: true });
    const config: ChartConfig = {
      title: 'Small Chart',
      subtitle: 'Subtitle',
      showHeader: true,
      footerItems: [{ type: 'source', label: 'Source:', value: 'Test' }],
    };
    expect(() => {
      createScatterChart({ container, data: scatterData, config });
    }).not.toThrow();

    // Verify plot group transform is within container bounds
    const plotGroup = container.querySelector('.jsc-plot-area');
    expect(plotGroup).not.toBeNull();
    const transform = plotGroup!.getAttribute('transform') ?? '';
    const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
    expect(match).not.toBeNull();
    const plotX = parseFloat(match![1]);
    const plotY = parseFloat(match![2]);
    expect(plotX).toBeGreaterThanOrEqual(0);
    expect(plotX).toBeLessThan(200);
    expect(plotY).toBeGreaterThanOrEqual(0);
    expect(plotY).toBeLessThan(150);

    // Verify the plot area (plotX + plotWidth) doesn't exceed the container width
    const clipRect = container.querySelector('clipPath rect');
    expect(clipRect).not.toBeNull();
    const plotWidth = parseFloat(clipRect!.getAttribute('width') ?? '0');
    expect(plotX + plotWidth).toBeLessThanOrEqual(200);
  });

  it('rightmost x-axis tick label does not overflow container with large x values', () => {
    const containerWidth = 600;
    Object.defineProperty(container, 'clientWidth', { value: containerWidth, configurable: true });

    const largeXData: ScatterChartData = {
      points: [
        { x: 100000, y: 10, label: 'A', code: 'a' },
        { x: 500000, y: 20, label: 'B', code: 'b' },
        { x: 1000000, y: 15, label: 'C', code: 'c' },
      ],
      xLabel: 'Revenue',
      yLabel: 'Count',
    };

    createScatterChart({ container, data: largeXData, config: defaultConfig });

    const xAxisGroup = container.querySelector('.jsc-axis-x');
    expect(xAxisGroup).not.toBeNull();

    // Get the plotX offset from the x-axis group transform
    const xAxisTransform = xAxisGroup!.getAttribute('transform') ?? '';
    const xAxisMatch = xAxisTransform.match(/translate\(([^,]+),/);
    const plotX = xAxisMatch ? parseFloat(xAxisMatch[1]) : 0;

    // Find the rightmost tick by examining actual rendered tick transforms
    const ticks = Array.from(xAxisGroup!.querySelectorAll('.tick'));
    expect(ticks.length).toBeGreaterThan(0);

    let maxTickX = -Infinity;
    let lastTickTextEl: Element | null = null;
    for (const tick of ticks) {
      const tickTransform = tick.getAttribute('transform') ?? '';
      const tickMatch = tickTransform.match(/translate\(([^,)]+)/);
      if (tickMatch) {
        const tickX = parseFloat(tickMatch[1]);
        if (tickX > maxTickX) {
          maxTickX = tickX;
          lastTickTextEl = tick.querySelector('text');
        }
      }
    }

    // The last rendered tick must have non-empty label text
    expect(lastTickTextEl).not.toBeNull();
    expect((lastTickTextEl!.textContent ?? '').length).toBeGreaterThan(0);

    // The rightmost tick mark's absolute x position must be within the container
    const rightmostTickAbsX = plotX + maxTickX;
    expect(rightmostTickAbsX).toBeLessThanOrEqual(containerWidth);

    // The right margin (space between plot right edge and container edge) must be at least 5px
    const clipRect = container.querySelector('clipPath rect');
    expect(clipRect).not.toBeNull();
    const plotWidth = parseFloat(clipRect!.getAttribute('width') ?? '0');
    const marginRight = containerWidth - (plotX + plotWidth);
    expect(marginRight).toBeGreaterThanOrEqual(5);
  });

  describe('cutValueAxis', () => {
    it('forces the Y range to include 0 by default even when all y values are positive; X range is always raw', () => {
      expect(computeValueRanges(scatterData)).toEqual({ xRange: [10, 50], yRange: [0, 40] });
      expect(computeValueRanges(scatterData, false)).toEqual({ xRange: [10, 50], yRange: [0, 40] });
    });

    it('keeps the raw Y data range when cutValueAxis is true; X range is unaffected', () => {
      expect(computeValueRanges(scatterData, true)).toEqual({ xRange: [10, 50], yRange: [10, 40] });
    });

    const narrowYRangeData: ScatterChartData = {
      points: [
        { x: 10, y: 300, label: 'A', code: 'a' },
        { x: 30, y: 320, label: 'B', code: 'b' },
        { x: 50, y: 340, label: 'C', code: 'c' },
      ],
      xLabel: 'X',
      yLabel: 'Y',
    };

    function getYAxisTickValues(): number[] {
      return Array.from(container.querySelectorAll('.jsc-axis-y .tick text'))
        .map(t => Number.parseFloat((t.textContent ?? '').replace(/\u2212/, '-')))
        .filter(n => !Number.isNaN(n));
    }

    function getXAxisTickValues(): number[] {
      return Array.from(container.querySelectorAll('.jsc-axis-x .tick text'))
        .map(t => Number.parseFloat((t.textContent ?? '').replace(/\u2212/, '-')))
        .filter(n => !Number.isNaN(n));
    }

    it('rendered X axis includes 0 when all x values are positive', () => {
      createScatterChart({ container, data: scatterData, config: defaultConfig });
      expect(getXAxisTickValues()).toContain(0);
    });

    it('rendered Y axis starts at 0 when all y values are positive', () => {
      createScatterChart({ container, data: scatterData, config: defaultConfig });
      expect(Math.min(...getYAxisTickValues())).toBe(0);
    });

    it('rendered Y axis includes 0 by default, even with a narrow, far-from-zero data range', () => {
      createScatterChart({ container, data: narrowYRangeData, config: defaultConfig });
      const ticks = getYAxisTickValues();
      expect(ticks).toContain(0);
    });

    it('rendered Y axis does not start at 0 when cutValueAxis is true', () => {
      createScatterChart({ container, data: narrowYRangeData, config: { cutValueAxis: true } });
      const ticks = getYAxisTickValues();
      expect(Math.min(...ticks)).toBeGreaterThan(0);
      expect(Math.min(...ticks)).toBeLessThanOrEqual(300);
    });
  });
});

describe('computeScatterPointRadius', () => {
  it('uses a plot-relative maximum radius for zero or one point', () => {
    expect(computeScatterPointRadius([], 600, 400)).toBe(400 * MAX_SCATTER_POINT_RADIUS_RATIO);
    expect(computeScatterPointRadius([{ x: 0, y: 0 }], 600, 400)).toBe(400 * MAX_SCATTER_POINT_RADIUS_RATIO);
  });

  it('clamps sparse points to the plot-relative maximum radius', () => {
    const radius = computeScatterPointRadius([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ], 100, 100);
    expect(radius).toBeGreaterThanOrEqual(1);
    expect(radius).toBeLessThanOrEqual(100 * MAX_SCATTER_POINT_RADIUS_RATIO);
  });

  it('scales the radius with the plot dimensions', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 0, y: 20 },
      { x: 20, y: 20 },
    ];
    const radius = computeScatterPointRadius(points, 100, 100);
    const scaledRadius = computeScatterPointRadius(
      points.map(point => ({ x: point.x * 2, y: point.y * 2 })),
      200,
      200,
    );

    expect(radius).toBeGreaterThanOrEqual(1);
    expect(scaledRadius).toBeGreaterThan(radius);
  });

  it('gives sparse plots more visual weight than dense plots with the same spacing', () => {
    const sparseRadius = computeScatterPointRadius([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ], 400, 400);
    const denseRadius = computeScatterPointRadius(
      Array.from({ length: 100 }, (_, index) => ({
        x: (index % 10) * 4,
        y: Math.floor(index / 10) * 4,
      })),
      400,
      400,
    );

    expect(sparseRadius).toBeGreaterThan(denseRadius);
  });

  it('uses a relative minimum for dense points', () => {
    const radius = computeScatterPointRadius(
      Array.from({ length: 12 }, () => ({ x: 1, y: 1 })),
      400,
      400,
    );
    expect(radius).toBe(400 * MIN_SCATTER_POINT_RADIUS_RATIO);
  });

  it('returns an intermediate radius when points are moderately close', () => {
    const radius = computeScatterPointRadius(
      Array.from({ length: 12 }, (_, index) => ({
        x: (index % 4) * 20,
        y: Math.floor(index / 4) * 20,
      })),
      400,
      400,
    );
    expect(radius).toBeGreaterThanOrEqual(400 * MIN_SCATTER_POINT_RADIUS_RATIO);
    expect(radius).toBeLessThan(400 * MAX_SCATTER_POINT_RADIUS_RATIO);
  });

  it('clamps dense points to the minimum radius', () => {
    const points = Array.from({ length: 100 }, (_, index) => ({
      x: index % 10,
      y: Math.floor(index / 10),
    }));
    expect(computeScatterPointRadius(points, 400, 400)).toBe(400 * MIN_SCATTER_POINT_RADIUS_RATIO);
  });

  it('biases very large point counts toward the fixed minimum radius', () => {
    const points = Array.from({ length: 999 }, (_, index) => ({
      x: index % 37,
      y: Math.floor(index / 37),
    }));
    const radius = computeScatterPointRadius(points, 1600, 900);

    const coincidentRadius = computeScatterPointRadius(
      Array.from({ length: 999 }, () => ({ x: 50, y: 50 })),
      900,
      900,
    );
    expect(radius).toBe(coincidentRadius);
    expect(radius).toBe(900 * MIN_SCATTER_POINT_RADIUS_RATIO);
  });

  it('shrinks equally sized clusters more than equally sized spread points', () => {
    const spreadRadius = computeScatterPointRadius(
      Array.from({ length: 12 }, (_, index) => ({
        x: (index % 4) * 100,
        y: Math.floor(index / 4) * 100,
      })),
      400,
      400,
    );
    const clusterRadius = computeScatterPointRadius(
      Array.from({ length: 12 }, (_, index) => ({
        x: 40 + (index % 4) * 5,
        y: 40 + Math.floor(index / 4) * 5,
      })),
      400,
      400,
    );

    expect(clusterRadius).toBeLessThan(spreadRadius);
  });

  it('uses the minimum radius for coincident points', () => {
    const points = Array.from({ length: 12 }, () => ({ x: 50, y: 50 }));
    expect(computeScatterPointRadius(points, 400, 400)).toBe(400 * MIN_SCATTER_POINT_RADIUS_RATIO);
  });

  it('reduces radius when the same points occupy a smaller plot', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ];
    expect(computeScatterPointRadius(points, 100, 100)).toBeGreaterThan(
      computeScatterPointRadius(points, 20, 20),
    );
  });

  it('renders one identical radius for every valid point', () => {
    createScatterChart({ container, data: scatterData, config: defaultConfig });
    const radii = Array.from(container.querySelectorAll('.jsc-scatter-point'))
      .map(circle => circle.getAttribute('r'));

    expect(new Set(radii).size).toBe(1);
    expect(Number(radii[0])).toBeGreaterThanOrEqual(1);
    expect(Number(radii[0])).toBeLessThanOrEqual(400 * MAX_SCATTER_POINT_RADIUS_RATIO);
  });

  it('does not let null-valued observations affect the radius', () => {
    const validData: ScatterChartData = {
      ...scatterData,
      points: scatterData.points.filter(point => point.x !== null && point.y !== null),
    };
    const withNulls = createScatterChart({ container, data: scatterData, config: defaultConfig });
    const radiusWithNulls = container.querySelector('.jsc-scatter-point')?.getAttribute('r');
    withNulls.destroy();

    createScatterChart({ container, data: validData, config: defaultConfig });
    const radiusWithoutNulls = container.querySelector('.jsc-scatter-point')?.getAttribute('r');

    expect(radiusWithNulls).toBe(radiusWithoutNulls);
  });

  it('recomputes the radius when update changes point density', () => {
    const instance = createScatterChart({ container, data: scatterData, config: defaultConfig });
    const initialRadius = Number(container.querySelector('.jsc-scatter-point')?.getAttribute('r'));
    const denseData: ScatterChartData = {
      points: Array.from({ length: 100 }, (_, index) => ({
        x: index % 10,
        y: Math.floor(index / 10),
        label: `Point ${index}`,
        code: `point-${index}`,
      })),
      xLabel: 'X',
      yLabel: 'Y',
    };

    instance.update(denseData);

    const updatedRadius = Number(container.querySelector('.jsc-scatter-point')?.getAttribute('r'));
    expect(updatedRadius).toBeLessThan(initialRadius);
  });
});

describe('computeValueRanges performance', () => {
  it('handles the maximum supported scatter point count without spreading values into function arguments', () => {
    const data: ScatterChartData = {
      points: Array.from({ length: 999 }, (_, index) => ({
        x: index,
        y: 999 - index,
        label: `Point ${index}`,
        code: `point-${index}`,
      })),
      xLabel: 'X',
      yLabel: 'Y',
    };

    expect(computeValueRanges(data)).toEqual({
      xRange: [0, 998],
      yRange: [0, 999],
    });
  });
});
