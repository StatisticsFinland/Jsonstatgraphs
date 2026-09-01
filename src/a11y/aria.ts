import { getLocaleStrings } from '../locale/strings';

export function applyChartAriaAttributes(
  container: HTMLElement,
  ariaLabel: string
): void {
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', ariaLabel);
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
  element.setAttribute('aria-label', `${label}: ${value}`);
}
