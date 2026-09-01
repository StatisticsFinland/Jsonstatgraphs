import { KeyboardNavigator, FocusableElement, captureChartFocusBeforeRedraw } from '../../src/interaction/keyboard';

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

function dispatchKey(element: SVGElement | HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
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
    container.appendChild(elements[0][0].element);
    dispatchKey(elements[0][0].element, 'ArrowRight');

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('ArrowLeft moves to previous point', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    // Move to point 1 first
    container.append(...elements[0].map(item => item.element));
    dispatchKey(elements[0][0].element, 'ArrowRight');

    const spy = jest.spyOn(elements[0][0].element as HTMLElement, 'focus');
    dispatchKey(elements[0][1].element, 'ArrowLeft');

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('ArrowRight stops at the end of a series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    // Navigate to last point (index 2)
    elements[0][2].element.dispatchEvent(new Event('focus'));

    container.append(...elements[0].map(item => item.element));
    const spy = jest.spyOn(elements[0][0].element as HTMLElement, 'focus');
    const event = dispatchKey(elements[0][2].element, 'ArrowRight');

    expect(spy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);

    removeElements(elements);
  });

  it('ArrowLeft stops at the start of a series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    // currentPoint starts at 0
    container.append(...elements[0].map(item => item.element));
    const spy = jest.spyOn(elements[0][2].element as HTMLElement, 'focus');
    const event = dispatchKey(elements[0][0].element, 'ArrowLeft');

    expect(spy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);

    removeElements(elements);
  });

  it('ArrowUp moves to previous series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(3, 2);
    navigator.setElements(elements);
    navigator.attach();

    // Move to series 1
    container.append(...elements.flat().map(item => item.element));
    elements[1][0].element.dispatchEvent(new Event('focus'));

    const spy = jest.spyOn(elements[0][0].element as HTMLElement, 'focus');
    dispatchKey(elements[1][0].element, 'ArrowUp');

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('ArrowDown moves to next series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(3, 2);
    navigator.setElements(elements);
    navigator.attach();

    // currentSeries starts at 0
    container.append(...elements.flat().map(item => item.element));
    const spy = jest.spyOn(elements[1][0].element as HTMLElement, 'focus');
    dispatchKey(elements[0][0].element, 'ArrowDown');

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('ArrowUp stops at the first series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(3, 2);
    navigator.setElements(elements);
    navigator.attach();

    container.append(...elements.flat().map(item => item.element));
    const spy = jest.spyOn(elements[2][0].element as HTMLElement, 'focus');
    const event = dispatchKey(elements[0][0].element, 'ArrowUp');

    expect(spy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);

    removeElements(elements);
  });

  it('ArrowDown stops at the last series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(3, 2);
    navigator.setElements(elements);
    navigator.attach();

    // Move to last series
    container.append(...elements.flat().map(item => item.element));
    elements[2][0].element.dispatchEvent(new Event('focus'));

    const spy = jest.spyOn(elements[0][0].element as HTMLElement, 'focus');
    const event = dispatchKey(elements[2][0].element, 'ArrowDown');

    expect(spy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);

    removeElements(elements);
  });

  it('ArrowUp/Down clamps point index when target series is shorter', () => {
    navigator = new KeyboardNavigator(container);
    // Series 0: 5 points, Series 1: 3 points
    const elements = createVariableMockElements([5, 3]);
    navigator.setElements(elements);
    navigator.attach();

    // Navigate to series 0, point 4
    container.append(...elements.flat().map(item => item.element));
    elements[0][4].element.dispatchEvent(new Event('focus'));

    // ArrowDown: target series 1 has 3 points, clamp to index 2
    const spy = jest.spyOn(elements[1][2].element as HTMLElement, 'focus');
    dispatchKey(elements[0][4].element, 'ArrowDown');

    expect(spy).toHaveBeenCalled();

    removeElements(elements);
  });

  it('detach() removes keydown listener', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();
    navigator.detach();

    container.appendChild(elements[0][0].element);
    const spy = jest.spyOn(elements[0][1].element as HTMLElement, 'focus');
    dispatchKey(elements[0][0].element, 'ArrowRight');

    expect(spy).not.toHaveBeenCalled();

    removeElements(elements);
  });

  it('destroy() clears elements and detaches', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();
    navigator.destroy();

    container.appendChild(elements[0][0].element);
    const spy = jest.spyOn(elements[0][1].element as HTMLElement, 'focus');
    dispatchKey(elements[0][0].element, 'ArrowRight');

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

    container.append(...elements[0].map(item => item.element));
    dispatchKey(elements[0][0].element, 'ArrowRight');

    expect(elements[0][0].element.getAttribute('tabindex')).toBe('-1');
    expect(elements[0][1].element.getAttribute('tabindex')).toBe('0');

    removeElements(elements);
  });

  it('synchronizes roving tabindex when focus moves programmatically', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    container.append(...elements[0].map(item => item.element));

    elements[0][2].element.focus();

    expect(elements[0][0].element.getAttribute('tabindex')).toBe('-1');
    expect(elements[0][2].element.getAttribute('tabindex')).toBe('0');

    removeElements(elements);
  });

  it('uses Up and Down for points on a vertical category axis', () => {
    navigator = new KeyboardNavigator(container, 'vertical');
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();
    container.append(...elements[0].map(item => item.element));

    dispatchKey(elements[0][0].element, 'ArrowDown');
    expect(document.activeElement).toBe(elements[0][1].element);

    dispatchKey(elements[0][1].element, 'ArrowUp');
    expect(document.activeElement).toBe(elements[0][0].element);

    removeElements(elements);
  });

  it('does not handle arrows from unrelated descendants', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 2);
    navigator.setElements(elements);
    navigator.attach();
    container.append(...elements[0].map(item => item.element));
    const link = document.createElement('a');
    container.appendChild(link);
    const focusSpy = jest.spyOn(elements[0][1].element as HTMLElement, 'focus');

    const event = dispatchKey(link, 'ArrowRight');

    expect(event.defaultPrevented).toBe(false);
    expect(focusSpy).not.toHaveBeenCalled();

    removeElements(elements);
  });

  it('Home key jumps to first point in current series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 4);
    navigator.setElements(elements);
    navigator.attach();

    // Navigate to point 2
    container.append(...elements[0].map(item => item.element));
    elements[0][2].element.dispatchEvent(new Event('focus'));

    const spy = jest.spyOn(elements[0][0].element as HTMLElement, 'focus');
    dispatchKey(elements[0][2].element, 'Home');

    expect(spy).toHaveBeenCalled();
    expect(elements[0][0].element.getAttribute('tabindex')).toBe('0');

    removeElements(elements);
  });

  it('End key jumps to last point in current series', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 4);
    navigator.setElements(elements);
    navigator.attach();

    container.append(...elements[0].map(item => item.element));
    const spy = jest.spyOn(elements[0][3].element as HTMLElement, 'focus');
    dispatchKey(elements[0][0].element, 'End');

    expect(spy).toHaveBeenCalled();
    expect(elements[0][3].element.getAttribute('tabindex')).toBe('0');

    removeElements(elements);
  });

  it('Escape does not blur the current element', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    const spy = jest.spyOn(elements[0][0].element as HTMLElement, 'blur');
    container.appendChild(elements[0][0].element);
    dispatchKey(elements[0][0].element, 'Escape');

    expect(spy).not.toHaveBeenCalled();

    removeElements(elements);
  });

  it('Escape key does not trigger navigation', () => {
    navigator = new KeyboardNavigator(container);
    const elements = createMockElements(1, 3);
    navigator.setElements(elements);
    navigator.attach();

    const focusSpy = jest.spyOn(elements[0][1].element as HTMLElement, 'focus');
    container.appendChild(elements[0][0].element);
    dispatchKey(elements[0][0].element, 'Escape');

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

  it('restores focus by pointKey when the same datapoint shifts to a different positional index', () => {
    navigator = new KeyboardNavigator(container);
    const elements: FocusableElement[][] = [[
      { element: document.createElement('div'), seriesIndex: 0, pointIndex: 0, pointKey: 'jan' },
      { element: document.createElement('div'), seriesIndex: 0, pointIndex: 1, pointKey: 'feb' },
    ]];
    container.append(...elements[0].map(item => item.element));
    navigator.setElements(elements);
    navigator.attach();

    elements[0][1].element.focus();
    captureChartFocusBeforeRedraw(container);

    // Simulate a redraw where 'jan' became null and was filtered out, so 'feb'
    // is now at positional index 0 instead of 1.
    const nextElements: FocusableElement[][] = [[
      { element: document.createElement('div'), seriesIndex: 0, pointIndex: 0, pointKey: 'feb' },
    ]];
    container.append(...nextElements[0].map(item => item.element));
    navigator.setElements(nextElements);

    expect(document.activeElement).toBe(nextElements[0][0].element);

    removeElements(elements);
    removeElements(nextElements);
  });
});
