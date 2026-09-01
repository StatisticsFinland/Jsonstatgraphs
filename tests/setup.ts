class MockResizeObserver implements ResizeObserver {
  disconnect(): void { return undefined; }
  observe(): void { return undefined; }
  unobserve(): void { return undefined; }
}

globalThis.ResizeObserver = MockResizeObserver;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn().mockReturnValue(false),
  })),
});

if (typeof requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => window.setTimeout(
    () => callback(performance.now()),
    0,
  );
  globalThis.cancelAnimationFrame = (handle: number): void => window.clearTimeout(handle);
}