import { ThemeConfig, ResolvedTheme } from '../types';
import { DEFAULT_THEME, CSS_PROPERTY_MAP } from './defaults';

const NUMERIC_PROPERTIES = new Set<keyof ResolvedTheme>(['fontWeightNormal', 'fontWeightBold', 'gridOpacity']);

function resolveFontSizePx(value: string, rootFontSize: number, containerFontSize: number): string {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) return value;
  if (/rem$/i.test(value)) {
    return `${num * rootFontSize}px`;
  }
  if (/em$/i.test(value)) {
    return `${num * containerFontSize}px`;
  }
  return value; // already px or unitless — keep as-is
}

type ScalarKey = Exclude<keyof ResolvedTheme, 'seriesColors' | 'mapColors'>;

function getCssValue(style: CSSStyleDeclaration, prop: ScalarKey): unknown {
  const raw = style.getPropertyValue(CSS_PROPERTY_MAP[prop]).trim();
  if (raw === '') return undefined;
  if (NUMERIC_PROPERTIES.has(prop)) {
    const parsed = Number.parseFloat(raw);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return raw;
}

function resolveSeriesColors(style: CSSStyleDeclaration | null, config?: ThemeConfig): string[] {
  if (config?.seriesColors && config.seriesColors.length > 0) return [...config.seriesColors];
  if (style) {
    const colors = [...DEFAULT_THEME.seriesColors];
    let anySet = false;
    for (let i = 1; i <= 8; i++) {
      const val = style.getPropertyValue(`--jsc-series-${i}`).trim();
      if (val !== '') {
        colors[i - 1] = val;
        anySet = true;
      }
    }
    if (anySet) return colors;
  }
  return [...DEFAULT_THEME.seriesColors];
}

function resolveMapColors(config?: ThemeConfig): string[] {
  if (config?.mapColors && config.mapColors.length > 0) return [...config.mapColors];
  return [...DEFAULT_THEME.mapColors];
}

export function resolveTheme(container: HTMLElement | null, config?: ThemeConfig): ResolvedTheme {
  const style = container ? getComputedStyle(container) : null;
  const resolved: ResolvedTheme = { ...DEFAULT_THEME };

  for (const prop of (Object.keys(CSS_PROPERTY_MAP) as Array<keyof typeof CSS_PROPERTY_MAP>)) {
    const configValue = config?.[prop as keyof ThemeConfig];
    if (configValue !== undefined && configValue !== null) {
      (resolved as Record<ScalarKey, unknown>)[prop] = configValue;
      continue;
    }
    if (style) {
      const cssValue = getCssValue(style, prop);
      if (cssValue !== undefined) {
        (resolved as Record<ScalarKey, unknown>)[prop] = cssValue;
      }
    }
  }

  resolved.seriesColors = resolveSeriesColors(style, config);
  resolved.mapColors = resolveMapColors(config);

  const rootFontSize = (() => {
    if (typeof globalThis.document !== 'undefined') {
      const raw = getComputedStyle(document.documentElement).fontSize;
      const px = Number.parseFloat(raw);
      return px > 0 ? px : 16;
    }
    return 16;
  })();

  const containerFontSize = (() => {
    if (style) {
      const raw = style.fontSize;
      const px = Number.parseFloat(raw);
      return px > 0 ? px : rootFontSize;
    }
    return rootFontSize;
  })();

  const FONT_SIZE_KEYS: (keyof ResolvedTheme)[] = ['fontSizeTitle', 'fontSizeLabel', 'fontSizeTick'];
  for (const key of FONT_SIZE_KEYS) {
    const val = resolved[key];
    if (typeof val === 'string') {
      (resolved as unknown as Record<string, unknown>)[key] = resolveFontSizePx(val, rootFontSize, containerFontSize);
    }
  }

  return resolved;
}
