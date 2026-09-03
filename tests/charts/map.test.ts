import { createMapChart } from '../../src/charts/map';
import { ChartConfig, MapChartData } from '../../src/types';

const regionFeature = {
  type: 'Feature' as const,
  properties: null,
  geometry: {
    type: 'Polygon' as const,
    coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
  },
};

const mapData: MapChartData = {
  regions: [
    { feature: regionFeature, value: 10, label: 'Region A', code: 'a', classIndex: 0, color: '#123456' },
  ],
  classification: { method: 'linear', scaleMin: 0, scaleMax: 10, colors: ['#123456'] },
  noDataColor: '#cccccc',
  hasNoData: false,
  geoDimensionLabel: 'Region',
  valueDimensionLabel: 'Population',
  unit: 'persons',
};

const multiRegionMapData: MapChartData = {
  regions: [
    { feature: regionFeature, value: 10, label: 'Region A', code: 'a', classIndex: 0, color: '#123456' },
    { feature: regionFeature, value: 20, label: 'Region B', code: 'b', classIndex: 0, color: '#654321' },
  ],
  classification: { method: 'linear', scaleMin: 0, scaleMax: 20, colors: ['#123456'] },
  noDataColor: '#cccccc',
  hasNoData: false,
  geoDimensionLabel: 'Region',
  valueDimensionLabel: 'Population',
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

describe('createMapChart accessible name', () => {
  it('uses config.title as the accessible name when no ariaLabel is provided', () => {
    createMapChart({ container, data: mapData, config: { ...defaultConfig, title: 'Population by region' } });
    expect(container.getAttribute('aria-label')).toBe('Population by region');
    expect(container.getAttribute('aria-roledescription')).toBe('Map');
  });

  it('prefers config.ariaLabel over config.title', () => {
    createMapChart({
      container,
      data: mapData,
      config: { ...defaultConfig, title: 'Population by region', ariaLabel: 'Custom map label' },
    });
    expect(container.getAttribute('aria-label')).toBe('Custom map label');
  });

  it('falls back to a localized generated description when neither is provided', () => {
    createMapChart({ container, data: mapData, config: { ...defaultConfig, locale: 'fi' } });
    const ariaLabel = container.getAttribute('aria-label') ?? '';
    expect(ariaLabel).toContain('Population');
    expect(ariaLabel).toContain('Region');
    expect(ariaLabel).toContain('muuttujana');
    expect(ariaLabel).toContain('aluetta');
  });
});

describe('createMapChart text layout', () => {
  it('wraps long titles and footer values in narrow containers', () => {
    Object.defineProperty(container, 'clientWidth', { value: 240, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
    const chart = createMapChart({
      container,
      data: mapData,
      config: {
        showHeader: true,
        title: 'General government establishments by detailed region',
        footerItems: [{
          type: 'source',
          label: 'Source:',
          value: 'Statistics Finland regional entrepreneurial activity',
        }],
      },
    });

    expect(container.querySelectorAll('.jsc-title tspan').length).toBeGreaterThan(1);
    expect(container.querySelectorAll('.jsc-footer-text').length).toBeGreaterThan(2);

    chart.destroy();
  });
});

describe('createMapChart keyboard accessibility', () => {
  it('does not hide the map svg from assistive technology', () => {
    createMapChart({ container, data: mapData, config: defaultConfig });
    const svg = container.querySelector('svg.jsc-chart');
    expect(svg?.getAttribute('aria-hidden')).toBeNull();
    expect(svg?.getAttribute('role')).toBe('none');
  });

  it('groups regions under a role="list" element', () => {
    createMapChart({ container, data: mapData, config: defaultConfig });
    const mapGroup = container.querySelector('.jsc-map-regions');
    expect(mapGroup?.parentElement?.getAttribute('role')).toBeNull();
    expect(mapGroup?.getAttribute('role')).toBe('list');
  });

  it('gives each region role="listitem" and an aria-label with name and value', () => {
    createMapChart({ container, data: mapData, config: defaultConfig });
    const region = container.querySelector('.jsc-map-region');
    expect(region?.getAttribute('role')).toBe('listitem');
    expect(region?.getAttribute('aria-label')).toBe('Region: Region A, 10 persons');
  });

  it('uses roving tabindex — only the first region is initially tabbable', () => {
    createMapChart({ container, data: multiRegionMapData, config: defaultConfig });
    const regions = container.querySelectorAll('.jsc-map-region');
    expect(regions).toHaveLength(2);
    expect(regions[0].getAttribute('tabindex')).toBe('0');
    expect(regions[1].getAttribute('tabindex')).toBe('-1');
  });

  it('moves focus to the next region with an arrow on either axis', () => {
    createMapChart({ container, data: multiRegionMapData, config: defaultConfig });
    const regions = container.querySelectorAll<SVGElement>('.jsc-map-region');
    regions[0].focus();
    expect(document.activeElement).toBe(regions[0]);

    regions[0].dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    }));

    expect(document.activeElement).toBe(regions[1]);
    expect(regions[1].getAttribute('tabindex')).toBe('0');
    expect(regions[0].getAttribute('tabindex')).toBe('-1');
  });

  it('shows the tooltip when a region receives keyboard focus, and hides it on blur', () => {
    createMapChart({ container, data: mapData, config: defaultConfig });
    const region = container.querySelector<SVGElement>('.jsc-map-region')!;

    region.focus();
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.querySelector('strong')?.textContent).toBe('10 persons');
    expect(tooltip?.textContent).toBe('Region: Region A10 persons');

    region.blur();
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe('true');
  });
});
