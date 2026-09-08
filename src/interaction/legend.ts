import { ChartType, ResolvedTheme } from '../types';
import { getSeriesColor } from '../theme/palette';
import { PATTERN_PATHS, getMarkerPath } from '../a11y/patterns';
import { getLocaleStrings } from '../locale/strings';

export interface LegendItem {
  name: string;
  index: number;
  active: boolean;
}

export type LegendToggleCallback = (index: number, active: boolean) => void;

export interface LegendOptions {
  accessibilityMode?: boolean;
  chartType?: ChartType;
  locale?: string;
}

let legendStyleRefCount = 0;

function isPatternChartType(chartType?: ChartType): boolean {
  return chartType === 'verticalBar'
    || chartType === 'horizontalBar'
    || chartType === 'groupedVerticalBar'
    || chartType === 'groupedHorizontalBar'
    || chartType === 'stackedVerticalBar'
    || chartType === 'stackedHorizontalBar'
    || chartType === 'percentVerticalBar'
    || chartType === 'percentHorizontalBar'
    || chartType === 'pie'
    || chartType === 'pyramid';
}

export class Legend {
  private readonly container: HTMLElement;
  private readonly element: HTMLDivElement;
  private readonly items: LegendItem[];
  private readonly theme: ResolvedTheme;
  private readonly options: LegendOptions;
  private onToggle: LegendToggleCallback | null = null;
  private activeIndex = 0;

  constructor(container: HTMLElement, seriesNames: string[], theme: ResolvedTheme, options?: LegendOptions) {
    this.container = container;
    this.theme = theme;
    this.options = options ?? {};
    this.items = seriesNames.map((name, index) => ({ name, index, active: true }));

    const el = document.createElement('div');
    el.className = 'jsc-legend';
    el.style.display = 'flex';
    el.style.flexWrap = 'wrap';
    el.style.justifyContent = 'center';
    el.style.gap = '8px 16px';
    el.style.padding = '4px 0';
    el.style.fontFamily = theme.fontFamily;
    el.style.fontSize = theme.fontSizeLabel;

    container.appendChild(el);
    this.element = el;

    if (legendStyleRefCount === 0) {
      const style = document.createElement('style');
      style.id = 'jsc-legend-styles';
      style.textContent = `.jsc-legend-item:focus-visible { outline: 2px solid var(--jsc-color-focus-ring, #0066cc); outline-offset: 2px; } .jsc-legend-item:focus:not(:focus-visible) { outline: none; }`;
      document.head.appendChild(style);
    }
    legendStyleRefCount++;
  }

  setToggleCallback(callback: LegendToggleCallback): void {
    this.onToggle = callback;
  }

  setItemStates(activeStates: boolean[]): void {
    for (let i = 0; i < this.items.length && i < activeStates.length; i++) {
      this.items[i].active = activeStates[i];
    }
    this.render();
  }

  render(): void {
    const el = this.element;
    const strings = getLocaleStrings(this.options.locale);
    const restoreFocus = document.activeElement instanceof HTMLElement && el.contains(document.activeElement);
    while (el.firstChild) {
      el.firstChild.remove();
    }

    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];
      const btn = document.createElement('button');
      btn.className = 'jsc-legend-item';
      btn.tabIndex = index === this.activeIndex ? 0 : -1;
      btn.style.background = 'none';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.style.padding = '2px 4px';
      btn.style.borderRadius = this.theme.borderRadius;
      btn.style.fontFamily = 'inherit';
      btn.style.fontSize = 'inherit';
      btn.style.color = this.theme.colorText;
      btn.style.opacity = item.active ? '1' : '0.4';
      btn.setAttribute('aria-pressed', String(item.active));
      btn.setAttribute('aria-label', `${item.name}, ${strings.toggleSeries}`);

