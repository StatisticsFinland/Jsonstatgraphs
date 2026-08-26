import * as fs from 'fs';
import * as path from 'path';
import { getSeriesColor } from '../src/theme/palette';
import { resolveTheme } from '../src/theme/theme';
import { DEFAULT_THEME, CSS_PROPERTY_MAP } from '../src/theme/defaults';
import { ResolvedTheme } from '../src/types';

// ---------------------------------------------------------------------------
// palette — getSeriesColor
// ---------------------------------------------------------------------------

describe('getSeriesColor', () => {
  const theme: ResolvedTheme = { ...DEFAULT_THEME };

  it('returns the correct color for index 0', () => {
    expect(getSeriesColor(theme, 0)).toBe(DEFAULT_THEME.seriesColors[0]);
  });

  it('returns the correct color for index 1', () => {
    expect(getSeriesColor(theme, 1)).toBe(DEFAULT_THEME.seriesColors[1]);
  });

  it('returns the correct color for index 2', () => {
    expect(getSeriesColor(theme, 2)).toBe(DEFAULT_THEME.seriesColors[2]);
  });

  it('cycles back to index 0 when index equals the palette length', () => {
    const len = DEFAULT_THEME.seriesColors.length; // 8
    expect(getSeriesColor(theme, len)).toBe(DEFAULT_THEME.seriesColors[0]);
  });

  it('cycles correctly for index beyond palette length', () => {
    const len = DEFAULT_THEME.seriesColors.length;
    expect(getSeriesColor(theme, len + 3)).toBe(DEFAULT_THEME.seriesColors[3]);
  });

  it('works with a custom (shorter) palette', () => {
    const custom: ResolvedTheme = { ...DEFAULT_THEME, seriesColors: ['#aaa', '#bbb', '#ccc'] };
    expect(getSeriesColor(custom, 0)).toBe('#aaa');
    expect(getSeriesColor(custom, 2)).toBe('#ccc');
    expect(getSeriesColor(custom, 3)).toBe('#aaa'); // wraps
    expect(getSeriesColor(custom, 5)).toBe('#ccc');
  });

  it('returns hardcoded fallback when palette is empty', () => {
    const empty: ResolvedTheme = { ...DEFAULT_THEME, seriesColors: [] };
    expect(getSeriesColor(empty, 0)).toBe('#1A56EC');
    expect(getSeriesColor(empty, 5)).toBe('#1A56EC');
  });
});

// ---------------------------------------------------------------------------
// resolveTheme
// ---------------------------------------------------------------------------

