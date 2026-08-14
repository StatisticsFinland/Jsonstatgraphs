import { createChart } from '../src/index';
import { JsonStatDataset, GeoJsonFeatureCollection } from '../src/types';
import * as rebuildDatasetModule from '../src/data/rebuild-dataset';
import * as sortingModule from '../src/data/sorting';

beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (window as any).matchMedia = jest.fn().mockReturnValue({ matches: false });
  if (typeof requestAnimationFrame === 'undefined') {
    (globalThis as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
    (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  }
});

// --- Test datasets ---

const validDataset: JsonStatDataset = {
  id: ['year'],
  size: [3],
  dimension: {
    year: {
      label: 'Year',
      category: {
        index: ['2020', '2021', '2022'],
        label: { '2020': '2020', '2021': '2021', '2022': '2022' },
      },
    },
  },
  value: [100, 200, 300],
};

const validDataset2: JsonStatDataset = {
  id: ['year'],
  size: [3],
  dimension: {
    year: {
      label: 'Year',
      category: {
        index: ['2023', '2024', '2025'],
        label: { '2023': '2023', '2024': '2024', '2025': '2025' },
      },
    },
  },
  value: [400, 500, 600],
};

const multiDimDataset: JsonStatDataset = {
  id: ['region', 'year'],
  size: [2, 3],
  dimension: {
    region: {
      label: 'Region',
      category: {
        index: ['hel', 'tre'],
        label: { hel: 'Helsinki', tre: 'Tampere' },
      },
    },
    year: {
      label: 'Year',
      category: {
        index: ['2020', '2021', '2022'],
        label: { '2020': '2020', '2021': '2021', '2022': '2022' },
      },
    },
  },
  value: [100, 200, 300, 80, 150, 220],
  role: { time: ['year'] },
};

const selectableScatterDataset: JsonStatDataset = {
  id: ['metric', 'region'],
  size: [2, 3],
  dimension: {
    metric: { label: 'Metric', category: { index: ['x', 'y'], label: { x: 'X', y: 'Y' } } },
    region: { label: 'Region', category: { index: ['hel', 'tre', 'tur'], label: { hel: 'Helsinki', tre: 'Tampere', tur: 'Turku' } } },
  },
  value: [1, 2, 3, 10, 20, 30],
  role: { metric: ['metric'] },
};

const selectablePyramidDataset: JsonStatDataset = {
  id: ['age', 'sex'],
  size: [3, 2],
  dimension: {
    age: { label: 'Age', category: { index: ['young', 'adult', 'senior'], label: { young: 'Young', adult: 'Adult', senior: 'Senior' } } },
    sex: { label: 'Sex', category: { index: ['female', 'male'], label: { female: 'Female', male: 'Male' } } },
  },
  value: [10, 20, 30, 11, 21, 31],
};

const selectableYearBarDataset: JsonStatDataset = {
  id: ['year', 'age', 'metric'],
  size: [2, 3, 1],
  dimension: {
    year: { label: 'Year', category: { index: ['2022', '2023'], label: { '2022': '2022', '2023': '2023' } } },
    age: { label: 'Age', category: { index: ['18-24', '25-34', '35-44'], label: { '18-24': '18 - 24', '25-34': '25 - 34', '35-44': '35 - 44' } } },
    metric: { label: 'Metric', category: { index: ['participants'], label: { participants: 'Participants' }, unit: { participants: { label: '%', decimals: 0 } } } },
  },
  value: [44, 48, 53, 46, 50, 55],
  role: { time: ['year'], metric: ['metric'] },
};

const selectableTitleDataset: JsonStatDataset = {
  id: ['metric', 'gender'],
  size: [1, 3],
  dimension: {
    metric: { label: 'Metric', category: { index: ['population'], label: { population: 'Population' } } },
    gender: { label: 'Gender', category: { index: ['male', 'female', 'total'], label: { male: 'Male', female: 'Female', total: 'Total' } } },
  },
  value: [10, 20, 30],
  role: { metric: ['metric'] },
};

const selectableYearPyramidDataset: JsonStatDataset = {
  id: ['year', 'sex', 'county', 'age', 'metric'],
  size: [2, 2, 1, 3, 1],
  dimension: {
    year: { label: 'Year', category: { index: ['2022', '2023'], label: { '2022': '2022', '2023': '2023' } } },
    sex: { label: 'Sex', category: { index: ['male', 'female'], label: { male: 'Male', female: 'Female' } } },
    county: { label: 'County', category: { index: ['total'], label: { total: 'Total' } } },
    age: { label: 'Age', category: { index: ['20-24', '25-29', '30-34'], label: { '20-24': '20 - 24', '25-29': '25 - 29', '30-34': '30 - 34' } } },
    metric: { label: 'Metric', category: { index: ['count'], label: { count: 'Count' }, unit: { count: { label: 'number', decimals: 0 } } } },
  },
  value: Array.from({ length: 12 }, (_, index) => index + 1),
  role: { time: ['year'], metric: ['metric'] },
};

const selectableKeyFigureDataset: JsonStatDataset = {
  id: ['year', 'metric'],
  size: [2, 1],
  dimension: {
    year: { label: 'Year', category: { index: ['2023', '2024'], label: { '2023': '2023', '2024': '2024' } } },
    metric: { label: 'Metric', category: { index: ['value'], label: { value: 'Value' } } },
  },
  value: [10, 20],
  role: { time: ['year'], metric: ['metric'] },
};

