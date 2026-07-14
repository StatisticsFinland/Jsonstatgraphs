import { ResolvedTheme, ChartData } from '../types';
import { Tooltip, TooltipData } from '../interaction/tooltip';
import { KeyboardNavigator, FocusableElement } from '../interaction/keyboard';
import { applyDataPointAttributes } from '../a11y/aria';
import { createScreenReaderTable } from '../a11y/screen-reader';

export interface DataElementInfo {
  element: SVGElement;
  seriesIndex: number;
  pointIndex: number;
  category: string;
  seriesName: string;
  value: number | null;
  formattedValue: string;
  dimensionLabels?: { label: string; value: string }[];
  hideValueLine?: boolean;
}

export interface BindInteractionsConfig {
  container: HTMLElement;
  elements: DataElementInfo[];
  theme: ResolvedTheme;
  locale?: string;
  chartData?: ChartData;
  ariaLabel?: string;
  caption?: string;
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
    '.jsc-chart .jsc-marker:focus-visible,',
    '.jsc-chart .jsc-bar:focus-visible,',
    '.jsc-chart .jsc-slice:focus-visible,',
    '.jsc-chart .jsc-scatter-point:focus-visible,',
    'svg.jsc-chart [tabindex]:focus-visible {',
    '  outline: 2px solid var(--jsc-color-focus-ring, #0066cc);',
    '  outline-offset: 2px;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}

function buildTooltipData(
  info: { category: string; seriesName: string; value: number | null; formattedValue: string; dimensionLabels?: { label: string; value: string }[]; hideValueLine?: boolean },
  chartData?: ChartData,
): TooltipData {
  if (info.dimensionLabels && info.dimensionLabels.length > 0) {
    return {
      category: info.category,
      series: info.seriesName,
      value: info.value,
      formattedValue: info.formattedValue,
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
    formattedValue: info.formattedValue,
    dimensionLabels: dimensionLabels.length > 0 ? dimensionLabels : undefined,
  };
}

export function bindInteractions(config: BindInteractionsConfig): BoundInteractions {
  ensureFocusStyles();
  const { container, elements, theme, locale, chartData, caption } = config;

  const tooltip = new Tooltip(container, theme);
  const keyboard = new KeyboardNavigator(container);

  // AbortController lets us remove all listeners in one shot on destroy()
  const controller = new AbortController();
  const { signal } = controller;

  const isTouchDevice = 'ontouchstart' in globalThis;
  let activeTouch: SVGElement | null = null;

  for (const info of elements) {
    const { element, seriesName, category, value, formattedValue } = info;

    // ARIA attributes
    applyDataPointAttributes(element, `${seriesName}: ${category}`, formattedValue);

    // Tooltip data shared across handlers
    const { dimensionLabels, hideValueLine } = info;
    const tooltipData = buildTooltipData(
      { category, seriesName, value, formattedValue, dimensionLabels, hideValueLine },
      chartData,
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
    } else {
      element.addEventListener('mouseenter', (e: Event) => {
        const me = e as MouseEvent;
        const rect = container.getBoundingClientRect();
        showAt(me.clientX - rect.left, me.clientY - rect.top);
      }, { signal });
      element.addEventListener('mouseleave', () => tooltip.hide(), { signal });
    }

    // Focus/blur for keyboard navigation
    element.addEventListener('focus', (e: Event) => {
      const fe = e as FocusEvent;
      const rect = container.getBoundingClientRect();
      const targetRect = (fe.target as SVGElement).getBoundingClientRect();
      showAt(
        targetRect.left + targetRect.width / 2 - rect.left,
        targetRect.top - rect.top
      );
    }, { signal });
    element.addEventListener('blur', () => tooltip.hide(), { signal });
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

  // Group elements by series for keyboard navigator
  const grouped: FocusableElement[][] = [];
  for (const info of elements) {
    const { element, seriesIndex, pointIndex } = info;
    if (!grouped[seriesIndex]) {
      grouped[seriesIndex] = [];
    }
    grouped[seriesIndex][pointIndex] = { element, seriesIndex, pointIndex };
  }
  const compactGrouped = grouped.filter(Boolean);

  keyboard.setElements(compactGrouped);
  keyboard.attach();

  // Screen reader table
  let srTable: HTMLTableElement | null = null;
  if (chartData) {
    srTable = createScreenReaderTable(container, chartData, caption, locale);
  }

  return {
    tooltip,
    keyboard,
    destroy() {
      controller.abort();
      tooltip.destroy();
      keyboard.destroy();
      srTable?.remove();
    },
  };
}
