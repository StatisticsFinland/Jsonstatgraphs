import { ResolvedTheme } from '../types';

export interface TooltipData {
  category: string;
  series: string;
  value: number | null;
  formattedValue: string;
  dimensionLabels?: { label: string; value: string }[];
  hideValueLine?: boolean;
}

export class Tooltip {
  private static idCounter = 0;
  private readonly element: HTMLDivElement;
  private readonly container: HTMLElement;
  private visible: boolean = false;

  constructor(container: HTMLElement, theme: ResolvedTheme) {
    this.container = container;

    // Ensure container is a positioning context
    const containerPosition = getComputedStyle(container).position;
    if (containerPosition === 'static') {
      container.style.position = 'relative';
    }

    const el = document.createElement('div');
    el.className = 'jsc-tooltip';
    el.setAttribute('role', 'tooltip');
    el.id = `jsc-tooltip-${++Tooltip.idCounter}`;
    el.setAttribute('aria-live', 'polite');
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.15s';
    el.style.background = theme.colorSurface;
    el.style.color = theme.colorText;
    el.style.border = `1px solid ${theme.colorBorder}`;
    el.style.borderRadius = theme.borderRadius;
    el.style.fontFamily = theme.fontFamily;
    el.style.fontSize = theme.fontSizeLabel;
    el.style.padding = theme.tooltipPadding;
    el.style.boxShadow = theme.tooltipBoxShadow;
    el.setAttribute('aria-hidden', 'true');

    container.appendChild(el);
    this.element = el;
  }

  show(data: TooltipData, x: number, y: number): void {
    // Build content using DOM methods to prevent XSS
    const el = this.element;
    el.removeAttribute('aria-hidden');
    while (el.firstChild) {
      el.firstChild.remove();
    }

    if (data.dimensionLabels && data.dimensionLabels.length > 0) {
      for (const entry of data.dimensionLabels) {
        const div = document.createElement('div');
        div.textContent = `${entry.label}: ${entry.value}`;
        el.appendChild(div);
      }
      if (!data.hideValueLine) {
        const valueDiv = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = data.value === null ? '\u2013' : data.formattedValue;
        valueDiv.appendChild(strong);
        el.appendChild(valueDiv);
      }
    } else {
      const strong = document.createElement('strong');
      strong.textContent = data.series;
      el.appendChild(strong);

      el.appendChild(document.createElement('br'));

      const label = document.createTextNode(
        `${data.category}: ${data.value === null ? '\u2013' : data.formattedValue}`
      );
      el.appendChild(label);
    }

    // Initial position with 10px offset
    el.style.left = `${x + 10}px`;
    el.style.top = `${y + 10}px`;
    el.style.opacity = '1';
    this.visible = true;

    // Clamp to container boundaries after element is visible so dimensions are known
    const containerWidth = this.container.offsetWidth;
    const containerHeight = this.container.offsetHeight;
    const tooltipWidth = el.offsetWidth;
    const tooltipHeight = el.offsetHeight;

    let left = x + 10;
    let top = y + 10;

    if (left + tooltipWidth > containerWidth) {
      left = x - tooltipWidth - 10;
    }
    if (top + tooltipHeight > containerHeight) {
      top = y - tooltipHeight - 10;
    }

    left = Math.max(0, Math.min(left, containerWidth - tooltipWidth));
    top = Math.max(0, Math.min(top, containerHeight - tooltipHeight));

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  hide(): void {
    this.element.style.opacity = '0';
    this.visible = false;
    this.element.setAttribute('aria-hidden', 'true');
    while (this.element.firstChild) {
      this.element.firstChild.remove();
    }
  }

  getId(): string {
    return this.element.id;
  }

  destroy(): void {
    this.element.remove();
  }
}