      const swatch = document.createElement('span');
      swatch.className = 'jsc-legend-swatch';
      swatch.style.display = 'inline-block';
      swatch.style.width = '14px';
      swatch.style.height = '14px';
      swatch.style.background = getSeriesColor(this.theme, item.index);
      swatch.style.borderRadius = '2px';
      swatch.style.marginRight = '4px';
      swatch.setAttribute('aria-hidden', 'true');

      if (this.options.accessibilityMode) {
        if (this.options.chartType === 'line') {
          swatch.classList.add('jsc-legend-swatch--marker');
          swatch.style.background = 'transparent';
          swatch.style.display = 'inline-flex';
          swatch.style.alignItems = 'center';
          swatch.style.justifyContent = 'center';

          const markerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          markerSvg.setAttribute('viewBox', '0 0 14 14');
          markerSvg.setAttribute('width', '14');
          markerSvg.setAttribute('height', '14');

          const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          markerPath.setAttribute('d', getMarkerPath(item.index, 7, 7, 4));
          markerPath.setAttribute('fill', getSeriesColor(this.theme, item.index));
          markerPath.setAttribute('stroke', this.theme.colorSurface);
          markerPath.setAttribute('stroke-width', '1.5');
          markerSvg.appendChild(markerPath);
          swatch.appendChild(markerSvg);
        } else if (isPatternChartType(this.options.chartType)) {
          swatch.classList.add('jsc-legend-swatch--pattern');
          swatch.style.background = 'transparent';

          const patternSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          patternSvg.setAttribute('viewBox', '0 0 10 10');
          patternSvg.setAttribute('width', '14');
          patternSvg.setAttribute('height', '14');

          const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bgRect.setAttribute('x', '0');
          bgRect.setAttribute('y', '0');
          bgRect.setAttribute('width', '10');
          bgRect.setAttribute('height', '10');
          bgRect.setAttribute('fill', getSeriesColor(this.theme, item.index));
          patternSvg.appendChild(bgRect);

          const patternPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          patternPath.setAttribute('d', PATTERN_PATHS[item.index % PATTERN_PATHS.length]);
          patternPath.setAttribute('stroke', '#ffffff');
          patternPath.setAttribute('stroke-width', '1.5');
          patternPath.setAttribute('fill', 'none');
          patternSvg.appendChild(patternPath);

          swatch.appendChild(patternSvg);
        }
      }

      const label = document.createElement('span');
      label.textContent = item.name;
      label.style.textDecoration = item.active ? 'none' : 'line-through';

      btn.appendChild(swatch);
      btn.appendChild(label);

      btn.addEventListener('focus', () => {
        this.setActiveIndex(item.index, false);
      });

      btn.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (item.index + delta + this.items.length) % this.items.length;
        this.setActiveIndex(nextIndex, true);
      });

      btn.addEventListener('click', () => {
        item.active = !item.active;
        const activeIndex = item.index;
        this.render();
        this.setActiveIndex(activeIndex, true);
        if (this.onToggle) {
          this.onToggle(item.index, item.active);
        }
      });

      el.appendChild(btn);
    }

    if (restoreFocus) {
      this.setActiveIndex(this.activeIndex, true);
    }
  }

  private setActiveIndex(index: number, focus: boolean): void {
    if (this.items.length === 0) return;

    this.activeIndex = Math.max(0, Math.min(index, this.items.length - 1));
    const buttons = this.element.querySelectorAll('.jsc-legend-item');
    buttons.forEach((button, buttonIndex) => {
      (button as HTMLButtonElement).tabIndex = buttonIndex === this.activeIndex ? 0 : -1;
    });

    if (focus) {
      (buttons[this.activeIndex] as HTMLButtonElement | undefined)?.focus();
    }
  }

  getHeight(): number {
    return this.element.offsetHeight;
  }

  destroy(): void {
    legendStyleRefCount = Math.max(0, legendStyleRefCount - 1);
    if (legendStyleRefCount === 0) {
      document.getElementById('jsc-legend-styles')?.remove();
    }
    this.element.remove();
  }
}