describe('resolveTheme', () => {
  describe('with no container and no config', () => {
    it('returns font sizes resolved to px and other properties matching DEFAULT_THEME', () => {
      const result = resolveTheme(null);
      expect(result.fontSizeTitle).toBe('16px');
      expect(result.fontSizeLabel).toBe('14px');
      expect(result.fontSizeTick).toBe('12px');
      expect(result.fontFamily).toBe(DEFAULT_THEME.fontFamily);
      expect(result.colorText).toBe(DEFAULT_THEME.colorText);
      expect(result.seriesColors).toEqual(DEFAULT_THEME.seriesColors);
    });

    it('colorTick defaults to #767676', () => {
      const result = resolveTheme(null);
      expect(result.colorTick).toBe('#767676');
    });

    it('does not return the same object reference as DEFAULT_THEME', () => {
      const result = resolveTheme(null);
      expect(result).not.toBe(DEFAULT_THEME);
    });
  });

  describe('JS config overrides', () => {
    it('overrides fontFamily', () => {
      const result = resolveTheme(null, { fontFamily: 'Arial' });
      expect(result.fontFamily).toBe('Arial');
    });

    it('overrides fontSizeTitle (rem is resolved to px)', () => {
      const result = resolveTheme(null, { fontSizeTitle: '1.5rem' });
      expect(result.fontSizeTitle).toBe('24px');
    });

    it('overrides gridOpacity (numeric)', () => {
      const result = resolveTheme(null, { gridOpacity: 0.5 });
      expect(result.gridOpacity).toBe(0.5);
    });

    it('overrides tooltipPadding', () => {
      const result = resolveTheme(null, { tooltipPadding: '4px 8px' });
      expect(result.tooltipPadding).toBe('4px 8px');
    });

    it('overrides tooltipBoxShadow', () => {
      const result = resolveTheme(null, { tooltipBoxShadow: 'none' });
      expect(result.tooltipBoxShadow).toBe('none');
    });

    it('overrides burger menu theme tokens', () => {
      const result = resolveTheme(null, {
        burgerMenuBackground: '#101010',
        burgerMenuBorderColor: '#202020',
        burgerMenuBorderRadius: '12px',
        burgerMenuShadow: '0 0 0 transparent',
        burgerMenuItemHoverBackground: '#303030',
        burgerMenuItemActiveBackground: '#404040',
        burgerMenuItemSeparatorColor: '#505050',
      });
      expect(result.burgerMenuBackground).toBe('#101010');
      expect(result.burgerMenuBorderColor).toBe('#202020');
      expect(result.burgerMenuBorderRadius).toBe('12px');
      expect(result.burgerMenuShadow).toBe('0 0 0 transparent');
      expect(result.burgerMenuItemHoverBackground).toBe('#303030');
      expect(result.burgerMenuItemActiveBackground).toBe('#404040');
      expect(result.burgerMenuItemSeparatorColor).toBe('#505050');
    });

    it('tooltipPadding and tooltipBoxShadow default to hardcoded values', () => {
      const result = resolveTheme(null);
      expect(result.tooltipPadding).toBe('8px 12px');
      expect(result.tooltipBoxShadow).toBe('0 2px 4px rgba(0,0,0,0.15)');
    });

    it('overrides fontWeightBold (numeric)', () => {
      const result = resolveTheme(null, { fontWeightBold: 800 });
      expect(result.fontWeightBold).toBe(800);
    });

    it('leaves unspecified properties at their defaults', () => {
      const result = resolveTheme(null, { fontFamily: 'Verdana' });
      expect(result.colorText).toBe(DEFAULT_THEME.colorText);
      expect(result.gridOpacity).toBe(DEFAULT_THEME.gridOpacity);
    });
  });

  describe('CSS custom properties override defaults', () => {
    function makeElement(props: Record<string, string>): HTMLElement {
      const el = document.createElement('div');
      document.body.appendChild(el);
      for (const [prop, value] of Object.entries(props)) {
        el.style.setProperty(prop, value);
      }
      return el;
    }

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('reads --jsc-font-family from CSS', () => {
      const el = makeElement({ '--jsc-font-family': 'monospace' });
      const result = resolveTheme(el);
      expect(result.fontFamily).toBe('monospace');
    });

    it('whitespace-only CSS value falls back to default', () => {
      const el = makeElement({ '--jsc-font-family': '   ' });
      const result = resolveTheme(el);
      expect(result.fontFamily).toBe(DEFAULT_THEME.fontFamily);
    });

    it('invalid numeric CSS value falls back to default', () => {
      const el = makeElement({ '--jsc-font-weight-bold': 'abc' });
      const result = resolveTheme(el);
      expect(result.fontWeightBold).toBe(DEFAULT_THEME.fontWeightBold);
    });

    it('reads --jsc-color-text from CSS', () => {
      const el = makeElement({ '--jsc-color-text': '#111111' });
      const result = resolveTheme(el);
      expect(result.colorText).toBe('#111111');
    });

    it('reads --jsc-color-tick from CSS', () => {
      const el = makeElement({ '--jsc-color-tick': '#555555' });
      const result = resolveTheme(el);
      expect(result.colorTick).toBe('#555555');
    });

    it('reads --jsc-border-radius from CSS', () => {
      const el = makeElement({ '--jsc-border-radius': '8px' });
      const result = resolveTheme(el);
      expect(result.borderRadius).toBe('8px');
    });

    it('reads burger menu CSS variables from CSS', () => {
      const el = makeElement({
        '--jsc-burger-menu-background': '#111111',
        '--jsc-burger-menu-border-color': '#222222',
        '--jsc-burger-menu-border-radius': '10px',
        '--jsc-burger-menu-shadow': '0 1px 2px rgba(0,0,0,0.2)',
        '--jsc-burger-menu-item-hover-background': '#333333',
        '--jsc-burger-menu-item-active-background': '#444444',
        '--jsc-burger-menu-item-separator-color': '#555555',
      });
      const result = resolveTheme(el);
      expect(result.burgerMenuBackground).toBe('#111111');
      expect(result.burgerMenuBorderColor).toBe('#222222');
      expect(result.burgerMenuBorderRadius).toBe('10px');
      expect(result.burgerMenuShadow).toBe('0 1px 2px rgba(0,0,0,0.2)');
      expect(result.burgerMenuItemHoverBackground).toBe('#333333');
      expect(result.burgerMenuItemActiveBackground).toBe('#444444');
      expect(result.burgerMenuItemSeparatorColor).toBe('#555555');
    });

    it('parses --jsc-grid-opacity as a number', () => {
      const el = makeElement({ '--jsc-grid-opacity': '0.4' });
      const result = resolveTheme(el);
      expect(result.gridOpacity).toBe(0.4);
    });

    it('parses --jsc-font-weight-bold as a number', () => {
      const el = makeElement({ '--jsc-font-weight-bold': '900' });
      const result = resolveTheme(el);
      expect(result.fontWeightBold).toBe(900);
    });
  });

  describe('JS config takes priority over CSS custom properties', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('JS fontFamily wins over CSS --jsc-font-family', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      el.style.setProperty('--jsc-font-family', 'monospace');
      const result = resolveTheme(el, { fontFamily: 'Georgia' });
      expect(result.fontFamily).toBe('Georgia');
    });

    it('JS gridOpacity wins over CSS --jsc-grid-opacity', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      el.style.setProperty('--jsc-grid-opacity', '0.9');
      const result = resolveTheme(el, { gridOpacity: 0.1 });
      expect(result.gridOpacity).toBe(0.1);
    });
  });

  describe('series colors', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('config.seriesColors overrides defaults', () => {
      const custom = ['#111', '#222', '#333'];
      const result = resolveTheme(null, { seriesColors: custom });
      expect(result.seriesColors).toEqual(custom);
    });

    it('reads CSS series variables and preserves remaining default colors', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      const cssColors = ['#c1', '#c2', '#c3', '#c4', '#c5', '#c6', '#c7', '#c8', '#c9', '#c10'];
      cssColors.forEach((c, i) => el.style.setProperty(`--jsc-series-${i + 1}`, c));
      const result = resolveTheme(el);
      expect(result.seriesColors).toEqual(cssColors);
    });

    it('sparse CSS series override preserves defaults for unset positions', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      el.style.setProperty('--jsc-series-1', '#a1');
      el.style.setProperty('--jsc-series-2', '#a2');
      // series 3-10 are not set
      const result = resolveTheme(el);
      const expected = [...DEFAULT_THEME.seriesColors];
      expected[0] = '#a1';
      expected[1] = '#a2';
      expect(result.seriesColors).toEqual(expected);
    });

    it('falls back to DEFAULT_THEME.seriesColors when no CSS series colors', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      const result = resolveTheme(el);
      expect(result.seriesColors).toEqual(DEFAULT_THEME.seriesColors);
    });

    it('null container skips CSS series reading and returns defaults', () => {
      const result = resolveTheme(null);
      expect(result.seriesColors).toEqual(DEFAULT_THEME.seriesColors);
    });

    it('JS config seriesColors wins over CSS --jsc-series-*', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      el.style.setProperty('--jsc-series-1', '#css1');
      el.style.setProperty('--jsc-series-2', '#css2');
      const jsColors = ['#js1', '#js2', '#js3'];
      const result = resolveTheme(el, { seriesColors: jsColors });
      expect(result.seriesColors).toEqual(jsColors);
    });

    it('sparse series override: only --jsc-series-3 changes only index 2', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      el.style.setProperty('--jsc-series-3', '#custom3');
      const result = resolveTheme(el);
      const expected = [...DEFAULT_THEME.seriesColors];
      expected[2] = '#custom3';
      expect(result.seriesColors).toEqual(expected);
      expect(result.seriesColors[0]).toBe(DEFAULT_THEME.seriesColors[0]);
      expect(result.seriesColors[2]).toBe('#custom3');
    });

    it('mutating returned seriesColors does not affect DEFAULT_THEME', () => {
      const result = resolveTheme(null);
      result.seriesColors[0] = '#mutated';
      expect(DEFAULT_THEME.seriesColors[0]).toBe('#1A56EC');
    });
  });

  describe('colorFocusRing JS config override', () => {
    it('resolves colorFocusRing from JS config', () => {
      const result = resolveTheme(null, { colorFocusRing: '#ff0000' });
      expect(result.colorFocusRing).toBe('#ff0000');
    });

    it('defaults to #0066cc when not configured', () => {
      const result = resolveTheme(null);
      expect(result.colorFocusRing).toBe('#0066cc');
    });
  });

  describe('font size resolution', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('resolves rem font sizes to px using root font size', () => {
      // JSDOM default root font size is usually empty, so should fall back to 16
      const theme = resolveTheme(container);
      // fontSizeTitle default is '1rem' → '16px'
      expect(theme.fontSizeTitle).toBe('16px');
      // fontSizeLabel default is '0.875rem' → '14px'
      expect(theme.fontSizeLabel).toBe('14px');
      // fontSizeTick default is '0.75rem' → '12px'
      expect(theme.fontSizeTick).toBe('12px');
    });

    it('preserves px font sizes unchanged', () => {
      const theme = resolveTheme(container, { fontSizeTitle: '20px' });
      expect(theme.fontSizeTitle).toBe('20px');
    });

    it('resolves em font sizes to px', () => {
      const theme = resolveTheme(container, { fontSizeTitle: '1.5em' });
      expect(theme.fontSizeTitle).toBe('24px');
    });

    it('resolves em font sizes using container font size', () => {
      container.style.fontSize = '20px';
      const theme = resolveTheme(container, { fontSizeTitle: '1.5em' });
      expect(theme.fontSizeTitle).toBe('30px');
    });
  });

  describe('null container skips CSS reading', () => {
    it('uses defaults when container is null, even if config is undefined', () => {
      const result = resolveTheme(null, undefined);
      expect(result.fontFamily).toBe(DEFAULT_THEME.fontFamily);
      expect(result.colorText).toBe(DEFAULT_THEME.colorText);
      // font sizes are resolved to px
      expect(result.fontSizeTitle).toBe('16px');
    });

    it('only applies JS config when container is null', () => {
      const result = resolveTheme(null, { colorBorder: '#000' });
      expect(result.colorBorder).toBe('#000');
      expect(result.colorText).toBe(DEFAULT_THEME.colorText);
    });
  });
});

