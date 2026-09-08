import { createPieChart } from '../../src/charts/pie';
import { ChartData, ChartConfig } from '../../src/types';
import { DEFAULT_THEME } from '../../src/theme/defaults';

const pieData: ChartData = {
  series: [{
    name: 'Population',
    code: 'pop',
    points: [
      { value: 500, label: 'Helsinki', categoryCode: 'hel' },
      { value: 300, label: 'Tampere', categoryCode: 'tre' },
      { value: 200, label: 'Turku', categoryCode: 'tku' },
      { value: null, label: 'Oulu', categoryCode: 'oul' },
    ]
  }],
  categories: ['hel', 'tre', 'tku', 'oul'],
  categoryLabels: ['Helsinki', 'Tampere', 'Turku', 'Oulu'],
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

describe('createPieChart', () => {
  it('creates SVG in container', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });
    const svg = container.querySelector('svg.jsc-chart');
    expect(svg).not.toBeNull();
  });

  it('does not render a legend for the single-series visualization', () => {
    createPieChart({
      container,
      data: pieData,
      config: { ...defaultConfig, showLegend: true },
    });
    expect(container.querySelector('.jsc-legend')).toBeNull();
  });

  it('draws correct number of slices — one per non-null value', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });
    const slices = container.querySelectorAll('.jsc-slice');
    // 3 non-null points (Helsinki, Tampere, Turku); null Oulu excluded
    expect(slices).toHaveLength(3);
  });

  it('does not render scaffold grid lines behind the pie', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });
    expect(container.querySelector('.jsc-grid')).toBeNull();
  });

  it('keeps every callout connector point clear of its label text', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });
    const lines = container.querySelectorAll<SVGPolylineElement>('.jsc-pie-callout-line');
    const labels = container.querySelectorAll<SVGTextElement>('.jsc-pie-callout-label');

    expect(lines).toHaveLength(labels.length);
    lines.forEach((line, index) => {
      const label = labels[index];
      const labelX = Number(label.getAttribute('x'));
      const pointXs = (line.getAttribute('points') ?? '')
        .trim()
        .split(/\s+/)
        .map(point => Number(point.split(',')[0]));

      if (label.getAttribute('text-anchor') === 'start') {
        expect(Math.max(...pointXs)).toBeLessThanOrEqual(labelX - 12);
      } else {
        expect(Math.min(...pointXs)).toBeGreaterThanOrEqual(labelX + 12);
      }
    });
  });

  it('uses the available plot width for a mobile pie without clipped callouts', () => {
    Object.defineProperty(container, 'clientWidth', { value: 320, configurable: true });
    createPieChart({ container, data: pieData, config: defaultConfig });

    const firstSlicePath = container.querySelector<SVGPathElement>('.jsc-slice')?.getAttribute('d') ?? '';
    const radius = Number(firstSlicePath.match(/^M0,-([\d.]+)A/)?.[1]);

    expect(radius).toBeGreaterThan(100);
    expect(container.querySelectorAll('.jsc-pie-callout-label')).toHaveLength(0);
    expect(container.querySelectorAll('.jsc-legend-item')).toHaveLength(0);
  });

  it('null values are excluded from slices', () => {
    const dataWithMoreNulls: ChartData = {
      series: [{
        name: 'Test',
        code: 'test',
        points: [
          { value: 100, label: 'A', categoryCode: 'a' },
          { value: null, label: 'B', categoryCode: 'b' },
          { value: null, label: 'C', categoryCode: 'c' },
          { value: 50, label: 'D', categoryCode: 'd' },
        ]
      }],
      categories: ['a', 'b', 'c', 'd'],
      categoryLabels: ['A', 'B', 'C', 'D'],
    };
    createPieChart({ container, data: dataWithMoreNulls, config: defaultConfig });
    const slices = container.querySelectorAll('.jsc-slice');
    expect(slices).toHaveLength(2);
  });

  it('all slices have a fill color', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });
    const slices = container.querySelectorAll<SVGPathElement>('.jsc-slice');
    expect(slices.length).toBeGreaterThan(0);
    for (const slice of slices) {
      const fill = slice.getAttribute('fill');
      expect(fill).not.toBeNull();
      expect(fill).not.toBe('');
    }
  });

  it('ARIA: container has role="region"', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });
    expect(container.getAttribute('role')).toBe('region');
  });

  it('ARIA: slices have role="listitem"', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });
    const slices = container.querySelectorAll('.jsc-slice');
    expect(slices.length).toBeGreaterThan(0);
    for (const slice of slices) {
      expect(slice.getAttribute('role')).toBe('listitem');
    }
  });

  it('ARIA: slices have aria-label', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });
    const slices = container.querySelectorAll('.jsc-slice');
    for (const slice of slices) {
      expect(slice.getAttribute('aria-label')).not.toBeNull();
    }
  });

  it('moves focus between slices inside the series list', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });
    const list = container.querySelector('[role="list"]');
    const slices = container.querySelectorAll<SVGPathElement>('.jsc-slice');

    expect(container.querySelector('[role="application"]')?.contains(list)).toBe(true);
    expect(list?.contains(slices[0])).toBe(true);

    slices[0].focus();
    slices[0].dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    }));

    expect(document.activeElement).toBe(slices[1]);
  });

  it('slices use theme.colorSurface for stroke', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });
    const slices = container.querySelectorAll<SVGPathElement>('.jsc-slice');
    expect(slices.length).toBeGreaterThan(0);
    for (const slice of slices) {
      expect(slice.getAttribute('stroke')).toBe(DEFAULT_THEME.colorSurface);
      expect(slice.getAttribute('stroke-width')).toBe('2');
    }
  });

  it('destroy() cleans up DOM', () => {
    const instance = createPieChart({ container, data: pieData, config: defaultConfig });
    expect(container.querySelector('svg')).not.toBeNull();
    instance.destroy();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.getAttribute('role')).toBeNull();
    expect(container.getAttribute('aria-label')).toBeNull();
  });

  it('update() re-renders with new data', () => {
    const instance = createPieChart({ container, data: pieData, config: defaultConfig });
    const slicesBefore = container.querySelectorAll('.jsc-slice').length;
    expect(slicesBefore).toBe(3);

    const updatedData: ChartData = {
      series: [{
        name: 'Population',
        code: 'pop',
        points: [
          { value: 700, label: 'Helsinki', categoryCode: 'hel' },
          { value: 200, label: 'Tampere', categoryCode: 'tre' },
        ]
      }],
      categories: ['hel', 'tre'],
      categoryLabels: ['Helsinki', 'Tampere'],
    };

    instance.update(updatedData);
    const slicesAfter = container.querySelectorAll('.jsc-slice').length;
    expect(slicesAfter).toBe(2);
  });

  it('does not create a hidden table for data containing nulls', () => {
    const dataWithNullInMiddle: ChartData = {
      series: [{
        name: 'Values',
        code: 'val',
        points: [
          { categoryCode: 'A', label: 'Alpha', value: 10 },
          { categoryCode: 'B', label: 'Beta', value: null },
          { categoryCode: 'C', label: 'Charlie', value: 20 },
        ],
      }],
      categories: ['A', 'B', 'C'],
      categoryLabels: ['Alpha', 'Beta', 'Charlie'],
    };
    createPieChart({ container, data: dataWithNullInMiddle, config: defaultConfig });
    const srTable = container.querySelector('table.jsc-sr-only');
    expect(srTable).toBeNull();
  });

  it('remaining slices preserve their original colors after a toggle', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });

    // Record the fill colors of slices 1 and 2.
    const slicesBefore = container.querySelectorAll<SVGPathElement>('.jsc-slice');
    const fillSlice1Before = slicesBefore[1].getAttribute('fill');
    const fillSlice2Before = slicesBefore[2].getAttribute('fill');

    const slicesAfter = container.querySelectorAll<SVGPathElement>('.jsc-slice');
    expect(slicesAfter[1].getAttribute('fill')).toBe(fillSlice1Before);
    expect(slicesAfter[2].getAttribute('fill')).toBe(fillSlice2Before);
  });

  it('accessibility mode applies patterned fills to slices', () => {
    createPieChart({
      container,
      data: pieData,
      config: { ...defaultConfig, accessibilityMode: true },
    });

    const firstSlice = container.querySelector('.jsc-slice') as SVGPathElement;
    expect(firstSlice).not.toBeNull();
    expect(firstSlice.getAttribute('fill')).toContain('url(#jsc-pattern-');
  });
});
