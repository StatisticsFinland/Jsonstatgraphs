import { Legend } from '../../src/interaction/legend';
import { ResolvedTheme } from '../../src/types';
import { getSeriesColor } from '../../src/theme/palette';

// jsdom normalizes hex colors to rgb() when reading style properties
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

const mockTheme: ResolvedTheme = {
  fontFamily: 'system-ui, sans-serif',
  fontSizeTick: '0.75rem',
  fontSizeLabel: '0.875rem',
  fontSizeTitle: '1rem',
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

const seriesNames = ['Series A', 'Series B', 'Series C'];

describe('Legend', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container.remove();
  });

  it('creates legend element in container', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    new Legend(container, seriesNames, mockTheme);
    expect(container.querySelector('.jsc-legend')).not.toBeNull();
  });

  it('render() creates buttons for each series', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme);
    legend.render();
    const buttons = container.querySelectorAll('.jsc-legend-item');
    expect(buttons).toHaveLength(3);
  });

  it('each button shows series name', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme);
    legend.render();
    const buttons = container.querySelectorAll('.jsc-legend-item');
    expect(buttons[0].textContent).toContain('Series A');
    expect(buttons[1].textContent).toContain('Series B');
    expect(buttons[2].textContent).toContain('Series C');
  });

  it('each button shows color swatch', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme);
    legend.render();
    const buttons = container.querySelectorAll('.jsc-legend-item');
    for (let i = 0; i < seriesNames.length; i++) {
      const swatch = buttons[i].querySelector('span') as HTMLSpanElement;
      expect(swatch.style.background).toBe(hexToRgb(getSeriesColor(mockTheme, i)));
    }
  });

  it('clicking a button toggles active state', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme);
    legend.render();

    let btn = container.querySelectorAll('.jsc-legend-item')[0] as HTMLButtonElement;
    expect(btn.style.opacity).toBe('1');

    btn.click();

    // render() is called after click, re-query the button
    btn = container.querySelectorAll('.jsc-legend-item')[0] as HTMLButtonElement;
    expect(btn.style.opacity).toBe('0.4');
    const label = btn.querySelectorAll('span')[1] as HTMLSpanElement;
    expect(label.style.textDecoration).toBe('line-through');
  });

  it('clicking button triggers toggle callback', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme);
    legend.render();

    const callback = jest.fn();
    legend.setToggleCallback(callback);

    const btn = container.querySelectorAll('.jsc-legend-item')[1] as HTMLButtonElement;
    btn.click();

    // Series B is index 1, after click active becomes false
    expect(callback).toHaveBeenCalledWith(1, false);
  });

  it('clicking inactive button re-activates', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme);
    legend.render();

    // First click: deactivate
    let btn = container.querySelectorAll('.jsc-legend-item')[0] as HTMLButtonElement;
    btn.click();

    // Second click: re-activate (re-query after first click re-render)
    btn = container.querySelectorAll('.jsc-legend-item')[0] as HTMLButtonElement;
    btn.click();

    btn = container.querySelectorAll('.jsc-legend-item')[0] as HTMLButtonElement;
    expect(btn.style.opacity).toBe('1');
    const label = btn.querySelectorAll('span')[1] as HTMLSpanElement;
    expect(label.style.textDecoration).toBe('none');
  });

  it('getHeight() returns element offsetHeight', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme);
    legend.render();
    const el = container.querySelector('.jsc-legend') as HTMLDivElement;
    Object.defineProperty(el, 'offsetHeight', { value: 42, configurable: true });
    expect(legend.getHeight()).toBe(42);
  });

  it('buttons have aria-pressed matching active state', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme);
    legend.render();

    const buttons = container.querySelectorAll('.jsc-legend-item') as NodeListOf<HTMLButtonElement>;
    buttons.forEach((btn) => {
      expect(btn.getAttribute('aria-pressed')).toBe('true');
    });

    // Click first button to deactivate
    buttons[0].click();
    const updatedBtn = container.querySelectorAll('.jsc-legend-item')[0] as HTMLButtonElement;
    expect(updatedBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('buttons have aria-label for screen reader announcement', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme);
    legend.render();

    const buttons = container.querySelectorAll('.jsc-legend-item') as NodeListOf<HTMLButtonElement>;
    expect(buttons[0].tagName).toBe('BUTTON');
    expect(buttons[0].getAttribute('aria-label')).toBe('Series A, Toggle series');
    expect(buttons[1].getAttribute('aria-label')).toBe('Series B, Toggle series');
  });

  it('localizes button aria-labels and keeps the visible name first', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme, { locale: 'fi' });
    legend.render();

    const button = container.querySelector('.jsc-legend-item') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Series A, Näytä tai piilota sarja');
  });

  it.each([
    ['en', 'Series A, Toggle series'],
    ['fi', 'Series A, Näytä tai piilota sarja'],
    ['sv', 'Series A, Visa eller dölj serie'],
  ])('uses a fully localized action text for %s', (locale, expectedLabel) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme, { locale });
    legend.render();

    const button = container.querySelector('.jsc-legend-item') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe(expectedLabel);
  });

  it('injects focus-visible CSS style into document head', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    new Legend(container, seriesNames, mockTheme);
    const style = document.querySelector('#jsc-legend-styles') as HTMLStyleElement;
    expect(style).not.toBeNull();
    expect(style.textContent).toContain(':focus-visible');
    expect(style.textContent).toContain('var(--jsc-color-focus-ring');
  });

  it('does not inject duplicate style on multiple Legend instances', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    new Legend(container, seriesNames, mockTheme);
    new Legend(container, seriesNames, mockTheme);
    const styles = document.querySelectorAll('#jsc-legend-styles');
    expect(styles).toHaveLength(1);
  });

  it('destroy() removes element from container', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme);
    legend.render();
    legend.destroy();
    expect(container.querySelector('.jsc-legend')).toBeNull();
  });

  it('focus is preserved after toggle click', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const legend = new Legend(container, seriesNames, mockTheme);
    legend.render();

    const btn = container.querySelectorAll('.jsc-legend-item')[1] as HTMLButtonElement;
    btn.focus();
    btn.click();

    const focusedEl = document.activeElement as HTMLElement;
    const buttons = container.querySelectorAll('.jsc-legend-item');
    expect(focusedEl).toBe(buttons[1]);
  });

  it('renders line marker symbol in swatch when accessibility mode is enabled for line chart', () => {
    container = document.createElement('div');
    document.body.appendChild(container);

    const legend = new Legend(container, seriesNames, mockTheme, {
      accessibilityMode: true,
      chartType: 'line',
    });
    legend.render();

    const firstSwatch = container.querySelector('.jsc-legend-swatch') as HTMLSpanElement;
    const markerPath = firstSwatch.querySelector('svg path');
    expect(markerPath).not.toBeNull();
    expect(firstSwatch.style.border).toBe('');
  });

  it('renders patterned swatch when accessibility mode is enabled for pattern-based chart', () => {
    container = document.createElement('div');
    document.body.appendChild(container);

    const legend = new Legend(container, seriesNames, mockTheme, {
      accessibilityMode: true,
      chartType: 'stackedVerticalBar',
    });
    legend.render();

    const firstSwatch = container.querySelector('.jsc-legend-swatch') as HTMLSpanElement;
    expect(firstSwatch.classList.contains('jsc-legend-swatch--pattern')).toBe(true);
    const patternPath = firstSwatch.querySelector('svg path');
    expect(patternPath).not.toBeNull();
  });
});
