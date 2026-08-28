import { ChartScaffold, ChartScaffoldConfig, CategoricalScaffoldConfig } from '../../src/charts/base';
import { getTickPositions } from '../../src/layout/tick-positions';
import { ZoneType } from '../../src/types';

// Mock ResizeObserver (not available in jsdom)
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = MockResizeObserver;

// Mock matchMedia (not available in jsdom)
(window as any).matchMedia = jest.fn().mockReturnValue({ matches: false });

function createContainer(width = 800, height = 400): HTMLDivElement {
  const div = document.createElement('div');
  document.body.appendChild(div);
  Object.defineProperty(div, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(div, 'clientHeight', { value: height, configurable: true });
  return div;
}

function createScaffoldConfig(overrides: Partial<CategoricalScaffoldConfig> = {}): ChartScaffoldConfig {
  return {
    mode: 'categorical' as const,
    container: createContainer(),
    chartType: 'verticalBar',
    config: {},
    seriesCount: 2,
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    valueRange: [0, 100],
    ...overrides,
  };
}

describe('ChartScaffold', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('render() creates SVG with viewBox matching container dimensions', () => {
    const scaffold = new ChartScaffold(createScaffoldConfig());
    scaffold.render();
    const svg = document.querySelector('svg.jsc-chart');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 800 400');
  });

  it('SVG root does not have aria-hidden', () => {
    const scaffold = new ChartScaffold(createScaffoldConfig());
    scaffold.render();
    const svg = document.querySelector('svg.jsc-chart');
    expect(svg?.getAttribute('aria-hidden')).toBeNull();
  });

  it('decorative SVG groups have aria-hidden="true"', () => {
    const scaffold = new ChartScaffold(
      createScaffoldConfig({
        config: {
          title: 'Test Chart',
          showHeader: true,
          footerItems: [{ label: 'Source:', value: 'Test', type: 'source' }],
        },
      })
    );
    scaffold.render();
    expect(document.querySelector('.jsc-grid')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.jsc-header')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.jsc-axis-y')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.jsc-axis-x')?.getAttribute('aria-hidden')).toBe('true');
    // footer is informational and must be visible to screen readers
    expect(document.querySelector('.jsc-footer')?.getAttribute('aria-hidden')).toBeNull();
  });

  it('reserves nested-config burger clearance without rendering a disabled header', () => {
    const scaffold = new ChartScaffold(createScaffoldConfig({
      config: { title: 'Hidden Title', showHeader: false, burgerMenuVisible: true },
    }));
    const context = scaffold.render();

    expect(document.querySelector('.jsc-header')).toBeNull();
    expect(context.plotArea.y).toBe(48);
  });

  it('wraps the header title before the burger menu', () => {
    const scaffold = new ChartScaffold(createScaffoldConfig({
      container: createContainer(240),
      config: {
        title: 'A very long chart heading',
        showHeader: true,
        burgerMenuVisible: true,
      },
    }));
    scaffold.render();

    expect(document.querySelectorAll('.jsc-title tspan')).toHaveLength(2);
  });

  it('render() uses custom tick positions from getTickPositions', () => {
    const scaffold = new ChartScaffold(createScaffoldConfig({ valueRange: [0, 1000] }));
    const context = scaffold.render();
    const plotHeight = context.plotArea.height;
    // Chart pads the range before computing ticks (5% headroom on max; min=0 is not padded)
    const paddedMax = 1000 + (1000 - 0) * 0.05; // 1050
    const rawTicks = getTickPositions(0, paddedMax, plotHeight, undefined, context.theme.fontSizeTick);
    const expectedTicks = rawTicks.length >= 2 ? rawTicks : [0, paddedMax];
    const gridLines = document.querySelectorAll('.jsc-grid line');
    expect(gridLines.length).toBeGreaterThan(0);
    expect(gridLines.length).toBe(expectedTicks.length);
  });

  it('render() applies fitted labels to band axis', () => {
    const longCategories = [
      'Very Long Category Name One',
      'Another Long Name Two',
      'Third Category Name',
      'Fourth Long Name',
    ];
    const scaffold = new ChartScaffold(createScaffoldConfig({ categories: longCategories }));
    scaffold.render();
    const tspans = document.querySelectorAll('.jsc-axis-x .tick text tspan');
    expect(tspans.length).toBeGreaterThan(0);
  });

  it('render() renders legend overlay when seriesCount > 1', () => {
    const scaffold = new ChartScaffold(
      createScaffoldConfig({
        seriesCount: 3,
        seriesNames: ['A', 'B', 'C'],
        config: { showLegend: true },
      })
    );
    scaffold.render();
    const legend = document.querySelector('.jsc-legend') as HTMLDivElement | null;
    expect(legend).not.toBeNull();
    expect(legend?.style.position).toBe('absolute');
  });

  it('render() does not render legend when seriesCount is 1', () => {
    const scaffold = new ChartScaffold(createScaffoldConfig({ seriesCount: 1 }));
    scaffold.render();
    const legend = document.querySelector('.jsc-legend');
    expect(legend).toBeNull();
  });

  it('setSeriesToggle callback is exposed in render context', () => {
    const cfg = createScaffoldConfig({
      seriesCount: 2,
      seriesNames: ['A', 'B'],
      config: { showLegend: true },
    });
    const scaffold = new ChartScaffold(cfg);
    const context = scaffold.render();

    expect(context.setSeriesToggle).toBeDefined();

    const toggleCb = jest.fn();
    context.setSeriesToggle!(toggleCb);

    const firstBtn = cfg.container.querySelector('.jsc-legend-item') as HTMLButtonElement;
    expect(firstBtn).not.toBeNull();
    firstBtn.click();
    expect(toggleCb).toHaveBeenCalledWith(0, false);
  });

  it('render() sets container position to relative when static', () => {
    const container = createContainer();
    container.style.position = 'static';
    new ChartScaffold({
      mode: 'categorical' as const,
      container,
      chartType: 'verticalBar',
      config: {},
      seriesCount: 1,
      categories: ['A'],
      valueRange: [0, 10],
    });
    expect(container.style.position).toBe('relative');
  });

  it('destroy() removes SVG and legend', () => {
    const cfg = createScaffoldConfig({
      seriesCount: 2,
      seriesNames: ['A', 'B'],
      config: { showLegend: true },
    });
    const scaffold = new ChartScaffold(cfg);
    scaffold.render();
    expect(cfg.container.querySelector('svg')).not.toBeNull();
    expect(cfg.container.querySelector('.jsc-legend')).not.toBeNull();
    scaffold.destroy();
    expect(cfg.container.querySelector('svg')).toBeNull();
    expect(cfg.container.querySelector('.jsc-legend')).toBeNull();
  });

  it('render() cleans up previous legend on re-render', () => {
    const cfg = createScaffoldConfig({
      seriesCount: 2,
      seriesNames: ['A', 'B'],
      config: { showLegend: true },
    });
    const scaffold = new ChartScaffold(cfg);
    scaffold.render();
    scaffold.render();
    const legends = cfg.container.querySelectorAll('.jsc-legend');
    expect(legends.length).toBe(1);
  });

  it('render() renders footer items', () => {
    const scaffold = new ChartScaffold(
      createScaffoldConfig({
        config: { footerItems: [{ label: 'Source:', value: 'Test', type: 'source' }] },
      })
    );
    scaffold.render();
    const footerText = document.querySelector('.jsc-footer-text');
    expect(footerText).not.toBeNull();
  });

  it('x-axis tick lines have y2 = 8 (X_AXIS_TICK_SIZE)', () => {
    const scaffold = new ChartScaffold(createScaffoldConfig());
    scaffold.render();
    const tickLines = document.querySelectorAll('.jsc-axis-x .tick line');
    expect(tickLines.length).toBeGreaterThan(0);
    tickLines.forEach((line) => {
      expect(line.getAttribute('y2')).toBe('8');
    });
  });

  it('x-axis label text elements have y = 12 (X_AXIS_TICK_SIZE + X_AXIS_TICK_LABEL_GAP)', () => {
    const scaffold = new ChartScaffold(createScaffoldConfig());
    scaffold.render();
    const tickTexts = document.querySelectorAll('.jsc-axis-x .tick text');
    expect(tickTexts.length).toBeGreaterThan(0);
    tickTexts.forEach((text) => {
      expect(text.getAttribute('y')).toBe('12');
    });
  });

  it('x-axis label text elements have dominant-baseline="hanging"', () => {
    const scaffold = new ChartScaffold(createScaffoldConfig());
    scaffold.render();
    const tickTexts = document.querySelectorAll('.jsc-axis-x .tick text');
    expect(tickTexts.length).toBeGreaterThan(0);
    tickTexts.forEach((text) => {
      expect(text.getAttribute('dominant-baseline')).toBe('hanging');
    });
  });

  it('axis tick lines use colorTick (#767676), not colorBorder (#cccccc)', () => {
    const scaffold = new ChartScaffold(createScaffoldConfig());
    scaffold.render();
    const tickLines = document.querySelectorAll('.jsc-axis-x line, .jsc-axis-y line');
    expect(tickLines.length).toBeGreaterThan(0);
    tickLines.forEach((line) => {
      expect(line.getAttribute('stroke')).toBe('#767676');
    });
  });

  it('axis domain paths use colorTick (#767676), not colorBorder (#cccccc)', () => {
    const scaffold = new ChartScaffold(createScaffoldConfig());
    scaffold.render();
    const domainPaths = document.querySelectorAll('.jsc-axis-x .domain, .jsc-axis-y .domain');
    expect(domainPaths.length).toBeGreaterThan(0);
    domainPaths.forEach((path) => {
      expect(path.getAttribute('stroke')).toBe('#767676');
    });
  });

  it.each(['verticalBar', 'horizontalBar'] as const)(
    '%s axis domain paths are straight lines without outer end caps',
    (chartType) => {
      const scaffold = new ChartScaffold(createScaffoldConfig({ chartType }));
      scaffold.render();

      const yDomain = document.querySelector('.jsc-axis-y .domain')?.getAttribute('d') ?? '';
      const xDomain = document.querySelector('.jsc-axis-x .domain')?.getAttribute('d') ?? '';
      expect(yDomain).toContain('V');
      expect(yDomain).not.toContain('H');
      expect(xDomain).toContain('H');
      expect(xDomain).not.toContain('V');
    },
  );

  it('grid lines use colorBorder (#aaaaaa), not colorTick (#555555)', () => {
    const scaffold = new ChartScaffold(
      createScaffoldConfig({ config: { theme: { colorBorder: '#aaaaaa', colorTick: '#555555' } } }),
    );
    scaffold.render();
    const gridLines = document.querySelectorAll('.jsc-grid line');
    expect(gridLines.length).toBeGreaterThan(0);
    gridLines.forEach((line) => {
      expect(line.getAttribute('stroke')).toBe('#aaaaaa');
    });
  });

  it('allocates enough y-axis width for large formatted tick labels', () => {
    // D3 formats tick values like 1_000_000 as "1,000,000" (9 chars with commas).
    // The buggy implementation used String(t).length = 7 ("1000000"), giving
    // YAxisLabels = 7 * 8 + 16 = 72px. The fix uses fmt(t).length = 9, giving
    // YAxisLabels = 9 * 8 + 16 = 88px. plotArea.x equals the YAxisLabels zone width.
    const scaffold = new ChartScaffold(createScaffoldConfig({ valueRange: [0, 6_000_000] }));
    const context = scaffold.render();

    expect(context.plotArea.x).toBeGreaterThanOrEqual(88);

    // The y-axis group transform x must match plotArea.x so labels are not clipped.
    const yAxisGroup = document.querySelector('.jsc-axis-y');
    const transform = yAxisGroup?.getAttribute('transform') ?? '';
    const match = transform.match(/translate\((\d+(?:\.\d+)?)/);
    const translateX = match ? parseFloat(match[1]) : 0;
    expect(translateX).toBe(context.plotArea.x);
  });

  it('Container has overflow hidden to prevent content bleed, and destroy() restores original overflow', () => {
    const container = document.createElement('div');
    container.style.overflow = 'auto';
    document.body.appendChild(container);
    const scaffold = new ChartScaffold(createScaffoldConfig({ container }));
    scaffold.render();
    expect(container.style.overflow).toBe('hidden');
    const svg = container.querySelector('svg.jsc-chart') as SVGSVGElement;
    expect(svg).not.toBeNull();
    expect(svg.style.overflow).not.toBe('visible');
    scaffold.destroy();
    expect(container.style.overflow).toBe('auto');
  });

  describe('domain headroom padding', () => {
    it('yScale domain equals tick range computed from padded values', () => {
      // valueRange [0, 100]: pre-tick padding gives paddedMax=105, so ticks are computed on [0, 105]
      // The domain equals the tick range — no post-tick empty space above top tick line
      const scaffold = new ChartScaffold(createScaffoldConfig({ valueRange: [0, 100] }));
      const context = scaffold.render();
      const yScale = context.yScale as import('d3-scale').ScaleLinear<number, number>;
      const [, domainMax] = yScale.domain();
      const paddedMax = 100 + (100 - 0) * 0.05; // 5% headroom applied before ticking
      const rawTicks = getTickPositions(0, paddedMax, context.plotArea.height, undefined, context.theme.fontSizeTick);
      const tickValues = rawTicks.length >= 2 ? rawTicks : [0, paddedMax];
      const lastTick = tickValues[tickValues.length - 1];
      expect(domainMax).toBe(lastTick);
      expect(domainMax).toBeGreaterThanOrEqual(100);
    });

    it('yScale domain min is exactly 0 for a chart starting at zero (no bottom padding)', () => {
      // minValue === 0, so padding must NOT be applied at the bottom
      const scaffold = new ChartScaffold(createScaffoldConfig({ valueRange: [0, 200] }));
      const context = scaffold.render();
      const yScale = context.yScale as import('d3-scale').ScaleLinear<number, number>;
      const [domainMin] = yScale.domain();
      expect(domainMin).toBe(0);
    });

    it('yScale domain min is slightly less than first tick for negative min boundary', () => {
      // minValue !== 0 and < 0: padding is applied to min before ticking, so the
      // first tick naturally covers beyond the data minimum; domain equals the tick range
      const scaffold = new ChartScaffold(createScaffoldConfig({ valueRange: [-50, 100] }));
      const context = scaffold.render();
      const yScale = context.yScale as import('d3-scale').ScaleLinear<number, number>;
      const [domainMin] = yScale.domain();
      const range = 100 - (-50); // 150
      const paddedMin = -50 - range * 0.05; // -57.5
      const paddedMax = 100 + range * 0.05; // 107.5
      const rawTicks = getTickPositions(paddedMin, paddedMax, context.plotArea.height, undefined, context.theme.fontSizeTick);
      const tickValues = rawTicks.length >= 2 ? rawTicks : [paddedMin, paddedMax];
      const firstTick = tickValues[0];
      expect(domainMin).toBe(firstTick);
      expect(domainMin).toBeLessThanOrEqual(-50);
    });

    it('no padding when data is inside tick range', () => {
      // valueRange [15, 85]: paddedMin=15 (min >= 0, no low-side pad), paddedMax=88.5
      // The domain equals the tick range computed from padded values
      const scaffold = new ChartScaffold(createScaffoldConfig({ valueRange: [15, 85] }));
      const context = scaffold.render();
      const yScale = context.yScale as import('d3-scale').ScaleLinear<number, number>;
      const [domainMin, domainMax] = yScale.domain();
      const paddedMax = 85 + (85 - 15) * 0.05; // 88.5
      const rawTicks = getTickPositions(15, paddedMax, context.plotArea.height, undefined, context.theme.fontSizeTick);
      const tickValues = rawTicks.length >= 2 ? rawTicks : [15, paddedMax];
      const firstTick = tickValues[0];
      const lastTick = tickValues[tickValues.length - 1];
      expect(domainMin).toBe(firstTick);
      expect(domainMax).toBe(lastTick);
    });

    it('horizontal chart: xScale domain equals tick range computed from padded values', () => {
      // Horizontal charts use xScale for the linear axis
      // valueRange [0, 100]: pre-tick padding gives paddedMax=105; domain equals the tick range
      const scaffold = new ChartScaffold(
        createScaffoldConfig({ chartType: 'horizontalBar', valueRange: [0, 100] })
      );
      const context = scaffold.render();
      const xScale = context.xScale as import('d3-scale').ScaleLinear<number, number>;
      const [, domainMax] = xScale.domain();
      const paddedMax = 100 + (100 - 0) * 0.05; // 5% headroom applied before ticking
      const rawTicks = getTickPositions(0, paddedMax, context.plotArea.width, undefined, context.theme.fontSizeTick);
      const tickValues = rawTicks.length >= 2 ? rawTicks : [0, paddedMax];
      const lastTick = tickValues[tickValues.length - 1];
      expect(domainMax).toBe(lastTick);
      expect(domainMax).toBeGreaterThanOrEqual(100);
    });

    it('all-negative range [-100, -50]: domain min padded further negative, domain max snaps to 0', () => {
      // padValueRange: min<0 so paddedMin=-102.5; max<=0 so paddedMax=-50 (no top padding)
      // getTickPositions snaps upperBound to 0 when dataMax<=0, so lastTick===0
      const scaffold = new ChartScaffold(createScaffoldConfig({ valueRange: [-100, -50] }));
      const context = scaffold.render();
      const yScale = context.yScale as import('d3-scale').ScaleLinear<number, number>;
      const [domainMin, domainMax] = yScale.domain();
      const range = -50 - (-100); // 50
      const paddedMin = -100 - range * 0.05; // -102.5
      const paddedMax = -50; // max<=0, no padding
      const rawTicks = getTickPositions(paddedMin, paddedMax, context.plotArea.height, undefined, context.theme.fontSizeTick);
      const tickValues = rawTicks.length >= 2 ? rawTicks : [paddedMin, paddedMax];
      const firstTick = tickValues[0];
      const lastTick = tickValues[tickValues.length - 1];
      expect(domainMin).toBe(firstTick);
      expect(domainMax).toBe(lastTick);
      expect(domainMin).toBeLessThanOrEqual(-100);
      expect(domainMax).toBe(0); // getTickPositions snaps upper bound to 0 for all-negative data
    });

    it('flat range [42, 42]: chart does not crash and produces valid scales', () => {
      // padValueRange returns [42, 42] since range===0
      // getTickPositions([42,42]) returns [42] (single tick); tickValues falls back to [42, 42]
      const scaffold = new ChartScaffold(createScaffoldConfig({ valueRange: [42, 42] }));
      const context = scaffold.render();
      const yScale = context.yScale as import('d3-scale').ScaleLinear<number, number>;
      const [domainMin, domainMax] = yScale.domain();
      expect(isFinite(domainMin)).toBe(true);
      expect(isFinite(domainMax)).toBe(true);
    });

    it('percent bar charts: domain is exactly 0-100 with no headroom', () => {
      const scaffold = new ChartScaffold(
        createScaffoldConfig({ chartType: 'percentVerticalBar', valueRange: [0, 100] })
      );
      const context = scaffold.render();
      const yScale = context.yScale as import('d3-scale').ScaleLinear<number, number>;
      const [domainMin, domainMax] = yScale.domain();
      expect(domainMin).toBe(0);
      expect(domainMax).toBe(100);
      scaffold.destroy();
    });

    it('percent horizontal bar charts: domain is exactly 0-100 with no headroom', () => {
      const scaffold = new ChartScaffold(
        createScaffoldConfig({ chartType: 'percentHorizontalBar', valueRange: [0, 100] })
      );
      const context = scaffold.render();
      const xScale = context.xScale as import('d3-scale').ScaleLinear<number, number>;
      const [domainMin, domainMax] = xScale.domain();
      expect(domainMin).toBe(0);
      expect(domainMax).toBe(100);
      scaffold.destroy();
    });
  });

  it('horizontal bar chart: RightMargin is non-zero and reflects formatted label width for large range', () => {
    // For a horizontal bar with valueRange [0, 6_000_000], D3 formats the last tick as
    // something like "6,000,000" (9 chars). The RightMargin should be non-zero to prevent
    // clipping of the last x-axis tick label.
    const scaffold = new ChartScaffold(
      createScaffoldConfig({ chartType: 'horizontalBar', valueRange: [0, 6_000_000] })
    );
    const context = scaffold.render();

    const rightMargin = context.layout.zones.get(ZoneType.RightMargin);
    expect(rightMargin).toBeDefined();
    // Old code used String(6000000).length = 7 → Math.min(Math.ceil(7*8/2), 40) = 28.
    // Fixed code uses D3 formatter → "6,000,000" (9 chars) → Math.min(Math.ceil(9*8/2), 40) = 36.
    expect(rightMargin!.width).toBeGreaterThanOrEqual(36);
  });

  it('decimal/small range: plotArea.x is non-zero (sanity)', () => {
    // For valueRange [0, 0.05], String(t) and D3's formatter both produce ~4-char
    // labels (e.g. "0.05"), so this case does not discriminate old vs fixed code.
    // This test guards basic sanity only; regression protection is provided by the
    // large-integer vertical test (>= 88) and the horizontal test (>= 36).
    const scaffold = new ChartScaffold(
      createScaffoldConfig({ valueRange: [0, 0.05] })
    );
    const context = scaffold.render();

    expect(context.plotArea.x).toBeGreaterThan(0);
  });

  describe('sourceLink', () => {
    it('wraps source footer item in SVG <a> when sourceLink is set', () => {
      const scaffold = new ChartScaffold(
        createScaffoldConfig({
          config: {
            footerItems: [{ label: 'Source:', value: 'Test', type: 'source' }],
            sourceLink: 'https://example.com',
          },
        })
      );
      scaffold.render();
      const footer = document.querySelector('.jsc-footer');
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

    it('does not wrap non-source footer items in <a>', () => {
      const scaffold = new ChartScaffold(
        createScaffoldConfig({
          config: {
            footerItems: [{ label: 'Updated:', value: '2024', type: 'updated' }],
            sourceLink: 'https://example.com',
          },
        })
      );
      scaffold.render();
      const footer = document.querySelector('.jsc-footer');
      expect(footer?.querySelector('a')).toBeNull();
    });

    it('does not create link when sourceLink is not set', () => {
      const scaffold = new ChartScaffold(
        createScaffoldConfig({
          config: {
            footerItems: [{ label: 'Source:', value: 'Test', type: 'source' }],
          },
        })
      );
      scaffold.render();
      const footer = document.querySelector('.jsc-footer');
      expect(footer?.querySelector('a')).toBeNull();
    });

    it('rejects javascript: URLs', () => {
      const scaffold = new ChartScaffold(
        createScaffoldConfig({
          config: {
            footerItems: [{ label: 'Source:', value: 'Test', type: 'source' }],
            sourceLink: 'javascript:alert(1)',
          },
        })
      );
      scaffold.render();
      const footer = document.querySelector('.jsc-footer');
      expect(footer?.querySelector('a')).toBeNull();
    });

    it('rejects data: URLs', () => {
      const scaffold = new ChartScaffold(
        createScaffoldConfig({
          config: {
            footerItems: [{ label: 'Source:', value: 'Test', type: 'source' }],
            sourceLink: 'data:text/html,<script>alert(1)</script>',
          },
        })
      );
      scaffold.render();
      const footer = document.querySelector('.jsc-footer');
      expect(footer?.querySelector('a')).toBeNull();
    });

    it('rejects malformed URLs with no host', () => {
      const scaffold = new ChartScaffold(
        createScaffoldConfig({
          config: {
            footerItems: [{ label: 'Source:', value: 'Test', type: 'source' }],
            sourceLink: 'https://',
          },
        })
      );
      scaffold.render();
      const footer = document.querySelector('.jsc-footer');
      expect(footer?.querySelector('a')).toBeNull();
    });
  });

  describe('footer label+value', () => {
    it('renders label and value as separate tspans when footer item has label+value', () => {
      const scaffold = new ChartScaffold(
        createScaffoldConfig({
          config: {
            footerItems: [{ type: 'source', label: 'Source:', value: 'Statistics Finland' }],
          },
        })
      );
      scaffold.render();
      const footer = document.querySelector('.jsc-footer');
      const labelTspan = footer?.querySelector('.jsc-footer-label');
      const valueTspan = footer?.querySelector('.jsc-footer-value');
      expect(labelTspan).not.toBeNull();
      expect(valueTspan).not.toBeNull();
      expect(labelTspan?.textContent).toBe('Source: ');
      expect(valueTspan?.textContent).toBe('Statistics Finland');
    });

    it('styles only the value tspan when sourceLink is set with label+value item', () => {
      const scaffold = new ChartScaffold(
        createScaffoldConfig({
          config: {
            footerItems: [{ type: 'source', label: 'Source:', value: 'Statistics Finland' }],
            sourceLink: 'https://example.com',
          },
        })
      );
      scaffold.render();
      const footer = document.querySelector('.jsc-footer');
      const anchor = footer?.querySelector('a');
      expect(anchor).not.toBeNull();
      const labelTspan = anchor?.querySelector('.jsc-footer-label');
      const valueTspan = anchor?.querySelector('.jsc-footer-value');
      expect(labelTspan).not.toBeNull();
      expect(labelTspan?.getAttribute('pointer-events')).toBe('none');
      expect(valueTspan).not.toBeNull();
      expect(valueTspan?.getAttribute('fill')).toBe('#0563C1');
      expect(valueTspan?.getAttribute('style')).toContain('cursor: pointer');
    });

  });
});
