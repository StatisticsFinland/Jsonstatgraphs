import type { Selection } from 'd3-selection';
import type { LabelTextMetrics } from './label-fitting';

export interface SvgTextMeasurement extends LabelTextMetrics {
  destroy(): void;
}

export interface SvgTextMeasurementOptions {
  parentClass: string;
  textClass?: string;
  fontFamily: string;
  fontSize: string;
  fallbackCharWidth?: number;
  fallbackLineHeight?: number;
  fontWeight?: string | number;
}

function splitLongToken(
  token: string,
  maxWidth: number,
  measureText: (text: string) => number,
): string[] {
  const parts: string[] = [];
  let remaining = token;
  while (remaining.length > 0) {
    let end = 1;
    while (end < remaining.length && measureText(remaining.slice(0, end + 1)) <= maxWidth) {
      end++;
    }
    parts.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  return parts;
}

export function wrapMeasuredText(
  text: string,
  maxWidth: number,
  measureText: (text: string) => number,
): string[] {
  if (measureText(text) <= maxWidth) return [text];
  const lines: string[] = [];
  let currentLine = '';
  for (const word of text.trim().split(/\s+/)) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (measureText(candidate) <= maxWidth) {
      currentLine = candidate;
      continue;
    }
    if (currentLine) lines.push(currentLine);
    if (measureText(word) <= maxWidth) {
      currentLine = word;
    } else {
      const parts = splitLongToken(word, maxWidth, measureText);
      lines.push(...parts.slice(0, -1));
      currentLine = parts.at(-1) ?? '';
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function resolveCssLength(value: string, fontSize: number): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  if (value.endsWith('rem')) {
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return parsed * rootFontSize;
  }
  if (value.endsWith('em')) return parsed * fontSize;
  return parsed;
}

function resolveLineHeight(value: string, fontSize: number): number {
  const resolved = resolveCssLength(value, fontSize);
  const trimmed = value.trim();
  const isUnitless = trimmed !== '' && Number.isFinite(Number(trimmed));
  return isUnitless ? resolved * fontSize : resolved;
}

export function createSvgTextMeasurement(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
  options: SvgTextMeasurementOptions,
): SvgTextMeasurement {
  const group = svg.append('g')
    .attr('class', options.parentClass)
    .attr('visibility', 'hidden')
    .attr('aria-hidden', 'true')
    .attr('pointer-events', 'none');
  const text = group.append('text')
    .attr('class', options.textClass ?? null)
    .attr('font-family', options.fontFamily)
    .attr('font-size', options.fontSize)
    .attr('font-weight', options.fontWeight ?? null);
  const node = text.node()!;
  const computed = getComputedStyle(node);
  const fontSize = Number.parseFloat(computed.fontSize)
    || Number.parseFloat(options.fontSize)
    || 12;
  const computedLineHeight = computed.lineHeight === 'normal'
    ? 0
    : resolveLineHeight(computed.lineHeight, fontSize);
  const lineHeight = computedLineHeight > 0
    ? computedLineHeight
    : (options.fallbackLineHeight ?? fontSize * 1.2);
  const letterSpacing = computed.letterSpacing === 'normal'
    ? 0
    : resolveCssLength(computed.letterSpacing, fontSize);
  const wordSpacing = computed.wordSpacing === 'normal'
    ? 0
    : resolveCssLength(computed.wordSpacing, fontSize);
  const fallbackCharWidth = options.fallbackCharWidth ?? fontSize * 0.6;

  return {
    lineHeight,
    measureText(value: string): number {
      node.textContent = value;
      try {
        const measured = node.getComputedTextLength();
        if (measured > 0) return measured;
      } catch {
        // Fall through to deterministic measurement for non-rendering DOMs.
      }
      const spaces = value.match(/\s/g)?.length ?? 0;
      return value.length * fallbackCharWidth
        + Math.max(0, value.length - 1) * letterSpacing
        + spaces * wordSpacing;
    },
    destroy(): void {
      group.remove();
    },
  };
}