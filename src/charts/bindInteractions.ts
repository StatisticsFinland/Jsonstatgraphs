import { ResolvedTheme, ChartData } from '../types';
import { Tooltip, TooltipData } from '../interaction/tooltip';
import { KeyboardNavigator, FocusableElement, PointNavigationAxis } from '../interaction/keyboard';
import { applyDataPointAttributes } from '../a11y/aria';

export interface DataElementInfo {
  element: SVGElement;
  seriesIndex: number;
  pointIndex: number;
  /** Stable identity (e.g. category code) used to keep focus on the same datapoint across redraws, even if its positional index shifts. */
  pointKey?: string;
  navigationGroupIndex?: number;
  navigationPointIndex?: number;
  navigationPointKey?: string;
  category: string;
  seriesName: string;
  value: number | null;
  formattedValue: string;
  ariaLabel?: string;
  dimensionLabels?: { label: string; value: string }[];
  hideValueLine?: boolean;
  omitSeriesNameFromAriaLabel?: boolean;
}

export interface BindInteractionsConfig {
  container: HTMLElement;
  elements: DataElementInfo[];
  theme: ResolvedTheme;
  locale?: string;
  chartData?: ChartData;
  ariaLabel?: string;
  caption?: string;
  pointAxis?: PointNavigationAxis;
}

export interface BoundInteractions {
  tooltip: Tooltip;
  keyboard: KeyboardNavigator;
  destroy(): void;
}

