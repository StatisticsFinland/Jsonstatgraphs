import { KeyboardNavigator, FocusableElement } from '../../src/interaction/keyboard';

function createMockElements(seriesCount: number, pointCount: number): FocusableElement[][] {
  const elements: FocusableElement[][] = [];
  for (let s = 0; s < seriesCount; s++) {
    const series: FocusableElement[] = [];
    for (let p = 0; p < pointCount; p++) {
      const el = document.createElement('div');
      document.body.appendChild(el);
      series.push({ element: el, seriesIndex: s, pointIndex: p });
    }
    elements.push(series);
  }
  return elements;
}

function createVariableMockElements(pointCounts: number[]): FocusableElement[][] {
  return pointCounts.map((count, s) => {
    const series: FocusableElement[] = [];
    for (let p = 0; p < count; p++) {
      const el = document.createElement('div');
      document.body.appendChild(el);
      series.push({ element: el, seriesIndex: s, pointIndex: p });
    }
    return series;
  });
}

function removeElements(elements: FocusableElement[][]): void {
  for (const series of elements) {
    for (const item of series) {
      item.element.remove();
    }
  }
}

describe('KeyboardNavigator', () => {
  let container: HTMLDivElement;
  let navigator: KeyboardNavigator;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    navigator.destroy();
    container.remove();
  });

  it('sets first element tabindex to 0, rest to -1', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(2, 3);
    navigator.setElements(elements);

    expect(elements[0][0].element.getAttribute('tabindex')).toBe('0');
    expect(elements[0][1].element.getAttribute('tabindex')).toBe('-1');
    expect(elements[0][2].element.getAttribute('tabindex')).toBe('-1');
    expect(elements[1][0].element.getAttribute('tabindex')).toBe('-1');
    expect(elements[1][1].element.getAttribute('tabindex')).toBe('-1');

    removeElements(elements);
  });

  it('ArrowRight moves to next point in series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    const spy = jest.spyOn(elements[0][1].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('ArrowLeft moves to previous point', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    // Move to point 1 first
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    const spy = jest.spyOn(elements[0][0].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('ArrowRight wraps around at end of series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    // Navigate to last point (index 2)
    elements[0][2].element.dispatchEvent(new Event('focus'));

    const spy = jest.spyOn(elements[0][0].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('ArrowLeft wraps around at start of series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    // currentPoint starts at 0
    const spy = jest.spyOn(elements[0][2].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('ArrowUp moves to previous series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(3, 2);
    navigator.setElements(elements);
    navigator.attach();

    // Move to series 1
    elements[1][0].element.dispatchEvent(new Event('focus'));

    const spy = jest.spyOn(elements[0][0].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('ArrowDown moves to next series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(3, 2);
    navigator.setElements(elements);
    navigator.attach();

    // currentSeries starts at 0
    const spy = jest.spyOn(elements[1][0].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('ArrowUp wraps from first series to last', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(3, 2);
    navigator.setElements(elements);
    navigator.attach();

    // currentSeries starts at 0 — ArrowUp wraps to last (series 2)
    const spy = jest.spyOn(elements[2][0].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('ArrowDown wraps from last series to first', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(3, 2);
    navigator.setElements(elements);
    navigator.attach();

    // Move to last series
    elements[2][0].element.dispatchEvent(new Event('focus'));

    const spy = jest.spyOn(elements[0][0].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('ArrowUp/Down clamps point index when target series is shorter', () => {
    navigator = new KeyboardNavigator(container);
    // Series 0: 5 points, Series 1: 3 points
    const elements = createVariableMockElements([5, 3]);
    navigator.setElements(elements);
    navigator.attach();

    // Navigate to series 0, point 4
    elements[0][4].element.dispatchEvent(new Event('focus'));

    // ArrowDown: target series 1 has 3 points, clamp to index 2
    const spy = jest.spyOn(elements[1][2].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('detach() removes keydown listener', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();
    navigator.detach();

    const spy = jest.spyOn(elements[0][1].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(spy).not.toHaveBeenCalled();

    removeElements(elements);
  });

  it('destroy() clears elements and detaches', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();
    navigator.destroy();

    const spy = jest.spyOn(elements[0][1].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    // After destroy, no navigation should occur (elements cleared + listener detached)
    expect(spy).not.toHaveBeenCalled();

    removeElements(elements);
  });

  it('roving tabindex: previous element gets tabindex -1, new gets 0', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    expect(elements[0][0].element.getAttribute('tabindex')).toBe('0');

    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(elements[0][0].element.getAttribute('tabindex')).toBe('-1');
    expect(elements[0][1].element.getAttribute('tabindex')).toBe('0');

    removeElements(elements);
  });

  it('Home key jumps to first point in current series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 4);
    navigator.setElements(elements);
    navigator.attach();

    // Navigate to point 2
    elements[0][2].element.dispatchEvent(new Event('focus'));

    const spy = jest.spyOn(elements[0][0].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));

    expect(spy).toHaveBeenCalled();
    expect(elements[0][0].element.getAttribute('tabindex')).toBe('0');

    removeElements(elements);
  });

  it('End key jumps to last point in current series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 4);
    navigator.setElements(elements);
    navigator.attach();

    const spy = jest.spyOn(elements[0][3].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));

    expect(spy).toHaveBeenCalled();
    expect(elements[0][3].element.getAttribute('tabindex')).toBe('0');

    removeElements(elements);
  });

  it('Escape key blurs the current element', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    const spy = jest.spyOn(elements[0][0].element as HTMLElement, 'blur');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('Escape key does not trigger navigation', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    const focusSpy = jest.spyOn(elements[0][1].element as HTMLElement, 'focus');
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(focusSpy).not.toHaveBeenCalled();

    removeElements(elements);
  });

  it('ignores keydown events originating inside burger menu', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    const menuRoot = document.createElement('div');
    menuRoot.className = 'jsc-burger-menu';
    const menuItem = document.createElement('li');
    menuItem.className = 'jsc-burger-menu-item';
    menuRoot.appendChild(menuItem);
    container.appendChild(menuRoot);

    const focusSpy = jest.spyOn(elements[0][1].element as HTMLElement, 'focus');
    menuItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(focusSpy).not.toHaveBeenCalled();

    menuRoot.remove();
    removeElements(elements);
  });
});