// ---------------------------------------------------------------------------
// defaults
// ---------------------------------------------------------------------------

describe('DEFAULT_THEME', () => {
  const requiredKeys: (keyof ResolvedTheme)[] = [
    'fontFamily',
    'fontSizeTick',
    'fontSizeLabel',
    'fontSizeTitle',
    'fontWeightNormal',
    'fontWeightBold',
    'colorBackground',
    'colorSurface',
    'colorText',
    'colorTextSecondary',
    'colorBorder',
    'colorTick',
    'colorError',
    'colorFocusRing',
    'colorLink',
    'borderRadius',
    'gridOpacity',
    'tooltipPadding',
    'tooltipBoxShadow',
    'burgerMenuBackground',
    'burgerMenuBorderColor',
    'burgerMenuBorderRadius',
    'burgerMenuShadow',
    'burgerMenuItemHoverBackground',
    'burgerMenuItemActiveBackground',
    'burgerMenuItemSeparatorColor',
    'seriesColors',
  ];

  it('has all required properties', () => {
    for (const key of requiredKeys) {
      expect(DEFAULT_THEME).toHaveProperty(key);
    }
  });

  it('seriesColors is a non-empty array of strings', () => {
    expect(Array.isArray(DEFAULT_THEME.seriesColors)).toBe(true);
    expect(DEFAULT_THEME.seriesColors.length).toBeGreaterThan(0);
    for (const color of DEFAULT_THEME.seriesColors) {
      expect(typeof color).toBe('string');
    }
  });
});

