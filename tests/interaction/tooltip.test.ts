import { Tooltip, TooltipData } from '../../src/interaction/tooltip';
import { ResolvedTheme } from '../../src/types';

const mockTheme: ResolvedTheme = {
  fontFamily: 'system-ui, sans-serif',
  fontSizeTick: '0.75rem',
  fontSizeLabel: '0.875rem',
  fontSizeTitle: '1rem',
  letterSpacing: '0',
  fontWeightNormal: 400,
  fontWeightBold: 700,
  colorBackground: '#ffffff',
  colorSurface: '#ffffff',
  colorText: '#333333',
  colorTextSecondary: '#666666',
  colorBorder: '#cccccc',
  colorTick: '#767676',
  colorError: '#dc3545',
  colorFocusRing: '#0066cc',
  colorLink: '#0563C1',
  borderRadius: '4px',
  gridOpacity: 0.2,
  tooltipPadding: '8px 12px',
  tooltipBoxShadow: '0 2px 4px rgba(0,0,0,0.15)',
  burgerMenuBackground: '#ffffff',
  burgerMenuBorderColor: '#bdbdbd',
  burgerMenuBorderRadius: '18px',
  burgerMenuShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
  burgerMenuItemHoverBackground: '#f5f5f5',
  burgerMenuItemActiveBackground: '#eef5ff',
  burgerMenuItemSeparatorColor: '#e3e3e3',
  seriesColors: ['#4e79a7', '#e15759'],
  mapColors: ['#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'],
};

function createContainer(width = 600, height = 400): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  Object.defineProperty(container, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(container, 'offsetHeight', { value: height, configurable: true });
  return container;
}

const sampleData: TooltipData = {
  category: 'Finland',
  series: 'Population',
  value: 5000000,
  formattedValue: '5,000,000',
};

