export function applyChartAriaAttributes(
  container: HTMLElement,
  ariaLabel: string
): void {
  container.setAttribute('role', 'figure');
  container.setAttribute('aria-label', ariaLabel);
}

export function applySeriesGroupAttributes(
  group: SVGGElement,
  seriesName: string,
  _seriesIndex: number
): void {
  group.setAttribute('role', 'list');
  group.setAttribute('aria-label', `Series: ${seriesName}`);
}

export function applyDataPointAttributes(
  element: SVGElement | HTMLElement,
  label: string,
  value: string
): void {
  element.setAttribute('role', 'listitem');
  element.setAttribute('aria-roledescription', 'data point');
  element.setAttribute('aria-label', `${label}: ${value}`);
}
