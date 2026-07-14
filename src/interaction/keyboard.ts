export interface FocusableElement {
  element: SVGElement | HTMLElement;
  seriesIndex: number;
  pointIndex: number;
}

export class KeyboardNavigator {
  private elements: FocusableElement[][] = [];
  private currentSeries: number = 0;
  private currentPoint: number = 0;
  private handleKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setElements(elements: FocusableElement[][]): void {
    this.elements = elements;

    for (const series of elements) {
      for (const item of series) {
        item.element.setAttribute('tabindex', '-1');
      }
    }

    if (elements.length > 0 && elements[0].length > 0) {
      elements[0][0].element.setAttribute('tabindex', '0');
    }

    for (let s = 0; s < elements.length; s++) {
      for (let p = 0; p < elements[s].length; p++) {
        const item = elements[s][p];
        const seriesIdx = s;
        const pointIdx = p;
        item.element.addEventListener('focus', () => {
          this.currentSeries = seriesIdx;
          this.currentPoint = pointIdx;
        });
      }
    }
  }

  private navigate(key: string): { s: number; p: number } | null {
    const seriesCount = this.elements.length;
    if (seriesCount === 0) return null;

    let s = this.currentSeries;
    const p = this.currentPoint;

    if (key === 'ArrowRight') {
      const pointCount = this.elements[s].length;
      if (pointCount === 0) return null;
      return { s, p: (p + 1) % pointCount };
    }
    if (key === 'ArrowLeft') {
      const pointCount = this.elements[s].length;
      if (pointCount === 0) return null;
      return { s, p: (p - 1 + pointCount) % pointCount };
    }
    if (key === 'ArrowUp') {
      s = (s - 1 + seriesCount) % seriesCount;
      const pointCount = this.elements[s].length;
      if (pointCount === 0) return null;
      return { s, p: Math.min(p, pointCount - 1) };
    }
    if (key === 'ArrowDown') {
      s = (s + 1) % seriesCount;
      const pointCount = this.elements[s].length;
      if (pointCount === 0) return null;
      return { s, p: Math.min(p, pointCount - 1) };
    }
    if (key === 'Home') {
      return { s, p: 0 };
    }
    if (key === 'End') {
      const pointCount = this.elements[s].length;
      return pointCount === 0 ? null : { s, p: pointCount - 1 };
    }
    return null;
  }

  attach(): void {
    this.handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        const current = this.elements[this.currentSeries]?.[this.currentPoint];
        if (current) {
          (current.element as HTMLElement).blur();
        }
        return;
      }

      const result = this.navigate(e.key);
      if (result === null) return;

      e.preventDefault();

      const prev = this.elements[this.currentSeries]?.[this.currentPoint];
      if (prev) {
        prev.element.setAttribute('tabindex', '-1');
      }

      this.currentSeries = result.s;
      this.currentPoint = result.p;
      const target = this.elements[result.s][result.p];
      target.element.setAttribute('tabindex', '0');
      (target.element as HTMLElement).focus();
    };

    this.container.addEventListener('keydown', this.handleKeyDown);
  }

  detach(): void {
    if (this.handleKeyDown) {
      this.container.removeEventListener('keydown', this.handleKeyDown);
      this.handleKeyDown = null;
    }
  }

  destroy(): void {
    this.detach();
    this.elements = [];
  }
}