const geoDataset: JsonStatDataset = {
  id: ['Vuosi', 'Region'],
  size: [1, 3],
  dimension: {
    Vuosi: {
      label: 'Vuosi',
      category: {
        index: ['2023'],
        label: { '2023': '2023' },
      },
    },
    Region: {
      label: 'Region',
      category: {
        index: ['MK01', 'MK02', 'MK03'],
        label: { MK01: 'Uusimaa', MK02: 'Varsinais-Suomi', MK03: 'Satakunta' },
      },
    },
  },
  value: [100, 200, 300],
  role: { geo: ['Region'], time: ['Vuosi'] },
};

const mockGeoJson: GeoJsonFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] }, properties: { natcode: '01' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[1,0],[2,0],[2,1],[1,1],[1,0]]] }, properties: { natcode: '02' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[2,0],[3,0],[3,1],[2,1],[2,0]]] }, properties: { natcode: '03' } },
  ],
};

// --- Container setup ---

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  container.remove();
  jest.restoreAllMocks();
});

// --- Tests ---

describe('createChart', () => {
  it('creates chart in container with valid dataset (table)', () => {
    createChart(container, validDataset, { chartType: 'table' });
    expect(container.children.length).toBeGreaterThan(0);
    const table = container.querySelector('table.jsc-table');
    expect(table).not.toBeNull();
  });

  it('keeps age categories when a pyramid time dimension is selected', () => {
    createChart(
      container,
      selectableYearPyramidDataset,
      { chartType: 'pyramid', showBurgerMenu: false },
      { year: ['2023'] },
    );

    expect(container.querySelectorAll('.jsc-bar-left')).toHaveLength(3);
    expect(container.querySelectorAll('.jsc-bar-right')).toHaveLength(3);
  });

  it('keeps age categories when a vertical bar time dimension is selected', () => {
    createChart(
      container,
      selectableYearBarDataset,
      { chartType: 'verticalBar', showBurgerMenu: false },
      { year: ['2023'] },
    );

    expect(container.querySelectorAll('.jsc-bar')).toHaveLength(3);
  });

  it('includes the selected category of a selectable dimension in the automatic title', () => {
    createChart(
      container,
      selectableTitleDataset,
      { chartType: 'keyFigure', multiSelectableDimensionCode: undefined },
      { gender: ['male'] },
    );

    expect(container.querySelector('.jsc-key-figure-title')?.textContent).toBe('Population, Male');
  });

  it('treats selected categories of the multi-selectable dimension as a variable in the automatic title', () => {
    createChart(
      container,
      selectableTitleDataset,
      { chartType: 'keyFigure', multiSelectableDimensionCode: 'gender' },
      { gender: ['male', 'female'] },
    );

    expect(container.querySelector('.jsc-key-figure-title')?.textContent).toBe('Population by Gender');
  });

  it('includes the burger menu by default', () => {
    createChart(container, validDataset, { chartType: 'table' });
    expect(container.querySelector('.jsc-burger-menu-button')).not.toBeNull();
  });

  it('can disable the burger menu', () => {
    createChart(container, validDataset, { chartType: 'table', showBurgerMenu: false });
    expect(container.querySelector('.jsc-burger-menu-button')).toBeNull();
    expect(container.querySelector('table.jsc-table')).not.toBeNull();
  });

  it('updates burger menu visibility with chart configuration', () => {
    const instance = createChart(container, validDataset, { chartType: 'table', showBurgerMenu: false });
    expect(container.querySelector('.jsc-burger-menu-button')).toBeNull();

    instance.update(validDataset, { chartType: 'table', showBurgerMenu: true });
    expect(container.querySelector('.jsc-burger-menu-button')).not.toBeNull();

    instance.update(validDataset, { chartType: 'table', showBurgerMenu: false });
    expect(container.querySelector('.jsc-burger-menu-button')).toBeNull();
  });

  it('renders error message for invalid dataset', () => {
    createChart(container, {} as any);
    const errDiv = container.querySelector('.jsc-error');
    expect(errDiv).not.toBeNull();
    expect(errDiv!.getAttribute('role')).toBe('alert');
    expect(errDiv!.textContent).toBeTruthy();
  });

  it('throws TypeError when container is not an HTMLElement', () => {
    expect(() => createChart(null as any, validDataset)).toThrow(TypeError);
    expect(() => createChart(null as any, validDataset)).toThrow(
      '[JsonStatChart] container must be an HTMLElement',
    );
  });

  it('throws TypeError for non-element values', () => {
    expect(() => createChart('div' as any, validDataset)).toThrow(TypeError);
    expect(() => createChart(42 as any, validDataset)).toThrow(TypeError);
  });
});

describe('colorFocusRing CSS custom property', () => {
  it('sets --jsc-color-focus-ring on the container when explicitly provided in JS config', () => {
    createChart(container, validDataset, { chartType: 'table', theme: { colorFocusRing: '#ff0000' } });
    expect(container.style.getPropertyValue('--jsc-color-focus-ring')).toBe('#ff0000');
  });

  it('does not set --jsc-color-focus-ring inline when colorFocusRing is not configured', () => {
    createChart(container, validDataset, { chartType: 'table' });
    expect(container.style.getPropertyValue('--jsc-color-focus-ring')).toBe('');
  });

  it('clears --jsc-color-focus-ring inline when JS override is removed via update()', () => {
    const instance = createChart(container, validDataset, { chartType: 'table', theme: { colorFocusRing: '#ff0000' } });
    expect(container.style.getPropertyValue('--jsc-color-focus-ring')).toBe('#ff0000');
    instance.update(validDataset, { chartType: 'table', theme: {} });
    expect(container.style.getPropertyValue('--jsc-color-focus-ring')).toBe('');
  });
});

describe('getChartType', () => {
  it('returns the explicitly set chart type', () => {
    const instance = createChart(container, validDataset, { chartType: 'table' });
    expect(instance.getChartType()).toBe('table');
  });

  it('returns chart type after auto-selection', () => {
    // validDataset with single 'Other' dimension → auto-selects 'table'
    const instance = createChart(container, validDataset);
    const type = instance.getChartType();
    expect(typeof type).toBe('string');
    expect(type.length).toBeGreaterThan(0);
  });
});

