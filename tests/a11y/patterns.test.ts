import { select } from 'd3-selection';
import { DEFAULT_THEME } from '../../src/theme/defaults';
import {
  PATTERN_DEFINITIONS,
  PATTERN_PATHS,
  MARKER_SHAPES,
  getMarkerPath,
  getPatternFillUrl,
  injectPatternDefs,
} from '../../src/a11y/patterns';

describe('a11y patterns utilities', () => {
  it('exposes expected pattern and marker library sizes', () => {
    expect(PATTERN_DEFINITIONS.length).toBe(15);
    expect(PATTERN_PATHS.length).toBe(15);
    expect(MARKER_SHAPES.length).toBe(5);
  });

  it('keeps pattern path list aligned with named pattern definitions', () => {
    expect(PATTERN_PATHS).toEqual(PATTERN_DEFINITIONS.map(pattern => pattern.path));
  });

  it('returns pattern fill url by index', () => {
    expect(getPatternFillUrl(3)).toBe('url(#jsc-pattern-3)');
  });

  it('injects requested number of patterns into defs', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);

    const defsSel = select(defs);
    injectPatternDefs(defsSel, DEFAULT_THEME, 4);

    const patterns = defs.querySelectorAll('pattern[id^="jsc-pattern-"]');
    expect(patterns.length).toBe(4);
    expect(patterns[0].getAttribute('width')).toBe('10');
    expect(patterns[0].getAttribute('height')).toBe('10');
    expect(patterns[0].querySelector('rect')).not.toBeNull();
    expect(patterns[0].querySelector('path')).not.toBeNull();
  });

  it('replaces existing generated patterns on reinjection', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);

    const defsSel = select(defs);
    injectPatternDefs(defsSel, DEFAULT_THEME, 6);
    injectPatternDefs(defsSel, DEFAULT_THEME, 2);

    const patterns = defs.querySelectorAll('pattern[id^="jsc-pattern-"]');
    expect(patterns.length).toBe(2);
  });

  it('creates marker paths for all supported shape indices', () => {
    const paths = [0, 1, 2, 3, 4].map(i => getMarkerPath(i, 10, 10, 4));
    for (const d of paths) {
      expect(typeof d).toBe('string');
      expect(d.length).toBeGreaterThan(0);
      expect(d.startsWith('M ')).toBe(true);
    }
  });

  it('cycles marker shapes by index', () => {
    const first = getMarkerPath(0, 10, 10, 4);
    const cycled = getMarkerPath(5, 10, 10, 4);
    expect(cycled).toBe(first);
  });
});
