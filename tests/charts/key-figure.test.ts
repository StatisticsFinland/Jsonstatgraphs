import { createKeyFigureChart } from '../../src/charts/key-figure';
import { ChartConfig } from '../../src/types';

const defaultConfig: ChartConfig = {};

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => {
  container.remove();
});

describe('createKeyFigureChart', () => {
  it('does not use application semantics for document-style content', () => {
    createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config: defaultConfig });

    expect(container.querySelector('[role="application"]')).toBeNull();
  });

  it('renders value with correct formatting', () => {
    createKeyFigureChart({ container, value: 1234567, unit: 'persons', decimals: 0, config: defaultConfig });
    const valueEl = container.querySelector('.jsc-key-figure-value');
    expect(valueEl).not.toBeNull();
    // toLocaleString output varies by environment; verify the digits are present
    expect(valueEl?.textContent).toMatch(/1.?234.?567/);
    expect(valueEl?.hasAttribute('aria-label')).toBe(false);
  });

  it('renders null value as en-dash', () => {
    createKeyFigureChart({ container, value: null, unit: '', decimals: undefined, config: defaultConfig });
    const valueEl = container.querySelector('.jsc-key-figure-value');
    expect(valueEl).not.toBeNull();
    expect(valueEl?.textContent).toBe('\u2013');
    expect(valueEl?.getAttribute('aria-label')).toBe('No data');
  });

  it('renders title when provided', () => {
    const config: ChartConfig = { title: 'Population' };
    createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config });
    const titleEl = container.querySelector('.jsc-key-figure-title');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toBe('Population');
    expect((titleEl?.parentElement as HTMLElement).style.textAlign).toBe('center');
    expect((titleEl?.parentElement as HTMLElement).style.padding).toBe('24px 20px');
  });

  it('does not render title when empty', () => {
    createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config: defaultConfig });
    const titleEl = container.querySelector('.jsc-key-figure-title');
    expect(titleEl).toBeNull();
  });

  it('renders unit when provided', () => {
    createKeyFigureChart({ container, value: 42, unit: '%', decimals: undefined, config: defaultConfig });
    const unitEl = container.querySelector('.jsc-key-figure-unit');
    expect(unitEl).not.toBeNull();
    expect(unitEl?.textContent).toBe('%');
  });

  it('does not render unit when empty', () => {
    createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config: defaultConfig });
    const unitEl = container.querySelector('.jsc-key-figure-unit');
    expect(unitEl).toBeNull();
  });

  it('renders .jsc-key-figure-display wrapper containing the value element', () => {
    createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config: defaultConfig });
    const displayEl = container.querySelector('.jsc-key-figure-display');
    expect(displayEl).not.toBeNull();
    const valueEl = displayEl?.querySelector('.jsc-key-figure-value');
    expect(valueEl).not.toBeNull();
  });

  it('renders .jsc-key-figure-display wrapper containing the unit element when unit is provided', () => {
    createKeyFigureChart({ container, value: 42, unit: '%', decimals: undefined, config: defaultConfig });
    const displayEl = container.querySelector('.jsc-key-figure-display');
    expect(displayEl).not.toBeNull();
    const unitEl = displayEl?.querySelector('.jsc-key-figure-unit');
    expect(unitEl).not.toBeNull();
  });

  it('renders footer items with source and updated entries', () => {
    const config: ChartConfig = {
      footerItems: [
        { type: 'source', label: 'Source:', value: 'Statistics Finland' },
        { type: 'updated', label: 'Updated:', value: '2024-01-01' },
      ],
    };
    createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config });
    const footerEl = container.querySelector('.jsc-key-figure-footer');
    expect(footerEl).not.toBeNull();
    const sourceEl = container.querySelector('.jsc-key-figure-source');
    expect(sourceEl).not.toBeNull();
    expect(sourceEl?.textContent).toBe('Source: Statistics Finland');
    const updatedEl = container.querySelector('.jsc-key-figure-updated');
    expect(updatedEl).not.toBeNull();
    expect(updatedEl?.textContent).toBe('Updated: 2024-01-01');
    expect((footerEl as HTMLElement).style.alignItems).toBe('flex-start');
    expect((footerEl as HTMLElement).style.textAlign).toBe('left');
    expect((footerEl as HTMLElement).style.padding).toBe('0px');
    expect((footerEl as HTMLElement).style.alignSelf).toBe('stretch');
  });

  it('does not render footer when no footerItems in config', () => {
    createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config: defaultConfig });
    const footerEl = container.querySelector('.jsc-key-figure-footer');
    expect(footerEl).toBeNull();
  });

  it('destroy() removes content from container', () => {
    const instance = createKeyFigureChart({ container, value: 42, unit: '%', decimals: undefined, config: defaultConfig });
    instance.destroy();
    const wrapper = container.querySelector('.jsc-key-figure-wrapper');
    expect(wrapper).toBeNull();
  });

  it('applies ARIA role and aria-label attributes to container', () => {
    createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config: defaultConfig });
    expect(container.getAttribute('role')).not.toBeNull();
    expect(container.getAttribute('aria-label')).not.toBeNull();
  });

  it('uses ariaLabel config for aria-label', () => {
    const config: ChartConfig = { ariaLabel: 'Population count' };
    createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config });
    expect(container.getAttribute('aria-label')).toBe('Population count');
  });

  it('uses the visible title to label the region', () => {
    const config: ChartConfig = { title: 'GDP' };
    createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config });
    const title = container.querySelector('.jsc-key-figure-title');
    expect(container.getAttribute('aria-label')).toBeNull();
    expect(container.getAttribute('aria-labelledby')).toBe(title?.id);
    expect(title?.getAttribute('aria-hidden')).toBe('true');
  });

  it('destroy() removes role and aria-label from container', () => {
    const instance = createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config: defaultConfig });
    instance.destroy();
    expect(container.getAttribute('role')).toBeNull();
    expect(container.getAttribute('aria-label')).toBeNull();
  });

  describe('sourceLink', () => {
    it('renders source footer item as <a> when sourceLink is set', () => {
      const config: ChartConfig = {
        footerItems: [{ label: 'Source:', value: 'Stats', type: 'source' }],
        sourceLink: 'https://stat.fi',
      };
      createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config });
      const sourceEl = container.querySelector('.jsc-key-figure-source');
      expect(sourceEl).not.toBeNull();
      expect(sourceEl?.tagName.toLowerCase()).toBe('span');
      const linkEl = sourceEl?.querySelector('.jsc-footer-value') as HTMLAnchorElement | null;
      expect(linkEl).not.toBeNull();
      expect(linkEl?.tagName.toLowerCase()).toBe('a');
      expect(linkEl?.getAttribute('href')).toBe('https://stat.fi');
      expect(linkEl?.target).toBe('_blank');
      expect(linkEl?.rel).toBe('noopener noreferrer');
      expect(linkEl?.getAttribute('aria-label')).toContain('(opens in new tab)');
      expect(linkEl?.textContent).toBe('Stats');
    });

    it('renders source as <span> when sourceLink is not set', () => {
      const config: ChartConfig = {
        footerItems: [{ label: 'Source:', value: 'Stats', type: 'source' }],
      };
      createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config });
      const sourceEl = container.querySelector('.jsc-key-figure-source');
      expect(sourceEl).not.toBeNull();
      expect(sourceEl?.tagName.toLowerCase()).toBe('span');
    });

    it('rejects invalid URL schemes', () => {
      const config: ChartConfig = {
        footerItems: [{ label: 'Source:', value: 'Stats', type: 'source' }],
        sourceLink: 'javascript:void(0)',
      };
      createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config });
      const sourceEl = container.querySelector('.jsc-key-figure-source');
      expect(sourceEl).not.toBeNull();
      expect(sourceEl?.tagName.toLowerCase()).toBe('span');
    });
  });

  describe('footer label+value', () => {
    it('renders label and value as separate spans when footer item has label+value', () => {
      const config: ChartConfig = {
        footerItems: [{ type: 'source', label: 'Source:', value: 'Statistics Finland' }],
      };
      createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config });
      const sourceEl = container.querySelector('.jsc-key-figure-source');
      expect(sourceEl).not.toBeNull();
      const labelSpan = sourceEl?.querySelector('.jsc-footer-label');
      const valueSpan = sourceEl?.querySelector('.jsc-footer-value');
      expect(labelSpan).not.toBeNull();
      expect(valueSpan).not.toBeNull();
      expect(labelSpan?.textContent).toBe('Source: ');
      expect(valueSpan?.textContent).toBe('Statistics Finland');
    });

    it('underlines only the value span when sourceLink is set with label+value item', () => {
      const config: ChartConfig = {
        footerItems: [{ type: 'source', label: 'Source:', value: 'Statistics Finland' }],
        sourceLink: 'https://stat.fi',
      };
      createKeyFigureChart({ container, value: 42, unit: '', decimals: undefined, config });
      const sourceEl = container.querySelector('.jsc-key-figure-source');
      const valueSpan = sourceEl?.querySelector('.jsc-footer-value') as HTMLElement | null;
      expect(valueSpan?.style.textDecoration).toBe('underline');
    });
  });
});
