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
