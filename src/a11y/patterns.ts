import type { Selection } from 'd3-selection';
import type { ResolvedTheme } from '../types';
import { getSeriesColor } from '../theme/palette';

export const PATTERN_PATHS: readonly string[] = [
  'M 0 5 L 10 5 M 5 0 L 5 10',
  'M 0 0 L 10 10 M 10 0 L 0 10',
  'M 2,2 h1 v1 h-1 z M 7,7 h1 v1 h-1 z M 2,7 h1 v1 h-1 z M 7,2 h1 v1 h-1 z',
  'M 2,2 h1 v1 h-1 z M 7,7 h1 v1 h-1 z',
  'M -2 -2 L 12 12 M -12 -2 L 2 12 M -2 -12 L 12 2',
  'M -2 12 L 12 -2 M -12 12 L 2 -2 M -2 22 L 12 8',
  'M 5,5 m -3,0 a 3,3 0 1,0 6,0 a 3,3 0 1,0 -6,0',
  'M 2 2 L 3 3 M 7 7 L 8 8 M 2 7 L 3 8 M 7 2 L 8 3',
  'M 5 0 L 10 5 L 5 10 L 0 5 Z',
  'M 2 5 L 8 5 M 5 2 L 5 8',
  'M 5 0 L 5 10',
  'M 0 5 L 10 5',
  'M 0 5 Q 2.5 0, 5 5 T 10 5',
  'M 0 2 L 10 2 M 0 8 L 10 8',
  'M 0 10 L 5 0 L 10 10 Z',
];

export const MARKER_SHAPES = ['circle', 'diamond', 'square', 'triangle-up', 'triangle-down'] as const;

export function getPatternFillUrl(index: number): string {
  return `url(#jsc-pattern-${index})`;
}

export function ensureDefs(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
): Selection<SVGDefsElement, unknown, null, undefined> {
  const defs = svg.select<SVGDefsElement>('defs');
  return defs.empty() ? svg.append<SVGDefsElement>('defs') : defs;
}

export function injectPatternDefs(
  svgDefs: Selection<SVGDefsElement, unknown, null, undefined>,
  theme: ResolvedTheme,
  count: number,
): void {
  svgDefs.selectAll('pattern[id^="jsc-pattern-"]').remove();

  for (let i = 0; i < count; i++) {
    const pattern = svgDefs
      .append('pattern')
      .attr('id', `jsc-pattern-${i}`)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 10)
      .attr('height', 10);

    pattern
      .append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('fill', getSeriesColor(theme, i));

    pattern
      .append('path')
      .attr('d', PATTERN_PATHS[i % PATTERN_PATHS.length])
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('fill', 'none');
  }
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy} m -${r},0 a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`;
}

export function getMarkerPath(shapeIndex: number, cx: number, cy: number, size = 4): string {
  const shape = MARKER_SHAPES[((shapeIndex % MARKER_SHAPES.length) + MARKER_SHAPES.length) % MARKER_SHAPES.length];

  switch (shape) {
    case 'circle':
      return circlePath(cx, cy, size);
    case 'diamond':
      return `M ${cx} ${cy - size} L ${cx + size} ${cy} L ${cx} ${cy + size} L ${cx - size} ${cy} Z`;
    case 'square': {
      const h = size * 0.9;
      return `M ${cx - h} ${cy - h} L ${cx + h} ${cy - h} L ${cx + h} ${cy + h} L ${cx - h} ${cy + h} Z`;
    }
    case 'triangle-up':
      return `M ${cx} ${cy - size} L ${cx + size} ${cy + size} L ${cx - size} ${cy + size} Z`;
    case 'triangle-down':
      return `M ${cx - size} ${cy - size} L ${cx + size} ${cy - size} L ${cx} ${cy + size} Z`;
  }
}