describe('Tooltip', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container.remove();
  });

  it('creates tooltip element in container', () => {
    container = createContainer();
    new Tooltip(container, mockTheme);
    expect(container.querySelector('.jsc-tooltip')).not.toBeNull();
  });

  it('tooltip is hidden by default', () => {
    container = createContainer();
    new Tooltip(container, mockTheme);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.style.opacity).toBe('0');
  });

  it('tooltip element has aria-hidden="true" initially', () => {
    container = createContainer();
    new Tooltip(container, mockTheme);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('show() makes tooltip visible with correct content', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    tooltip.show(sampleData, 100, 100);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.style.opacity).toBe('1');
    expect(el.style.pointerEvents).toBe('auto');
    expect(el.textContent).toContain('Population');
    expect(el.textContent).toContain('5,000,000');
  });

  it('show() uses formatted value', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    tooltip.show({ ...sampleData, formattedValue: '1,234' }, 100, 100);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.textContent).toContain('1,234');
  });

  it('show() shows dash for null value', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    tooltip.show({ ...sampleData, value: null }, 100, 100);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.textContent).toContain('\u2013');
  });

  it('hide() sets opacity to 0', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    tooltip.show(sampleData, 100, 100);
    tooltip.hide();
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.style.opacity).toBe('0');
  });

  it('hide() preserves content during the closing transition', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    tooltip.show(sampleData, 100, 100);
    tooltip.hide();
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.textContent).toContain('Population');
    expect(el.textContent).toContain('5,000,000');
  });

  it('show() clamps tooltip to container right edge', () => {
    container = createContainer(600, 400);
    const tooltip = new Tooltip(container, mockTheme);
    const tooltipEl = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    Object.defineProperty(tooltipEl, 'offsetWidth', { value: 100, configurable: true });
    Object.defineProperty(tooltipEl, 'offsetHeight', { value: 80, configurable: true });
    // x=590: initial left=600, flips to 590-100-10=480, clamp=Math.max(0,Math.min(480,500))=480
    tooltip.show(sampleData, 590, 100);
    expect(tooltipEl.style.left).toBe('480px');
  });

  it('show() clamps tooltip to container bottom edge', () => {
    container = createContainer(600, 400);
    const tooltip = new Tooltip(container, mockTheme);
    const tooltipEl = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    Object.defineProperty(tooltipEl, 'offsetWidth', { value: 100, configurable: true });
    Object.defineProperty(tooltipEl, 'offsetHeight', { value: 80, configurable: true });
    // y=390: initial top=400, flips to 390-80-10=300, clamp=Math.max(0,Math.min(300,320))=300
    tooltip.show(sampleData, 100, 390);
    expect(tooltipEl.style.top).toBe('300px');
  });

  it('show() clamps to prevent negative left', () => {
    container = createContainer(100, 400);
    const tooltip = new Tooltip(container, mockTheme);
    const tooltipEl = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    Object.defineProperty(tooltipEl, 'offsetWidth', { value: 150, configurable: true });
    Object.defineProperty(tooltipEl, 'offsetHeight', { value: 80, configurable: true });
    // x=10: initial left=20, 20+150=170>100, flips to 10-150-10=-150
    // clamp: Math.max(0, Math.min(-150, 100-150)) = Math.max(0, -150) = 0
    tooltip.show(sampleData, 10, 100);
    expect(tooltipEl.style.left).toBe('0px');
  });

  it('show() clamps to prevent negative top', () => {
    container = createContainer(600, 100);
    const tooltip = new Tooltip(container, mockTheme);
    const tooltipEl = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    Object.defineProperty(tooltipEl, 'offsetWidth', { value: 100, configurable: true });
    Object.defineProperty(tooltipEl, 'offsetHeight', { value: 150, configurable: true });
    // y=10: initial top=20, 20+150=170>100, flips to 10-150-10=-150
    // clamp: Math.max(0, Math.min(-150, 100-150)) = Math.max(0, -150) = 0
    tooltip.show(sampleData, 100, 10);
    expect(tooltipEl.style.top).toBe('0px');
  });

  it('destroy() removes tooltip element', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    tooltip.destroy();
    expect(container.querySelector('.jsc-tooltip')).toBeNull();
  });

  it('sets container position to relative if static', () => {
    container = createContainer();
    container.style.position = 'static';
    new Tooltip(container, mockTheme);
    expect(container.style.position).toBe('relative');
  });

  it('tooltip element has role="tooltip"', () => {
    container = createContainer();
    new Tooltip(container, mockTheme);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.getAttribute('role')).toBe('tooltip');
  });

  it('tooltip element has a unique id', () => {
    const c1 = createContainer();
    const c2 = createContainer();
    const t1 = new Tooltip(c1, mockTheme);
    const t2 = new Tooltip(c2, mockTheme);
    expect(t1.getId()).toBeTruthy();
    expect(t2.getId()).toBeTruthy();
    expect(t1.getId()).not.toBe(t2.getId());
    c1.remove();
    c2.remove();
  });

  it('tooltip element is not a live region', () => {
    container = createContainer();
    new Tooltip(container, mockTheme);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.getAttribute('aria-live')).toBeNull();
  });

  it('getId() returns the tooltip element id', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(tooltip.getId()).toBe(el.id);
    expect(tooltip.getId()).toMatch(/^jsc-tooltip-\d+$/);
  });

  it('show() renders dimension labels when dimensionLabels is provided', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    const data: TooltipData = {
      category: 'Helsinki',
      series: 'Population',
      value: 1826,
      formattedValue: '18,26',
      dimensionLabels: [
        { label: 'Year', value: '2025' },
        { label: 'City', value: 'Helsinki' },
      ],
    };
    tooltip.show(data, 100, 100);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.textContent).toContain('Year: 2025');
    expect(el.textContent).toContain('City: Helsinki');
    expect(el.textContent).toContain('18,26');
    expect(el.querySelectorAll('div')).toHaveLength(3);
  });

  it('show() renders single dimension label when only one varies', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    const data: TooltipData = {
      category: '2025',
      series: 'Population',
      value: 5000,
      formattedValue: '5,000',
      dimensionLabels: [{ label: 'Year', value: '2025' }],
    };
    tooltip.show(data, 100, 100);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.textContent).toContain('Year: 2025');
    expect(el.textContent).toContain('5,000');
    expect(el.querySelectorAll('div')).toHaveLength(2);
  });

  it('show() falls back to old format when dimensionLabels is empty array', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    tooltip.show({ ...sampleData, dimensionLabels: [] }, 100, 100);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.textContent).toContain(sampleData.series);
    expect(el.textContent).toContain(sampleData.category);
  });

  it('show() falls back to old format when dimensionLabels is undefined', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    tooltip.show(sampleData, 100, 100);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.textContent).toContain(sampleData.series);
    expect(el.textContent).toContain(sampleData.category);
  });

  it('show() renders dash for null value with dimension labels', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    const data: TooltipData = {
      category: '2025',
      series: 'Population',
      value: null,
      formattedValue: '\u2013',
      dimensionLabels: [{ label: 'Year', value: '2025' }],
    };
    tooltip.show(data, 100, 100);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.textContent).toContain('\u2013');
  });

  it('applies tooltipPadding and tooltipBoxShadow as inline styles', () => {
    container = createContainer();
    const customTheme: ResolvedTheme = {
      ...mockTheme,
      tooltipPadding: '20px 30px',
      tooltipBoxShadow: '0 4px 8px rgba(0,0,0,0.5)',
    };
    new Tooltip(container, customTheme);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.style.padding).toBe('20px 30px');
    expect(el.style.boxShadow).toBe('0 4px 8px rgba(0,0,0,0.5)');
  });

  it('show() skips value line when hideValueLine is true', () => {
    container = createContainer();
    const tooltip = new Tooltip(container, mockTheme);
    const data: TooltipData = {
      category: '2025',
      series: 'Data',
      value: null,
      formattedValue: '',
      dimensionLabels: [
        { label: 'Price', value: '1 513' },
        { label: 'Cost', value: '423' },
        { label: 'Year', value: '2025' },
      ],
      hideValueLine: true,
    };
    tooltip.show(data, 100, 100);
    const el = container.querySelector('.jsc-tooltip') as HTMLDivElement;
    expect(el.querySelectorAll('div')).toHaveLength(3);
    expect(el.textContent).toContain('Price: 1 513');
    expect(el.textContent).toContain('Cost: 423');
    expect(el.textContent).toContain('Year: 2025');
    expect(el.querySelector('strong')).toBeNull();
  });
});