describe('CSS_PROPERTY_MAP', () => {
  it('has entries for all non-seriesColors properties of ResolvedTheme', () => {
    const scalarKeys: (keyof ResolvedTheme)[] = [
      'fontFamily',
      'fontSizeTick',
      'fontSizeLabel',
      'fontSizeTitle',
      'fontWeightNormal',
      'fontWeightBold',
      'colorBackground',
      'colorSurface',
      'colorText',
      'colorTextSecondary',
      'colorBorder',
      'colorTick',
      'colorError',
      'colorFocusRing',
      'colorLink',
      'borderRadius',
      'gridOpacity',
      'tooltipPadding',
      'tooltipBoxShadow',
      'burgerMenuBackground',
      'burgerMenuBorderColor',
      'burgerMenuBorderRadius',
      'burgerMenuShadow',
      'burgerMenuItemHoverBackground',
      'burgerMenuItemActiveBackground',
      'burgerMenuItemSeparatorColor',
    ];

    for (const key of scalarKeys) {
      expect(CSS_PROPERTY_MAP).toHaveProperty(key);
    }
  });

  it('all CSS property values start with --jsc-', () => {
    for (const cssVar of Object.values(CSS_PROPERTY_MAP)) {
      expect(cssVar).toMatch(/^--jsc-/);
    }
  });
});

