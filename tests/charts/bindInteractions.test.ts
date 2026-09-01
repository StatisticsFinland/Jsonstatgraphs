import { bindInteractions, DataElementInfo } from '../../src/charts/bindInteractions';
import { resolveTheme } from '../../src/theme/theme';
import { ChartData } from '../../src/types';

function makeElement(): SVGCircleElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  el.setAttribute('tabindex', '0');
  return el;
}

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: 400, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 300, configurable: true });
  document.body.appendChild(container);
});
afterEach(() => {
  container.remove();
});

describe('buildTooltipData via bindInteractions focus event', () => {
  it('shows seriesLabel dimension line even when xLabel is absent', () => {
    const el = makeElement();
    container.appendChild(el);

    const chartData: ChartData = {
      // xLabel is deliberately omitted
      seriesLabel: 'Region',
      series: [
        { name: 'North', code: 'north', points: [{ value: 10, label: '2024', categoryCode: '2024' }] },
        { name: 'South', code: 'south', points: [{ value: 20, label: '2024', categoryCode: '2024' }] },
      ],
      categories: ['2024'],
      categoryLabels: ['2024'],
    };

    const elements: DataElementInfo[] = [
      {
        element: el,
        seriesIndex: 0,
        pointIndex: 0,
        category: '2024',
        seriesName: 'North',
        value: 10,
        formattedValue: '10',
      },
    ];

    const theme = resolveTheme(container);
    const interactions = bindInteractions({ container, elements, theme, chartData });

    // Dispatch focus to trigger tooltip.show()
    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

    const tooltip = container.querySelector('.jsc-tooltip');
    expect(tooltip).not.toBeNull();

    // Without the fix, the series dimension label would not appear
    // because the outer `if (chartData?.xLabel !== undefined)` gate blocked it.
    // With the fix, "Region: North" should appear as a div.
    expect(tooltip!.textContent).toContain('Region');
    expect(tooltip!.textContent).toContain('North');

    interactions.destroy();
  });

  it('shows xLabel dimension line when present (single series)', () => {
    const el = makeElement();
    container.appendChild(el);

    const chartData: ChartData = {
      xLabel: 'Year',
      series: [{ name: 'Total', code: 's1', points: [{ value: 5, label: '2023', categoryCode: '2023' }, { value: 6, label: '2024', categoryCode: '2024' }] }],
      categories: ['2023', '2024'],
      categoryLabels: ['2023', '2024'],
    };

    const elements: DataElementInfo[] = [
      {
        element: el,
        seriesIndex: 0,
        pointIndex: 0,
        category: '2024',
        seriesName: 'Total',
        value: 5,
        formattedValue: '5',
      },
    ];

    const theme = resolveTheme(container);
    const interactions = bindInteractions({ container, elements, theme, chartData });

    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

    const tooltip = container.querySelector('.jsc-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toContain('Year');
    expect(tooltip!.textContent).toContain('2024');

    interactions.destroy();
  });

  it('shows both xLabel and seriesLabel when both are present and qualify', () => {
    const el = makeElement();
    container.appendChild(el);

    const chartData: ChartData = {
      xLabel: 'Year',
      seriesLabel: 'Region',
      series: [
        { name: 'North', code: 'north', points: [{ value: 10, label: '2024', categoryCode: '2024' }] },
        { name: 'South', code: 'south', points: [{ value: 20, label: '2024', categoryCode: '2024' }] },
      ],
      categories: ['2023', '2024'],
      categoryLabels: ['2023', '2024'],
    };

    const elements: DataElementInfo[] = [
      {
        element: el,
        seriesIndex: 0,
        pointIndex: 0,
        category: '2024',
        seriesName: 'North',
        value: 10,
        formattedValue: '10',
      },
    ];

    const theme = resolveTheme(container);
    const interactions = bindInteractions({ container, elements, theme, chartData });

    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

    const tooltip = container.querySelector('.jsc-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toContain('Year');
    expect(tooltip!.textContent).toContain('2024');
    expect(tooltip!.textContent).toContain('Region');
    expect(tooltip!.textContent).toContain('North');

    interactions.destroy();
  });
});
