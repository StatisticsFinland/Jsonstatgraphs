import { getLocaleStrings } from '../locale/strings';
import type { ChartType } from '../types';

export function applyChartAriaAttributes(
  container: HTMLElement,
  ariaLabel: string,
  chartType: ChartType,
  locale?: string,
): void {
  const strings = getLocaleStrings(locale);
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', ariaLabel);
  container.setAttribute('aria-roledescription', strings.chartTypes[chartType]);
}

export function applyInteractiveChartAriaAttributes(
  svg: SVGSVGElement,
  locale?: string,
): void {
  const strings = getLocaleStrings(locale);
  svg.setAttribute('role', 'application');
  svg.setAttribute('aria-label', strings.chartData);
  svg.removeAttribute('aria-description');
}

export function applySeriesGroupAttributes(
  group: SVGGElement,
  seriesName: string,
  _seriesIndex: number,
  locale?: string
): void {
  const strings = getLocaleStrings(locale);
  group.setAttribute('role', 'list');
  group.setAttribute('aria-label', `${strings.series}: ${seriesName}`);
}

export function applyDataPointAttributes(
  element: SVGElement | HTMLElement,
  label: string,
  value: string,
  locale?: string
): void {
  const strings = getLocaleStrings(locale);
  element.setAttribute('role', 'listitem');
  element.setAttribute('aria-roledescription', strings.dataPoint);
  element.setAttribute('aria-label', `${label}, ${value}`);
}