describe('getApplicableChartTypes', () => {
  it('returns an array of ChartTypeResult objects', () => {
    const instance = createChart(container, validDataset, { chartType: 'table' });
    const results = instance.getApplicableChartTypes();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('type');
    expect(results[0]).toHaveProperty('valid');
    expect(results[0]).toHaveProperty('rejectionReasons');
  });

  it('returns empty array after destroy', () => {
    const instance = createChart(container, validDataset, { chartType: 'table' });
    instance.destroy();
    expect(instance.getApplicableChartTypes()).toEqual([]);
  });
});

describe('setChartType', () => {
  it('switches to table view', () => {
    const instance = createChart(container, multiDimDataset, { chartType: 'line' });
    instance.setChartType('table');
    expect(instance.getChartType()).toBe('table');
    expect(container.querySelector('table.jsc-table')).not.toBeNull();
  });

  it('does nothing after destroy', () => {
    const instance = createChart(container, validDataset, { chartType: 'table' });
    instance.destroy();
    // Should not throw
    expect(() => instance.setChartType('table')).not.toThrow();
  });
});

describe('update', () => {
  it('re-renders with new data', () => {
    const instance = createChart(container, validDataset, { chartType: 'table' });
    const firstTable = container.querySelector('table.jsc-table');
    expect(firstTable).not.toBeNull();

    instance.update(validDataset2, { chartType: 'table' });
    // Container still has a table after update
    expect(container.querySelector('table.jsc-table')).not.toBeNull();
  });

  it('re-renders with updated config', () => {
    const instance = createChart(container, multiDimDataset, { chartType: 'line' });
    instance.update(multiDimDataset, { chartType: 'table' });
    expect(instance.getChartType()).toBe('table');
  });

  it('applies selectable selections when updating without a new config', () => {
    const instance = createChart(
      container,
      multiDimDataset,
      { chartType: 'table', layout: { rows: ['region'], columns: ['year'] } },
      { region: ['hel'] },
    );
    expect(container.querySelector('tbody')?.textContent).toContain('100');
    expect(container.querySelector('tbody')?.textContent).not.toContain('80');
    expect(Array.from(container.querySelectorAll('thead th')).map(cell => cell.textContent)).not.toContain('Helsinki');
    expect(Array.from(container.querySelectorAll('thead th')).map(cell => cell.textContent)).toContain('2020');

    instance.update(multiDimDataset, undefined, { region: ['tre'] });

    expect(container.querySelector('tbody')?.textContent).toContain('80');
    expect(container.querySelector('tbody')?.textContent).not.toContain('100');
  });

  it('preserves active selections when switching chart types', () => {
    const instance = createChart(
      container,
      multiDimDataset,
      { chartType: 'table', layout: { rows: ['region'], columns: ['year'] } },
      { region: ['tre'] },
    );

    instance.setChartType('line');

    expect(container.querySelectorAll('.jsc-series').length).toBe(1);
    expect(container.textContent).toContain('220');
    expect(container.textContent).not.toContain('300');
  });

  it('rebuilds selectable data only once per render cycle', () => {
    const rebuildSpy = jest.spyOn(rebuildDatasetModule, 'rebuildDataset');

    const instance = createChart(
      container,
      multiDimDataset,
      { chartType: 'table', layout: { rows: ['region'], columns: ['year'] } },
      { region: ['hel'] },
    );
    expect(rebuildSpy).toHaveBeenCalledTimes(1);

    rebuildSpy.mockClear();
    instance.setChartType('line');
    expect(rebuildSpy).toHaveBeenCalledTimes(1);

    rebuildSpy.mockClear();
    instance.update(multiDimDataset, undefined, { region: ['tre'] });
    expect(rebuildSpy).toHaveBeenCalledTimes(1);

    rebuildSpy.mockRestore();
  });

  it('does nothing after destroy', () => {
    const instance = createChart(container, validDataset, { chartType: 'table' });
    instance.destroy();
    // Should not throw
    expect(() => instance.update(validDataset2)).not.toThrow();
  });
});

describe('destroy', () => {
  it('clears the container DOM', () => {
    const instance = createChart(container, validDataset, { chartType: 'table' });
    expect(container.children.length).toBeGreaterThan(0);
    instance.destroy();
    expect(container.innerHTML).toBe('');
  });

  it('is idempotent — second destroy does not throw', () => {
    const instance = createChart(container, validDataset, { chartType: 'table' });
    instance.destroy();
    expect(() => instance.destroy()).not.toThrow();
  });
});

