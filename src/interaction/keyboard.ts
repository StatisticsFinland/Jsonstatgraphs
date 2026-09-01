export interface FocusableElement {
  element: SVGElement | HTMLElement;
  seriesIndex: number;
  pointIndex: number;
  /** Stable identity (e.g. category code) that survives positional shifts across redraws. */
  pointKey?: string;
}

export type PointNavigationAxis = 'horizontal' | 'vertical';

interface StoredFocusState {
  seriesIndex: number;
  pointIndex: number;
  pointKey?: string;
  restoreFocus: boolean;
}

const focusStateByContainer = new WeakMap<HTMLElement, StoredFocusState>();

export function captureChartFocusBeforeRedraw(container: HTMLElement): void {
  const activeElement = document.activeElement;
  if (
    !(activeElement instanceof HTMLElement || activeElement instanceof SVGElement)
    || !container.contains(activeElement)
  ) return;

  const seriesIndex = Number(activeElement.dataset.jscSeriesIndex);
  const pointIndex = Number(activeElement.dataset.jscPointIndex);
  if (!Number.isInteger(seriesIndex) || !Number.isInteger(pointIndex)) return;

  focusStateByContainer.set(container, {
    seriesIndex,
    pointIndex,
    pointKey: activeElement.dataset.jscPointKey,
    restoreFocus: true,
  });
}

export class KeyboardNavigator {
  private elements: FocusableElement[][] = [];
  private currentSeries: number = 0;
  private currentPoint: number = 0;
  private handleKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private readonly focusHandlers = new Map<SVGElement | HTMLElement, () => void>();
  private readonly container: HTMLElement;
  private readonly pointAxis: PointNavigationAxis;
  private readonly nextPointKey: string;
  private readonly previousPointKey: string;
  private readonly nextSeriesKey: string;
  private readonly previousSeriesKey: string;

  constructor(container: HTMLElement, pointAxis: PointNavigationAxis = 'horizontal') {
    this.container = container;
    this.pointAxis = pointAxis;
    this.nextPointKey = pointAxis === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    this.previousPointKey = pointAxis === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    this.nextSeriesKey = pointAxis === 'horizontal' ? 'ArrowDown' : 'ArrowRight';
    this.previousSeriesKey = pointAxis === 'horizontal' ? 'ArrowUp' : 'ArrowLeft';
  }

  setElements(elements: FocusableElement[][]): void {
    this.removeFocusHandlers();
    this.elements = elements;
    this.assignDatasetIdentity(elements);

    const storedFocus = focusStateByContainer.get(this.container);
    const target = storedFocus ? this.resolveStoredFocusTarget(elements, storedFocus) : null;
    const initialSeries = target?.series ?? 0;
    const initialPoint = target?.point ?? 0;

    if (elements[initialSeries]?.[initialPoint]) {
      this.currentSeries = initialSeries;
      this.currentPoint = initialPoint;
      elements[initialSeries][initialPoint].element.setAttribute('tabindex', '0');
    }

    this.registerFocusHandlers(elements);

    if (storedFocus?.restoreFocus && elements[initialSeries]?.[initialPoint]) {
      focusStateByContainer.set(this.container, { ...storedFocus, restoreFocus: false });
      (elements[initialSeries][initialPoint].element as HTMLElement).focus();
    }
  }

  private assignDatasetIdentity(elements: FocusableElement[][]): void {
    for (const series of elements) {
      for (const item of series) {
        item.element.setAttribute('tabindex', '-1');
        item.element.dataset.jscSeriesIndex = String(item.seriesIndex);
        item.element.dataset.jscPointIndex = String(item.pointIndex);
        if (item.pointKey !== undefined) {
          item.element.dataset.jscPointKey = item.pointKey;
        } else {
          delete item.element.dataset.jscPointKey;
        }
      }
    }
  }

  private registerFocusHandlers(elements: FocusableElement[][]): void {
    for (let s = 0; s < elements.length; s++) {
      for (let p = 0; p < elements[s].length; p++) {
        const item = elements[s][p];
        const handleFocus = (): void => {
          this.currentSeries = s;
          this.currentPoint = p;
          this.updateTabStops(s, p);
          focusStateByContainer.set(this.container, {
            seriesIndex: item.seriesIndex,
            pointIndex: item.pointIndex,
            pointKey: item.pointKey,
            restoreFocus: false,
          });
        };
        this.focusHandlers.set(item.element, handleFocus);
        item.element.addEventListener('focus', handleFocus);
      }
    }
  }

  // Prefers the stable pointKey identity (survives category/null shifts across
  // redraws) and falls back to positional matching when no key is available.
  private resolveStoredFocusTarget(
    elements: FocusableElement[][],
    storedFocus: StoredFocusState,
  ): { series: number; point: number } | null {
    if (storedFocus.pointKey !== undefined) {
      const byKey = this.findByPointKey(elements, storedFocus.seriesIndex, storedFocus.pointKey);
      if (byKey) return byKey;
    }
    return this.resolveByPositionalIndex(elements, storedFocus);
  }

