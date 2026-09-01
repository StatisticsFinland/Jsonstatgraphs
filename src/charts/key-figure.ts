import { ChartConfig, FooterItem } from '../types';
import { renderHtmlFooter } from './footer';
import { resolveTheme } from '../theme/theme';
import { applyChartAriaAttributes } from '../a11y/aria';
import { getLocaleStrings } from '../locale/strings';

export interface KeyFigureChartConfig {
  container: HTMLElement;
  value: number | null;
  unit: string;
  decimals?: number;
  config: ChartConfig;
}

function renderKeyFigure(
  wrapper: HTMLDivElement,
  value: number | null,
  unit: string,
  decimals: number | undefined,
  config: ChartConfig
): void {
  wrapper.innerHTML = '';

  const styleEl = document.createElement('style');
  styleEl.textContent = '.jsc-key-figure-source a:focus-visible { outline: 2px solid var(--jsc-color-focus-ring, #0066cc); outline-offset: 2px; }';
  wrapper.appendChild(styleEl);

  const theme = resolveTheme(wrapper.parentElement, config.theme);
  const strings = getLocaleStrings(config.locale);

  const container = document.createElement('div');
  container.className = 'jsc-key-figure';
  container.style.fontFamily = theme.fontFamily;
  container.style.color = theme.colorText;
  container.style.textAlign = 'center';
  container.style.padding = '24px 16px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.height = '100%';
  container.style.boxSizing = 'border-box';

  const title = config.title ?? '';
  if (title !== '') {
    const titleEl = document.createElement('div');
    titleEl.className = 'jsc-key-figure-title';
    titleEl.textContent = title;
    titleEl.style.fontSize = theme.fontSizeLabel;
    titleEl.style.fontWeight = String(theme.fontWeightNormal);
    titleEl.style.color = theme.colorTextSecondary;
    titleEl.style.marginBottom = '8px';
    container.appendChild(titleEl);
  }

  const displayEl = document.createElement('div');
  displayEl.className = 'jsc-key-figure-display';
  displayEl.style.display = 'flex';
  displayEl.style.flexDirection = 'column';
  displayEl.style.alignItems = 'center';
  displayEl.style.marginBottom = '16px';

  const valueEl = document.createElement('div');
  valueEl.className = 'jsc-key-figure-value';
  if (value === null) {
    valueEl.textContent = '\u2013';
    valueEl.setAttribute('aria-label', strings.noData);
  } else {
    const formatOptions: Intl.NumberFormatOptions =
      decimals === undefined
        ? {}
        : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
    valueEl.textContent = value.toLocaleString(config.locale, formatOptions);
  }
  const titlePx = Number.parseFloat(theme.fontSizeTitle);
  valueEl.style.fontSize = `${titlePx * 2.5}px`;
  valueEl.style.fontWeight = String(theme.fontWeightBold);
  valueEl.style.lineHeight = '1.1';
  displayEl.appendChild(valueEl);

  if (unit !== '') {
    const unitEl = document.createElement('div');
    unitEl.className = 'jsc-key-figure-unit';
    unitEl.textContent = unit;
    unitEl.style.fontSize = theme.fontSizeLabel;
    unitEl.style.fontWeight = String(theme.fontWeightNormal);
    unitEl.style.color = theme.colorTextSecondary;
    displayEl.appendChild(unitEl);
  }

  container.appendChild(displayEl);

  const footerItems: FooterItem[] = config.footerItems ?? [];
  if (footerItems.length > 0) {
    renderHtmlFooter({
      parent: container,
      footerItems,
      sourceLink: config.sourceLink,
      theme,
    });
  }

  wrapper.appendChild(container);
}

export function createKeyFigureChart(chartConfig: KeyFigureChartConfig): {
  update(value: number | null, unit: string, decimals: number | undefined, config: ChartConfig): void;
  destroy(): void;
} {
  const { container } = chartConfig;
  let value = chartConfig.value;
  let unit = chartConfig.unit;
  let decimals = chartConfig.decimals;
  let config = chartConfig.config;

  const wrapper = document.createElement('div');
  wrapper.className = 'jsc-key-figure-wrapper';
  container.appendChild(wrapper);

  applyChartAriaAttributes(container, config.ariaLabel ?? config.title ?? 'Key figure');

  renderKeyFigure(wrapper, value, unit, decimals, config);

  return {
    update(newValue: number | null, newUnit: string, newDecimals: number | undefined, newConfig: ChartConfig): void {
      value = newValue;
      unit = newUnit;
      decimals = newDecimals;
      config = newConfig;
      applyChartAriaAttributes(container, config.ariaLabel ?? config.title ?? 'Key figure');
      renderKeyFigure(wrapper, value, unit, decimals, config);
    },

    destroy(): void {
      wrapper.remove();
      container.removeAttribute('role');
      container.removeAttribute('aria-label');
    },
  };
}
