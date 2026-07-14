import { createPieChart } from '../../src/charts/pie';
import { ChartData, ChartConfig } from '../../src/types';
import { DEFAULT_THEME } from '../../src/theme/defaults';

beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (window as any).matchMedia = jest.fn().mockReturnValue({ matches: false });
});

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

  it('draws correct number of slices — one per non-null value', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });
    const slices = container.querySelectorAll('.jsc-slice');
    // 3 non-null points (Helsinki, Tampere, Turku); null Oulu excluded
    expect(slices.length).toBe(3);
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
    expect(slices.length).toBe(2);
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

  it('ARIA: container has role="figure"', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });
    expect(container.getAttribute('role')).toBe('figure');
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

  it('toggling a slice off reflows the pie — slice is removed from DOM', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });

    expect(container.querySelectorAll('.jsc-slice').length).toBe(3);

    // Legend renders one button per non-null point for pie charts
    const legendButtons = container.querySelectorAll('.jsc-legend-item');
    expect(legendButtons.length).toBe(3);

    // Toggle off slice 0 (Helsinki)
    (legendButtons[0] as HTMLElement).click();

    // Only 2 slices should be in the DOM — no hidden display:none remnants
    expect(container.querySelectorAll('.jsc-slice').length).toBe(2);
  });

  it('toggling a slice off then on restores all slices', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });

    const legendButtons = container.querySelectorAll('.jsc-legend-item');
    (legendButtons[0] as HTMLElement).click(); // toggle off
    expect(container.querySelectorAll('.jsc-slice').length).toBe(2);

    (container.querySelectorAll('.jsc-legend-item')[0] as HTMLElement).click(); // toggle on
    expect(container.querySelectorAll('.jsc-slice').length).toBe(3);
  });

  it('update() resets hidden slices so all slices reappear', () => {
    const instance = createPieChart({ container, data: pieData, config: defaultConfig });

    const legendButtons = container.querySelectorAll('.jsc-legend-item');
    (legendButtons[0] as HTMLElement).click(); // hide slice 0
    expect(container.querySelectorAll('.jsc-slice').length).toBe(2);

    instance.update(pieData);
    expect(container.querySelectorAll('.jsc-slice').length).toBe(3);
  });

  it('handles nulls in the middle correctly for screen reader data', () => {
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
    expect(srTable).not.toBeNull();
    const rows = srTable!.querySelectorAll('tbody tr');
    // Only 2 non-null rows: Alpha and Charlie
    expect(rows.length).toBe(2);
    const firstRowLabel = rows[0].querySelector('th, td')?.textContent;
    const secondRowLabel = rows[1].querySelector('th, td')?.textContent;
    expect(firstRowLabel).toContain('Alpha');
    expect(secondRowLabel).toContain('Charlie');
  });

  it('remaining slices preserve their original colors after a toggle', () => {
    createPieChart({ container, data: pieData, config: defaultConfig });

    // Record the fill colors of slices 1 and 2 before any toggle
    const slicesBefore = container.querySelectorAll<SVGPathElement>('.jsc-slice');
    const fillSlice1Before = slicesBefore[1].getAttribute('fill');
    const fillSlice2Before = slicesBefore[2].getAttribute('fill');

    // Toggle off slice 0 (Helsinki) — slices 1 and 2 should keep their original colors
    const legendButtons = container.querySelectorAll('.jsc-legend-item');
    (legendButtons[0] as HTMLElement).click();

    const slicesAfter = container.querySelectorAll<SVGPathElement>('.jsc-slice');
    expect(slicesAfter[0].getAttribute('fill')).toBe(fillSlice1Before);
    expect(slicesAfter[1].getAttribute('fill')).toBe(fillSlice2Before);
  });
});
