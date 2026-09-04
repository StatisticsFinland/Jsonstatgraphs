import { scaleBand, scaleLinear, scalePoint } from 'd3-scale';
import {
  buildCategoricalScales,
  getCategoricalValuePadding,
  isCategoricalValueAxisZeroForced,
  isNumericValueAxisZeroForced,
  padNumericRange,
  padValueRange,
} from '../../src/layout/axis-ranges';
import { ZoneRect } from '../../src/types';

const plotArea: ZoneRect = { x: 10, y: 20, width: 300, height: 200 };

describe('axis range policy', () => {
  it('pads away from zero for categorical value axes', () => {
    expect(padValueRange(0, 100)).toEqual([0, 105]);
    expect(padValueRange(-50, 100)).toEqual([-57.5, 107.5]);
    expect(padValueRange(-100, -50)).toEqual([-102.5, -50]);
  });

  it('pads numeric ranges symmetrically and expands flat ranges', () => {
    expect(padNumericRange(10, 20)).toEqual([9.5, 20.5]);
    expect(padNumericRange(42, 42)).toEqual([41, 43]);
  });

  it('keeps percent ranges and applies cut-axis policy', () => {
    expect(getCategoricalValuePadding('verticalBar', {}, 0, 100, true)).toEqual([0, 100]);
    expect(isCategoricalValueAxisZeroForced('line', { cutValueAxis: true })).toBe(false);
    expect(isCategoricalValueAxisZeroForced('verticalBar', { cutValueAxis: true })).toBe(true);
    expect(isNumericValueAxisZeroForced({})).toBe(true);
    expect(isNumericValueAxisZeroForced({ cutValueAxis: true })).toBe(false);
  });
});

describe('buildCategoricalScales', () => {
  const theme = {
    fontSizeTick: '12px',
  } as Parameters<typeof buildCategoricalScales>[1];

  it('uses a point scale for line charts and band scales otherwise', () => {
    const lineScales = buildCategoricalScales('line', theme, false, ['A', 'B'], 0, 10, plotArea, undefined, 'point');
    const barScales = buildCategoricalScales('verticalBar', theme, false, ['A', 'B'], 0, 10, plotArea);
    expect(lineScales.xScale).toEqual(expect.any(Function));
    expect((lineScales.xScale as unknown as ReturnType<typeof scalePoint>).padding()).toBe(0);
    expect((barScales.xScale as unknown as ReturnType<typeof scaleBand>).padding()).toBe(0.2);
  });

  it('uses the plot dimensions for numeric scale ranges', () => {
    const scales = buildCategoricalScales('horizontalBar', theme, true, ['A'], 0, 10, plotArea);
    expect((scales.xScale as unknown as ReturnType<typeof scaleLinear>).range()).toEqual([0, 300]);
    expect((scales.yScale as unknown as ReturnType<typeof scaleBand>).range()).toEqual([0, 200]);
  });
});