describe('sorting wiring (cfg.sorting)', () => {
  it.each([
    ['horizontalBar', false],
    ['groupedHorizontalBar', false],
    ['stackedHorizontalBar', false],
    ['percentHorizontalBar', true],
    ['pie', false],
  ] as const)('threads cfg.sorting into %s with isPercent=%s', (chartType, isPercent) => {
    const spy = jest.spyOn(sortingModule, 'applySorting');
    createChart(container, validDataset, { chartType, sorting: 'sum', showBurgerMenu: false });
    expect(spy).toHaveBeenCalledWith(expect.anything(), 'sum', isPercent, chartType);
  });

  it.each(['verticalBar', 'groupedVerticalBar', 'stackedVerticalBar', 'percentVerticalBar'] as const)(
    'does not apply sorting for %s charts',
    (chartType) => {
      const spy = jest.spyOn(sortingModule, 'applySorting');
      createChart(container, validDataset, { chartType, sorting: 'sum', showBurgerMenu: false });
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it.each(['line', 'pyramid', 'table', 'keyFigure'] as const)(
    'does not apply sorting for %s charts',
    (chartType) => {
      const spy = jest.spyOn(sortingModule, 'applySorting');
      createChart(container, multiDimDataset, { chartType, sorting: 'sum', showBurgerMenu: false });
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it('does not apply sorting for scatterPlot charts', () => {
    const spy = jest.spyOn(sortingModule, 'applySorting');
    createChart(container, selectableScatterDataset, { chartType: 'scatterPlot', sorting: 'sum', showBurgerMenu: false });
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not apply sorting for map charts', async () => {
    const spy = jest.spyOn(sortingModule, 'applySorting');
    const provider = jest.fn().mockResolvedValue(mockGeoJson);
    createChart(container, geoDataset, { chartType: 'map', mapProvider: provider, sorting: 'sum', showBurgerMenu: false });
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
  });

  it('renders bars in original dataset order without sorting', () => {
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    createChart(container, validDataset, { chartType: 'verticalBar', showBurgerMenu: false });
    const heights = Array.from(container.querySelectorAll<SVGRectElement>('.jsc-bar')).map(r => parseFloat(r.getAttribute('height') ?? '0'));
    expect(heights[0]).toBeLessThan(heights[1]);
    expect(heights[1]).toBeLessThan(heights[2]);
  });
});

describe('selectable non-categorical renderers', () => {
  it('filters scatter observations', () => {
    createChart(
      container,
      selectableScatterDataset,
      { chartType: 'scatterPlot' },
      { region: ['tre'] },
    );

    expect(container.querySelectorAll('.jsc-scatter-point')).toHaveLength(1);
  });

  it('filters pyramid categories', () => {
    createChart(
      container,
      selectablePyramidDataset,
      { chartType: 'pyramid' },
      { age: ['adult'] },
    );

    expect(container.querySelectorAll('.jsc-bar')).toHaveLength(2);
  });

  it('uses the selected value for a key figure', () => {
    createChart(
      container,
      selectableKeyFigureDataset,
      { chartType: 'keyFigure' },
      { year: ['2024'] },
    );

    expect(container.querySelector('.jsc-key-figure-value')?.textContent).toBe('20');
  });

  it('uses the default value for a key figure when the current selection is empty', () => {
    createChart(
      container,
      selectableKeyFigureDataset,
      { chartType: 'keyFigure', defaultSelectableSelections: { year: ['2023'] } },
      { year: [] },
    );

    expect(container.querySelector('.jsc-key-figure-value')?.textContent).toBe('10');
  });

  it('renders an explicit error when an empty selection has no default', () => {
    createChart(container, selectableKeyFigureDataset, { chartType: 'keyFigure' }, { year: [] });

    expect(container.querySelector('.jsc-error')?.textContent).toContain('No selections were provided for dimension: "year"');
  });

  it('trusts an explicit scatter type with selections on its metric dimension', () => {
    createChart(container, selectableScatterDataset, { chartType: 'scatterPlot' }, { metric: ['x'] });

    expect(container.querySelector('.jsc-error')).toBeNull();
  });

  it('trusts an explicit pyramid type with selections on its split dimension', () => {
    createChart(container, selectablePyramidDataset, { chartType: 'pyramid' }, { sex: ['female'] });

    expect(container.querySelector('.jsc-error')).toBeNull();
  });
});

describe('error containment', () => {
  it('allows an explicit layout to omit a multi-value dimension', () => {
    createChart(container, validDataset, {
      chartType: 'line',
      layout: { rows: [], columns: [] },
    });
    expect(container.querySelector('.jsc-error')).toBeNull();
  });

  it('does not throw when renderer encounters an error', () => {
    expect(() => {
      createChart(container, validDataset, {
        chartType: 'line',
        layout: { rows: [], columns: [] },
      });
    }).not.toThrow();
  });
});

describe('auto chart type selection', () => {
  it('auto-selects a chart type when none is specified', () => {
    const instance = createChart(container, validDataset);
    const type = instance.getChartType();
    // Single dimension with size > 1 and no role → 'Other' type → not a valid axis → table
    expect(type).toBe('table');
  });

  it('auto-selects line chart for multi-dim dataset with time dimension', () => {
    const instance = createChart(container, multiDimDataset);
    // multiDimDataset has a time dimension → line chart is valid and high priority
    const type = instance.getChartType();
    expect(type).toBe('line');
  });
});

describe('height config', () => {
  it('sets container height when height is specified', () => {
    createChart(container, validDataset, { chartType: 'table', height: 400 });
    expect(container.style.height).toBe('400px');
  });
});

describe('auto header building', () => {
  const headerTestDataset: JsonStatDataset = {
    id: ['year', 'info'],
    size: [3, 1],
    dimension: {
      year: {
        label: 'Year',
        category: {
          index: ['2020', '2021', '2022'],
          label: { '2020': '2020', '2021': '2021', '2022': '2022' },
        },
      },
      info: {
        label: 'Information',
        category: {
          index: ['pop'],
          label: { pop: 'Population' },
        },
      },
    },
    value: [100, 200, 300],
    label: 'Some raw table label',
    role: { time: ['year'], metric: ['info'] },
  };

  it('uses buildHeader() auto-generated title when showHeader is true and no title given', () => {
    createChart(container, headerTestDataset, { chartType: 'table', showHeader: true });
    // The table caption should contain the auto-generated title, not dataset.label
    const caption = container.querySelector('caption');
    expect(caption?.textContent).toBe('Population 2020–2022');
  });

  it('uses dataset.label when autoTitle is false', () => {
    createChart(container, headerTestDataset, { chartType: 'table', showHeader: true, autoTitle: false });
    const caption = container.querySelector('caption');
    expect(caption?.textContent).toBe('Some raw table label');
  });

  it('explicit config.title always wins regardless of autoTitle', () => {
    createChart(container, headerTestDataset, {
      chartType: 'table',
      showHeader: true,
      title: 'My Explicit Title',
    });
    const caption = container.querySelector('caption');
    expect(caption?.textContent).toBe('My Explicit Title');
  });

  it('explicit config.title wins even when autoTitle is false', () => {
    createChart(container, headerTestDataset, {
      chartType: 'table',
      showHeader: true,
      title: 'My Explicit Title',
      autoTitle: false,
    });
    const caption = container.querySelector('caption');
    expect(caption?.textContent).toBe('My Explicit Title');
  });

  it('respects explicit empty string title (does not auto-generate)', () => {
    createChart(container, headerTestDataset, { chartType: 'table', showHeader: true, title: '' });
    const caption = container.querySelector('caption');
    expect(caption?.textContent).toBe('');
  });

  it('uses navigator.language for auto-title when no locale is specified', () => {
    // Dataset with a multi-value non-Time dimension triggers locale-dependent connector words
    const localeTestDataset: JsonStatDataset = {
      id: ['year', 'region', 'info'],
      size: [3, 2, 1],
      dimension: {
        year: {
          label: 'Year',
          category: {
            index: ['2020', '2021', '2022'],
            label: { '2020': '2020', '2021': '2021', '2022': '2022' },
          },
        },
        region: {
          label: 'Region',
          category: {
            index: ['north', 'south'],
            label: { north: 'North', south: 'South' },
          },
        },
        info: {
          label: 'Information',
          category: {
            index: ['pop'],
            label: { pop: 'Population' },
          },
        },
      },
      value: [100, 200, 300, 400, 500, 600],
      label: 'Some raw table label',
      role: { time: ['year'], metric: ['info'] },
    };
    const originalLanguage = Object.getOwnPropertyDescriptor(navigator, 'language');
    Object.defineProperty(navigator, 'language', { value: 'fi', configurable: true });
    try {
      createChart(container, localeTestDataset, { chartType: 'table', showHeader: true });
      const caption = container.querySelector('caption');
      // Finnish connector word 'muuttujana' should appear (vs English 'by')
      expect(caption?.textContent).toContain('muuttujana');
    } finally {
      if (originalLanguage) {
        Object.defineProperty(navigator, 'language', originalLanguage);
      } else {
        Object.defineProperty(navigator, 'language', { value: 'en', configurable: true });
      }
    }
  });

  it('generates title for dataset without Content dimension role', () => {
    const noMetricDataset: JsonStatDataset = {
      id: ['category'],
      size: [3],
      dimension: {
        category: {
          label: 'Category',
          category: {
            index: ['a', 'b', 'c'],
            label: { a: 'Alpha', b: 'Beta', c: 'Gamma' },
          },
        },
      },
      value: [10, 20, 30],
      label: 'Simple dataset',
      // No role metadata at all
    };
    createChart(container, noMetricDataset, { chartType: 'table', showHeader: true });
    const caption = container.querySelector('caption');
    // Should produce some title (from header builder) or fall back to dataset.label
    expect(caption?.textContent).toBeTruthy();
  });

  it('renders .jsc-title with auto-generated title when showHeader is not set in config', () => {
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    createChart(container, headerTestDataset, { chartType: 'line' });
    const titleEl = container.querySelector('.jsc-title');
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toBe('Population 2020–2022');
  });

  it('auto-title works with minimal config', () => {
    createChart(container, headerTestDataset, {
      chartType: 'table',
      showHeader: true,
    });
    const caption = container.querySelector('caption');
    expect(caption?.textContent).toBe('Population 2020–2022');
  });
});

describe('setChartType persistence and override', () => {
  it('persists chart type through update() when no new config is provided', () => {
    const instance = createChart(container, validDataset, { chartType: 'table' });
    instance.setChartType('table');
    instance.update(validDataset2);
    expect(instance.getChartType()).toBe('table');
    expect(container.querySelector('table.jsc-table')).not.toBeNull();
  });

  it('destroys previous renderer and shows error on invalid dataset update', () => {
    const instance = createChart(container, validDataset, { chartType: 'table' });
    expect(container.querySelector('table.jsc-table')).not.toBeNull();
    instance.update({} as any);
    expect(container.querySelector('table.jsc-table')).toBeNull();
    expect(container.querySelector('.jsc-error')).not.toBeNull();
  });

  it('update() with config.chartType overrides previous setChartType()', () => {
    const instance = createChart(container, multiDimDataset, { chartType: 'table' });
    instance.setChartType('line');
    expect(instance.getChartType()).toBe('line');
    instance.update(multiDimDataset, { chartType: 'table' });
    expect(instance.getChartType()).toBe('table');
    expect(container.querySelector('table.jsc-table')).not.toBeNull();
  });
});

describe('auto source footer', () => {
  const datasetWithSource: JsonStatDataset = {
    ...multiDimDataset,
    source: 'Statistics Finland',
  };

  it('auto-populates footer source item from dataset.source', () => {
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    createChart(container, datasetWithSource, { chartType: 'line' });
    const footerTexts = container.querySelectorAll('.jsc-footer-text');
    const texts = Array.from(footerTexts).map(el => el.textContent);
    expect(texts).toContain('Source: Statistics Finland');
  });

  it('does not duplicate source when footerItems already has type=source', () => {
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    createChart(container, datasetWithSource, {
      chartType: 'line',
      footerItems: [{ type: 'source', label: 'Source:', value: 'Statistics Finland' }],
    });
    const footerTexts = container.querySelectorAll('.jsc-footer-text');
    const sourceTexts = Array.from(footerTexts).filter(el => el.textContent === 'Source: Statistics Finland');
    expect(sourceTexts).toHaveLength(1);
  });

  it('auto-populates footer updated item from dataset.updated', () => {
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    const datasetWithUpdated: JsonStatDataset = {
      ...datasetWithSource,
      updated: '2024-03-15',
    };
    createChart(container, datasetWithUpdated, { chartType: 'line' });
    const footerTexts = container.querySelectorAll('.jsc-footer-text');
    const texts = Array.from(footerTexts).map(el => el.textContent);
    expect(texts.some(t => t?.startsWith('Updated:'))).toBe(true);
  });

  it('does not duplicate updated when footerItems already has type=updated', () => {
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    const datasetWithUpdated: JsonStatDataset = {
      ...datasetWithSource,
      updated: '2024-03-15',
    };
    createChart(container, datasetWithUpdated, {
      chartType: 'line',
      footerItems: [{ type: 'updated', label: 'Updated:', value: '2024-03-15' }],
    });
    const footerTexts = container.querySelectorAll('.jsc-footer-text');
    const updatedTexts = Array.from(footerTexts).filter(el => el.textContent?.startsWith('Updated:'));
    expect(updatedTexts).toHaveLength(1);
  });

  it('renders invalid updated date as raw string fallback', () => {
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    const datasetWithBadDate: JsonStatDataset = {
      ...datasetWithSource,
      updated: 'not-a-date',
    };
    expect(() => createChart(container, datasetWithBadDate, { chartType: 'line' })).not.toThrow();
    const footerTexts = container.querySelectorAll('.jsc-footer-text');
    const texts = Array.from(footerTexts).map(el => el.textContent);
    expect(texts.some(t => t?.includes('not-a-date'))).toBe(true);
  });

  it('auto-adds source even when a custom-typed item has source prefix (dedup only by type)', () => {
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    createChart(container, datasetWithSource, {
      chartType: 'line',
      footerItems: [{ type: 'custom', label: 'Source:', value: 'Statistics Finland' }],
    });
    const footerTexts = container.querySelectorAll('.jsc-footer-text');
    const sourceTexts = Array.from(footerTexts).filter(el => el.textContent?.startsWith('Source:'));
    // custom-typed item does not suppress auto-population; dedup is type-based only
    expect(sourceTexts.length).toBeGreaterThanOrEqual(2);
  });
});

describe('sourceLink integration', () => {
  const datasetWithSource: JsonStatDataset = {
    ...multiDimDataset,
    source: 'Statistics Finland',
  };

  it('renders source as link when sourceLink is provided', () => {
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    createChart(container, datasetWithSource, {
      chartType: 'line',
      sourceLink: 'https://stat.fi',
    });
    const footer = container.querySelector('.jsc-footer');
    const anchor = footer?.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('https://stat.fi');
    const valueTspan = anchor?.querySelector('.jsc-footer-value');
    expect(valueTspan).not.toBeNull();
    expect(valueTspan?.textContent).toContain('Statistics Finland');
  });
});

describe('axis titles after update', () => {
  const datasetWithUnits: JsonStatDataset = {
    id: ['ContVar', 'Year'],
    size: [1, 3],
    dimension: {
      ContVar: {
        label: 'Measure',
        category: {
          index: ['POP'],
          label: { POP: 'Population' },
          unit: { POP: { label: 'thousands', decimals: 0 } },
        },
      },
      Year: {
        label: 'Reference year',
        category: {
          index: ['2020', '2021', '2022'],
          label: { '2020': '2020', '2021': '2021', '2022': '2022' },
        },
      },
    },
    value: [100, 200, 300],
    role: { metric: ['ContVar'], time: ['Year'] },
  };

  it('axis title survives an update() call on a bar chart', () => {
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });

    const instance = createChart(container, datasetWithUnits, { chartType: 'verticalBar' });

    // Axis title should be present after initial render
    expect(container.querySelector('.jsc-axis-title-y')).not.toBeNull();

    // Update with new values (same structure)
    instance.update({ ...datasetWithUnits, value: [150, 250, 350] }, { chartType: 'verticalBar' });

    // Axis title should still be present after update
    expect(container.querySelector('.jsc-axis-title-y')).not.toBeNull();
  });
});

describe('unit footer visibility', () => {
  const datasetWithUnit: JsonStatDataset = {
    id: ['ContVar', 'Year'],
    size: [1, 3],
    dimension: {
      ContVar: {
        label: 'Measure',
        category: {
          index: ['POP'],
          label: { POP: 'Population' },
          unit: { POP: { label: 'persons', decimals: 0 } },
        },
      },
      Year: {
        label: 'Year',
        category: {
          index: ['2020', '2021', '2022'],
          label: { '2020': '2020', '2021': '2021', '2022': '2022' },
        },
      },
    },
    value: [100, 200, 300],
    role: { metric: ['ContVar'], time: ['Year'] },
  };

  it('does not add the unit to the footer by default', () => {
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    createChart(container, datasetWithUnit, { chartType: 'line' });

    expect(container.querySelector('.jsc-footer-unit')).toBeNull();
    expect(container.querySelector('.jsc-axis-title-y')).not.toBeNull();
  });

  it('adds the unit to the footer when showUnit is enabled', () => {
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    createChart(container, datasetWithUnit, { chartType: 'line', showUnit: true });

    const footerTexts = Array.from(container.querySelectorAll('.jsc-footer-text'))
      .map(element => element.textContent);
    expect(footerTexts).toContain('Unit: persons');
  });
});

// --- Key figure datasets ---

const keyFigureDataset: JsonStatDataset = {
  version: '2.0',
  class: 'dataset',
  id: ['year', 'content'],
  size: [1, 1],
  dimension: {
    year: {
      label: 'Year',
      category: {
        index: ['2024'],
        label: { '2024': '2024' },
      },
    },
    content: {
      label: 'Information',
      category: {
        index: ['pop'],
        label: { pop: 'Population' },
        unit: { pop: { label: 'persons', decimals: 0 } },
      },
    },
  },
  role: { time: ['year'], metric: ['content'] },
  value: [5000],
  source: 'Test Institute',
  updated: '2024-06-15T00:00:00',
};

const multiCellDataset: JsonStatDataset = {
  version: '2.0',
  class: 'dataset',
  id: ['year', 'content'],
  size: [3, 1],
  dimension: {
    year: {
      label: 'Year',
      category: {
        index: ['2022', '2023', '2024'],
        label: { '2022': '2022', '2023': '2023', '2024': '2024' },
      },
    },
    content: {
      label: 'Information',
      category: {
        index: ['pop'],
        label: { pop: 'Population' },
      },
    },
  },
  role: { time: ['year'], metric: ['content'] },
  value: [4900, 4950, 5000],
};

describe('keyFigure chart type', () => {
  it('auto-selects keyFigure for single-cell dataset', () => {
    const instance = createChart(container, keyFigureDataset);
    expect(instance.getChartType()).toBe('keyFigure');
    expect(container.querySelector('.jsc-key-figure')).not.toBeNull();
  });

  it('honors an explicit keyFigure for a multi-cell dataset', () => {
    const instance = createChart(container, multiCellDataset, { chartType: 'keyFigure' });
    expect(container.querySelector('.jsc-key-figure')).not.toBeNull();
    expect(instance.getChartType()).toBe('keyFigure');
  });

  it('getChartType() returns keyFigure when forced on multi-cell data', () => {
    const instance = createChart(container, multiCellDataset, { chartType: 'keyFigure' });
    expect(instance.getChartType()).toBe('keyFigure');
  });

  it('setChartType(keyFigure) honors the runtime override on multi-cell data', () => {
    const instance = createChart(container, multiCellDataset, { chartType: 'table' });
    instance.setChartType('keyFigure');
    expect(instance.getChartType()).toBe('keyFigure');
    expect(container.querySelector('.jsc-key-figure')).not.toBeNull();
  });

  it('rejects a zero-dimension dataset before explicit chart resolution', () => {
    const zeroDimDataset: JsonStatDataset = {
      version: '2.0',
      class: 'dataset',
      id: [],
      size: [],
      value: [],
      dimension: {},
    };
    const instance = createChart(container, zeroDimDataset, { chartType: 'keyFigure' });
    expect(instance.getChartType()).toBe('table');
    expect(container.querySelector('.jsc-error')).not.toBeNull();
  });

  it('keyFigure renders title and footer from metadata', () => {
    createChart(container, keyFigureDataset);
    const titleEl = container.querySelector('.jsc-key-figure-title');
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toBeTruthy();
    const sourceEl = container.querySelector('.jsc-key-figure-source');
    expect(sourceEl).not.toBeNull();
    expect(sourceEl!.textContent).toContain('Test Institute');
    const updatedEl = container.querySelector('.jsc-key-figure-updated');
    expect(updatedEl).not.toBeNull();
    expect(updatedEl!.textContent).toBeTruthy();
  });
});

describe('mapProvider', () => {
  function createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  test('calls mapProvider with correct dimensionId and geoCodes', async () => {
    const provider = jest.fn().mockResolvedValue(null);
    createChart(container, geoDataset, { chartType: 'map', mapProvider: provider });
    await Promise.resolve();
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledWith('Region', ['MK01', 'MK02', 'MK03'], expect.any(AbortSignal), '2023');
  });

  test('calls mapProvider with selected geo codes', async () => {
    const provider = jest.fn().mockResolvedValue(null);
    createChart(
      container,
      geoDataset,
      { chartType: 'map', mapProvider: provider },
      { Region: ['MK02'] },
    );
    await Promise.resolve();
    expect(provider).toHaveBeenCalledWith('Region', ['MK02'], expect.any(AbortSignal), '2023');
  });

  test('uses the default time selection when the current selection is empty', async () => {
    const datasetWithMultipleYears: JsonStatDataset = {
      ...geoDataset,
      size: [2, 3],
      dimension: {
        ...geoDataset.dimension,
        Vuosi: {
          ...geoDataset.dimension.Vuosi,
          category: { index: ['2023', '2024'], label: { '2023': '2023', '2024': '2024' } },
        },
      },
      value: [100, 200, 300, 400, 500, 600],
    };
    const provider = jest.fn().mockResolvedValue(null);
    createChart(
      container,
      datasetWithMultipleYears,
      { chartType: 'map', mapProvider: provider, defaultSelectableSelections: { Vuosi: ['2023'] } },
      { Vuosi: [] },
    );

    await Promise.resolve();
    expect(provider).toHaveBeenCalledWith('Region', ['MK01', 'MK02', 'MK03'], expect.any(AbortSignal), '2023');
  });

  test('renders map when provider returns geometry', async () => {
    const provider = jest.fn().mockResolvedValue(mockGeoJson);
    createChart(container, geoDataset, {
      chartType: 'map' as const,
      mapProvider: provider,
      map: { geoIdProperty: 'natcode', geoCodeMapper: (c: string) => c.replace(/^MK/, '') },
    });
    await Promise.resolve();
    await Promise.resolve();
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  test('renders non-map chart when provider returns null', async () => {
    const provider = jest.fn().mockResolvedValue(null);
    createChart(container, geoDataset, { mapProvider: provider });
    await Promise.resolve();
    await Promise.resolve();
    const svg = container.querySelector('svg, table');
    expect(svg).not.toBeNull();
  });

  test('renders non-map chart when provider throws', async () => {
    const provider = jest.fn().mockRejectedValue(new Error('Network error'));
    createChart(container, geoDataset, { chartType: 'map', mapProvider: provider });
    await Promise.resolve();
    await Promise.resolve();
    const svg = container.querySelector('svg, table');
    expect(svg).not.toBeNull();
    expect(jest.mocked(console.warn)).toHaveBeenCalled();
  });

  test('does not call mapProvider when dataset has no geo dimension', async () => {
    const provider = jest.fn().mockResolvedValue(mockGeoJson);
    createChart(container, validDataset, { mapProvider: provider });
    await Promise.resolve();
    expect(provider).not.toHaveBeenCalled();
  });

  test('does not call mapProvider when explicit non-map chartType is set', async () => {
    const provider = jest.fn().mockResolvedValue(mockGeoJson);
    createChart(container, geoDataset, { mapProvider: provider, chartType: 'table' });
    await Promise.resolve();
    expect(provider).not.toHaveBeenCalled();
  });

  test('mapProvider is not called when auto-selection picks a higher-priority chart type', async () => {
    // geoDataset: Time(1) + Geo(3) — horizontalBar is valid and has higher priority than map
    // so the chart selector returns 'horizontalBar' even with mapAvailable:true, and
    // needsMapResolution stays false → provider must never be invoked
    const provider = jest.fn().mockResolvedValue(mockGeoJson);
    const chart = createChart(container, geoDataset, { mapProvider: provider });
    await Promise.resolve();
    expect(provider).not.toHaveBeenCalled();
    chart.destroy();
  });

  test('falls back when explicit chartType is map but provider returns null', async () => {
    const provider = jest.fn().mockResolvedValue(null);
    createChart(container, geoDataset, { mapProvider: provider, chartType: 'map' });
    await Promise.resolve();
    await Promise.resolve();
    const content = container.querySelector('svg, table, .jsc-error');
    expect(content).not.toBeNull();
  });

  test('destroy() cancels pending provider resolution', async () => {
    const deferred = createDeferred<typeof mockGeoJson | null>();
    const provider = jest.fn().mockReturnValue(deferred.promise);
    const instance = createChart(container, geoDataset, { mapProvider: provider });
    instance.destroy();
    deferred.resolve(mockGeoJson);
    await Promise.resolve();
    await Promise.resolve();
    expect(container.innerHTML).toBe('');
  });

  test('update() cancels pending provider and starts new resolution', async () => {
    const deferred1 = createDeferred<typeof mockGeoJson | null>();
    const deferred2 = createDeferred<typeof mockGeoJson | null>();
    let callCount = 0;
    const provider = jest.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? deferred1.promise : deferred2.promise;
    });

    const instance = createChart(container, geoDataset, { chartType: 'map', mapProvider: provider });
    instance.update(geoDataset, { chartType: 'map', mapProvider: provider });

    expect(provider).toHaveBeenCalledTimes(2);

    deferred1.resolve(mockGeoJson);
    await Promise.resolve();
    await Promise.resolve();

    deferred2.resolve(null);
    await Promise.resolve();
    await Promise.resolve();

    const content = container.querySelector('svg, table');
    expect(content).not.toBeNull();
  });

  test('passes AbortSignal to mapProvider', async () => {
    const provider = jest.fn().mockResolvedValue(null);
    createChart(container, geoDataset, { chartType: 'map', mapProvider: provider });
    await Promise.resolve();
    const signal = provider.mock.calls[0][2];
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  test('aborts signal on destroy', async () => {
    const deferred = createDeferred<typeof mockGeoJson | null>();
    const provider = jest.fn().mockReturnValue(deferred.promise);
    const instance = createChart(container, geoDataset, { chartType: 'map', mapProvider: provider });
    const signal: AbortSignal = provider.mock.calls[0][2];
    expect(signal.aborted).toBe(false);
    instance.destroy();
    expect(signal.aborted).toBe(true);
  });

  test('getApplicableChartTypes includes map after provider resolves with geometry', async () => {
    const provider = jest.fn().mockResolvedValue(mockGeoJson);
    const instance = createChart(container, geoDataset, {
      chartType: 'map' as const,
      mapProvider: provider,
      map: { geoIdProperty: 'natcode', geoCodeMapper: (c: string) => c.replace(/^MK/, '') },
    });
    await Promise.resolve();
    await Promise.resolve();
    const types = instance.getApplicableChartTypes();
    const mapResult = types.find(t => t.type === 'map');
    expect(mapResult?.valid).toBe(true);
  });

  test('getApplicableChartTypes drops map during pending provider resolution', async () => {
    // First render with successful provider
    const provider1 = jest.fn().mockResolvedValue(mockGeoJson);
    const instance = createChart(container, geoDataset, {
      chartType: 'map' as const,
      mapProvider: provider1,
      map: { geoIdProperty: 'natcode', geoCodeMapper: (c: string) => c.replace(/^MK/, '') },
    });
    await Promise.resolve();
    await Promise.resolve();

    // Map should be valid after resolution
    let types = instance.getApplicableChartTypes();
    expect(types.find(t => t.type === 'map')?.valid).toBe(true);

    // Now update with a slow provider (pending)
    const deferred = createDeferred<typeof mockGeoJson | null>();
    const provider2 = jest.fn().mockReturnValue(deferred.promise);
    instance.update(geoDataset, {
      chartType: 'map' as const,
      mapProvider: provider2,
      map: { geoIdProperty: 'natcode', geoCodeMapper: (c: string) => c.replace(/^MK/, '') },
    });

    // During pending state, map should NOT be reported as valid
    types = instance.getApplicableChartTypes();
    expect(types.find(t => t.type === 'map')?.valid).toBe(false);

    // Resolve to clean up
    deferred.resolve(null);
    await Promise.resolve();
    await Promise.resolve();
  });
});
