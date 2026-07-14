import { ResolvedTheme } from '../types';
import { getSeriesColor } from '../theme/palette';

export interface LegendItem {
  name: string;
  index: number;
  active: boolean;
}

export type LegendToggleCallback = (index: number, active: boolean) => void;

export class Legend {
  private readonly container: HTMLElement;
  private readonly element: HTMLDivElement;
  private readonly items: LegendItem[];
  private readonly theme: ResolvedTheme;
  private onToggle: LegendToggleCallback | null = null;

  constructor(container: HTMLElement, seriesNames: string[], theme: ResolvedTheme) {
    this.container = container;
    this.theme = theme;
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

    if (!document.querySelector('#jsc-legend-styles')) {
      const style = document.createElement('style');
      style.id = 'jsc-legend-styles';
      style.textContent = `.jsc-legend-item:focus-visible { outline: 2px solid var(--jsc-color-focus-ring, #0066cc); outline-offset: 2px; } .jsc-legend-item:focus:not(:focus-visible) { outline: none; }`;
      document.head.appendChild(style);
    }
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
    while (el.firstChild) {
      el.firstChild.remove();
    }

    for (const item of this.items) {
      const btn = document.createElement('button');
      btn.className = 'jsc-legend-item';
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
      btn.setAttribute('aria-label', `Toggle series ${item.name}`);

      const swatch = document.createElement('span');
      swatch.style.display = 'inline-block';
      swatch.style.width = '12px';
      swatch.style.height = '12px';
      swatch.style.background = getSeriesColor(this.theme, item.index);
      swatch.style.borderRadius = '2px';
      swatch.style.marginRight = '4px';
      swatch.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.textContent = item.name;
      label.style.textDecoration = item.active ? 'none' : 'line-through';

      btn.appendChild(swatch);
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        item.active = !item.active;
        const activeIndex = item.index;
        this.render();
        const buttons = this.element.querySelectorAll('.jsc-legend-item');
        const targetBtn = buttons[activeIndex] as HTMLElement | undefined;
        targetBtn?.focus();
        if (this.onToggle) {
          this.onToggle(item.index, item.active);
        }
      });

      el.appendChild(btn);
    }
  }

  getHeight(): number {
    return this.element.offsetHeight;
  }

  destroy(): void {
    this.element.remove();
  }
}