export function ensureFocusStyles(): void {
  const styleId = 'jsc-focus-styles';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = [
    'svg.jsc-chart [tabindex]:focus {',
    '  outline: none;',
    '}',
    'svg.jsc-chart .jsc-focus-indicator {',
    '  fill: none;',
    '  stroke: var(--jsc-color-focus-ring, #0066cc);',
    '  stroke-width: 4px;',
    '  vector-effect: non-scaling-stroke;',
    '  pointer-events: none;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}

function removeFocusIndicator(container: HTMLElement): void {
  container.querySelector('.jsc-focus-indicator')?.remove();
}

function renderFocusIndicator(container: HTMLElement, element: SVGElement): void {
  removeFocusIndicator(container);
  const parent = element.parentNode;
  if (!parent) return;

  const indicator = element.cloneNode(false) as SVGElement;
  indicator.removeAttribute('id');
  indicator.removeAttribute('role');
  indicator.removeAttribute('tabindex');
  indicator.removeAttribute('aria-label');
  indicator.removeAttribute('aria-roledescription');
  delete indicator.dataset.jscSeriesIndex;
  delete indicator.dataset.jscPointIndex;
  indicator.setAttribute('class', 'jsc-focus-indicator');
  indicator.setAttribute('aria-hidden', 'true');
  parent.appendChild(indicator);
}

function buildTooltipData(
  info: { category: string; seriesName: string; value: number | null; formattedValue: string; dimensionLabels?: { label: string; value: string }[]; hideValueLine?: boolean },
  chartData?: ChartData,
  formattedMeasurement?: string,
): TooltipData {
  const formattedValue = formattedMeasurement ?? formatTooltipValue(info, chartData);

  if (info.dimensionLabels && info.dimensionLabels.length > 0) {
    return {
      category: info.category,
      series: info.seriesName,
      value: info.value,
      formattedValue,
      dimensionLabels: info.dimensionLabels,
      hideValueLine: info.hideValueLine,
    };
  }
  const dimensionLabels: { label: string; value: string }[] = [];
  if (chartData?.xLabel !== undefined && chartData.categories.length > 1) {
    dimensionLabels.push({ label: chartData.xLabel, value: info.category });
  }
  if (chartData && chartData.series.length > 1 && chartData.seriesLabel) {
    dimensionLabels.push({ label: chartData.seriesLabel, value: info.seriesName });
  }
  return {
    category: info.category,
    series: info.seriesName,
    value: info.value,
    formattedValue,
    dimensionLabels: dimensionLabels.length > 0 ? dimensionLabels : undefined,
  };
}

function formatTooltipValue(
  info: { value: number | null; formattedValue: string },
  chartData?: ChartData,
): string {
  return chartData?.yLabel && info.value !== null
    && !info.formattedValue.includes(chartData.yLabel)
    ? `${info.formattedValue} ${chartData.yLabel}`
    : info.formattedValue;
}

export function bindInteractions(config: BindInteractionsConfig): BoundInteractions {
  ensureFocusStyles();
  const { container, elements, theme, locale, chartData, pointAxis } = config;

  const tooltip = new Tooltip(container, theme);
  const keyboard = new KeyboardNavigator(container, pointAxis);

  // AbortController lets us remove all listeners in one shot on destroy()
  const controller = new AbortController();
  const { signal } = controller;

  const isTouchDevice = 'ontouchstart' in globalThis;
  let activeTouch: SVGElement | null = null;
  let hoveredElement: SVGElement | null = null;
  let tooltipHovered = false;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelScheduledHide = (): void => {
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };
  const scheduleHide = (): void => {
    cancelScheduledHide();
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (hoveredElement === null && !tooltipHovered) {
        tooltip.hide();
      }
    }, 0);
  };

  const tooltipElement = tooltip.getElement();
  tooltipElement.addEventListener('mouseenter', () => {
    tooltipHovered = true;
    cancelScheduledHide();
  }, { signal });
  tooltipElement.addEventListener('mouseleave', () => {
    tooltipHovered = false;
    scheduleHide();
  }, { signal });

  for (const info of elements) {
    const { element, seriesName, category, value, formattedValue } = info;
    const formattedMeasurement = formatTooltipValue(info, chartData);

    // ARIA attributes
    const categoryName = chartData?.xLabel
      ? `${chartData.xLabel}: ${category}`
      : category;
    const announcedValue = info.omitSeriesNameFromAriaLabel
      ? formattedMeasurement
      : `${seriesName}: ${formattedMeasurement}`;
    applyDataPointAttributes(element, categoryName, announcedValue, locale);
    if (info.ariaLabel) {
      element.setAttribute('aria-label', info.ariaLabel);
    }

    // Tooltip data shared across handlers
    const { dimensionLabels, hideValueLine } = info;
    const tooltipData = buildTooltipData(
      { category, seriesName, value, formattedValue, dimensionLabels, hideValueLine },
      chartData,
      formattedMeasurement,
    );

    const showAt = (x: number, y: number) => tooltip.show(tooltipData, x, y);

    if (isTouchDevice) {
      element.addEventListener('touchstart', (e: Event) => {
        const te = e as TouchEvent;
        te.preventDefault();
        if (activeTouch === element) {
          // Re-tap same element: dismiss
          tooltip.hide();
          activeTouch = null;
        } else {
          activeTouch = element;
          const touch = te.touches[0];
          const rect = container.getBoundingClientRect();
          showAt(touch.clientX - rect.left, touch.clientY - rect.top);
        }
      }, { signal });
    }
    element.addEventListener('mouseenter', (e: Event) => {
      hoveredElement = element;
      cancelScheduledHide();
      const me = e as MouseEvent;
      const rect = container.getBoundingClientRect();
      showAt(me.clientX - rect.left, me.clientY - rect.top);
    }, { signal });
    element.addEventListener('mouseleave', () => {
      if (hoveredElement === element) {
        hoveredElement = null;
      }
      scheduleHide();
    }, { signal });

    // Focus/blur for keyboard navigation
    element.addEventListener('focus', (e: Event) => {
      element.classList.add('jsc-keyboard-focus');
      renderFocusIndicator(container, element);
      const fe = e as FocusEvent;
      const rect = container.getBoundingClientRect();
      const targetRect = (fe.target as SVGElement).getBoundingClientRect();
      showAt(
        targetRect.left + targetRect.width / 2 - rect.left,
        targetRect.top - rect.top
      );
    }, { signal });
    element.addEventListener('blur', () => {
      element.classList.remove('jsc-keyboard-focus');
      removeFocusIndicator(container);
      tooltip.hide();
    }, { signal });
  }

  // Dismiss touch tooltip on touchstart elsewhere in container
  if (isTouchDevice) {
    container.addEventListener('touchstart', (e: Event) => {
      const te = e as TouchEvent;
      if (activeTouch !== null && !elements.some(info => info.element === te.target)) {
        tooltip.hide();
        activeTouch = null;
      }
    }, { signal });
  }

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (
      e.key === 'Escape'
      && (hoveredElement !== null || tooltipHovered || container.contains(document.activeElement))
    ) {
      tooltip.hide();
    }
  }, { signal });

  // Group elements by series for keyboard navigator. Points are sorted (not
  // indexed) by pointIndex so gaps left by filtered-out values (e.g. null
  // segments) never leave sparse array holes for the navigator to dereference.
  const bySeriesIndex = new Map<number, FocusableElement[]>();
  for (const info of elements) {
    const seriesIndex = info.navigationGroupIndex ?? info.seriesIndex;
    const pointIndex = info.navigationPointIndex ?? info.pointIndex;
    const pointKey = info.navigationPointKey ?? info.pointKey;
    const { element } = info;
    const series = bySeriesIndex.get(seriesIndex) ?? [];
    series.push({ element, seriesIndex, pointIndex, pointKey });
    bySeriesIndex.set(seriesIndex, series);
  }
  const compactGrouped = Array.from(bySeriesIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([, series]) => {
      series.sort((a, b) => a.pointIndex - b.pointIndex);
      return series;
    });

  keyboard.setElements(compactGrouped);
  keyboard.attach();

  const activeElement = document.activeElement;
  if (activeElement instanceof Element && elements.some(info => info.element === activeElement)) {
    activeElement.classList.add('jsc-keyboard-focus');
    renderFocusIndicator(container, activeElement as SVGElement);
  }

  return {
    tooltip,
    keyboard,
    destroy() {
      cancelScheduledHide();
      removeFocusIndicator(container);
      for (const info of elements) {
        info.element.classList.remove('jsc-keyboard-focus');
      }
      controller.abort();
      tooltip.destroy();
      keyboard.destroy();
    },
  };
}