// ---------------------------------------------------------------------------
// README sync — CSS_PROPERTY_MAP must stay documented
// ---------------------------------------------------------------------------

describe('README theming sync', () => {
  const readmePath = path.resolve(__dirname, '../README.md');
  const readmeContent = fs.readFileSync(readmePath, 'utf-8');

  it('documents every CSS variable from CSS_PROPERTY_MAP', () => {
    for (const cssVar of Object.values(CSS_PROPERTY_MAP)) {
      expect(readmeContent).toContain(cssVar);
    }
  });

  it('documents series color variables (--jsc-series-)', () => {
    expect(readmeContent).toContain('--jsc-series-');
  });

  it('documents correct default values for each CSS variable', () => {
    // Parse all table rows matching: | `--jsc-variable-name` | `default value` | ... |
    const rowRegex = /\|\s*`(--jsc-[^`]+)`\s*\|\s*`([^`]+)`\s*\|/g;
    const readmeDefaults = new Map<string, string>();
    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(readmeContent)) !== null) {
      readmeDefaults.set(match[1], match[2]);
    }

    for (const prop of Object.keys(CSS_PROPERTY_MAP) as Array<keyof typeof CSS_PROPERTY_MAP>) {
      const cssVar = CSS_PROPERTY_MAP[prop];
      expect(readmeDefaults.has(cssVar)).toBe(true);
      const readmeDefault = readmeDefaults.get(cssVar)!;
      const themeDefault = String(DEFAULT_THEME[prop]);
      expect(readmeDefault).toBe(themeDefault);
    }
  });
});
