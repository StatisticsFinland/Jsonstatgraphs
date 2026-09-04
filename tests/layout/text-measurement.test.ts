import { select } from 'd3-selection';
import { createSvgTextMeasurement, wrapMeasuredText } from '../../src/layout/text-measurement';

describe('wrapMeasuredText', () => {
  it('wraps words and preserves overlong tokens without truncation', () => {
    const measureText = (text: string): number => text.length * 10;

    expect(wrapMeasuredText('long words here', 60, measureText)).toEqual(['long', 'words', 'here']);
    expect(wrapMeasuredText('abcdefgh', 30, measureText)).toEqual(['abc', 'def', 'gh']);
  });
});

describe('createSvgTextMeasurement', () => {
  it('includes computed letter and word spacing in fallback widths', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
    const style = document.createElement('style');
    style.textContent = '.jsc-axis-x text { letter-spacing: 2px; word-spacing: 3px; line-height: 24px; }';
    document.head.appendChild(style);

    const measurement = createSvgTextMeasurement(select(svg), {
      parentClass: 'jsc-axis-x',
      fontFamily: 'sans-serif',
      fontSize: '12px',
      fallbackCharWidth: 8,
      fallbackLineHeight: 16,
    });

    expect(measurement.measureText('a b')).toBe(31);
    expect(measurement.lineHeight).toBe(24);

    measurement.destroy();
    style.remove();
    svg.remove();
  });

  it('resolves unitless line height against the computed font size', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
    const style = document.createElement('style');
    style.textContent = '.jsc-axis-y text { line-height: 1.5; }';
    document.head.appendChild(style);

    const measurement = createSvgTextMeasurement(select(svg), {
      parentClass: 'jsc-axis-y',
      fontFamily: 'sans-serif',
      fontSize: '12px',
    });

    expect(measurement.lineHeight).toBe(18);

    measurement.destroy();
    style.remove();
    svg.remove();
  });
});