  private findByPointKey(
    elements: FocusableElement[][],
    seriesIndex: number,
    pointKey: string,
  ): { series: number; point: number } | null {
    for (let s = 0; s < elements.length; s++) {
      const point = elements[s].findIndex(item => item.pointKey === pointKey && item.seriesIndex === seriesIndex);
      if (point >= 0) return { series: s, point };
    }
    for (let s = 0; s < elements.length; s++) {
      const point = elements[s].findIndex(item => item.pointKey === pointKey);
      if (point >= 0) return { series: s, point };
    }
    return null;
  }

  private resolveByPositionalIndex(
    elements: FocusableElement[][],
    storedFocus: StoredFocusState,
  ): { series: number; point: number } | null {
    const matchedSeries = elements.findIndex(series => series.some(item =>
      item.seriesIndex === storedFocus.seriesIndex && item.pointIndex === storedFocus.pointIndex
    ));
    const seriesIndex = matchedSeries >= 0
      ? matchedSeries
      : elements.findIndex(series => series.some(item => item.seriesIndex === storedFocus.seriesIndex));
    if (seriesIndex < 0) return null;

    const series = elements[seriesIndex];
    const exactPoint = series.findIndex(item =>
      item.seriesIndex === storedFocus.seriesIndex && item.pointIndex === storedFocus.pointIndex
    );
    if (exactPoint >= 0) return { series: seriesIndex, point: exactPoint };

    const closestPoint = series.reduce((closestIndex, item, index) =>
      Math.abs(item.pointIndex - storedFocus.pointIndex)
        < Math.abs(series[closestIndex].pointIndex - storedFocus.pointIndex)
        ? index
        : closestIndex,
    0);
    return { series: seriesIndex, point: closestPoint };
  }

  private updateTabStops(activeSeries: number, activePoint: number): void {
    for (let seriesIndex = 0; seriesIndex < this.elements.length; seriesIndex++) {
      for (let pointIndex = 0; pointIndex < this.elements[seriesIndex].length; pointIndex++) {
        this.elements[seriesIndex][pointIndex].element.setAttribute(
          'tabindex',
          seriesIndex === activeSeries && pointIndex === activePoint ? '0' : '-1',
        );
      }
    }
  }

  private removeFocusHandlers(): void {
    for (const [element, handler] of this.focusHandlers) {
      element.removeEventListener('focus', handler);
    }
    this.focusHandlers.clear();
  }

  private navigate(key: string): { s: number; p: number } | null {
    if (this.elements.length === 0) return null;

    if (key === this.nextPointKey) return this.navigatePoint(1);
    if (key === this.previousPointKey) return this.navigatePoint(-1);
    if (key === this.previousSeriesKey) return this.navigateSeries(-1);
    if (key === this.nextSeriesKey) return this.navigateSeries(1);
    if (key === 'Home') return { s: this.currentSeries, p: 0 };
    if (key === 'End') return this.navigateToEnd();
    return null;
  }

  private navigatePoint(delta: 1 | -1): { s: number; p: number } | null {
    const pointCount = this.elements[this.currentSeries].length;
    if (pointCount === 0) return null;
    const nextPoint = this.currentPoint + delta;
    if (nextPoint < 0 || nextPoint >= pointCount) return null;
    return { s: this.currentSeries, p: nextPoint };
  }

  private navigateSeries(delta: 1 | -1): { s: number; p: number } | null {
    const nextSeries = this.currentSeries + delta;
    if (nextSeries < 0 || nextSeries >= this.elements.length) return null;
    const pointCount = this.elements[nextSeries].length;
    if (pointCount === 0) return null;
    return { s: nextSeries, p: Math.min(this.currentPoint, pointCount - 1) };
  }

  private navigateToEnd(): { s: number; p: number } | null {
    const pointCount = this.elements[this.currentSeries].length;
    return pointCount === 0 ? null : { s: this.currentSeries, p: pointCount - 1 };
  }

  attach(): void {
    this.handleKeyDown = (e: KeyboardEvent) => {
      const eventTarget = e.target;
      if (!(eventTarget instanceof Element) || !this.focusHandlers.has(eventTarget as SVGElement | HTMLElement)) {
        return;
      }

      const navigationKeys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (!navigationKeys.includes(e.key)) return;

      e.preventDefault();
      const result = this.navigate(e.key);
      if (result === null) return;

      this.currentSeries = result.s;
      this.currentPoint = result.p;
      const target = this.elements[result.s][result.p];
      this.updateTabStops(result.s, result.p);
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
    this.removeFocusHandlers();
    this.elements = [];
  }
}
