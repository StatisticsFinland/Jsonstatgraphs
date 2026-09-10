const LINE_HEIGHT_PX = 16;
const DEFAULT_CHAR_WIDTH = 8;
const MAX_LINES = 3;
const MIN_LABEL_GAP_PX = 8;

export interface LabelTextMetrics {
  measureText(text: string): number;
  lineHeight: number;
}

export interface FittedLabel {
  original: string;
  lines: string[];
  truncated: boolean;
  skip: boolean;
}

export interface LabelFitResult {
  labels: FittedLabel[];
  maxLineCount: number;
  skipInterval: number;
  zoneSizeNeeded: number;
}

function truncateLine(
  text: string,
  slotWidth: number,
  measureText: (text: string) => number,
): { text: string; truncated: boolean } {
  const pixelWidth = measureText(text);
  if (pixelWidth <= slotWidth) {
    return { text, truncated: false };
  }
  const ellipsis = '…';
  let low = 0;
  let high = text.length;
  while (low < high) {
    const candidateLength = Math.ceil((low + high) / 2);
    if (measureText(text.slice(0, candidateLength) + ellipsis) <= slotWidth) {
      low = candidateLength;
    } else {
      high = candidateLength - 1;
    }
  }
  return { text: text.slice(0, low) + ellipsis, truncated: true };
}

export function truncateLabel(
  text: string,
  slotWidth: number,
  estimateCharWidth: number = DEFAULT_CHAR_WIDTH,
): { text: string; truncated: boolean } {
  return truncateLine(text, slotWidth, value => value.length * estimateCharWidth);
}

function wrapLabel(
  label: string,
  slotWidth: number,
  measureText: (text: string) => number,
): { lines: string[]; truncated: boolean } {
  const words = label.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  let truncated = false;

  for (const word of words) {
    const candidate = currentLine === '' ? word : currentLine + ' ' + word;
    if (measureText(candidate) <= slotWidth) {
      currentLine = candidate;
    } else if (currentLine !== '') {
      lines.push(currentLine);
      if (lines.length === MAX_LINES) {
        // No more room — stop
        currentLine = '';
        break;
      }
      currentLine = word;
    } else {
      // Single word too long — put it on its own line
      lines.push(word);
      if (lines.length === MAX_LINES) {
        currentLine = '';
        break;
      }
      currentLine = '';
    }
  }

  if (currentLine !== '' && lines.length < MAX_LINES) {
    lines.push(currentLine);
  }

  // Truncate any line that still overflows
  const result: string[] = [];
  for (const line of lines) {
    const { text, truncated: wasTruncated } = truncateLine(line, slotWidth, measureText);
    result.push(text);
    if (wasTruncated) truncated = true;
  }

  return { lines: result, truncated };
}

export interface NiceSkipOptions {
  intervals: number[];
  firstAbsoluteIndex: number;
}

export function fitLabels(
  labels: string[],
  availableWidth: number,
  labelSlotWidth: number,
  estimateCharWidth: number = DEFAULT_CHAR_WIDTH,
  niceSkipOptions?: NiceSkipOptions,
  textMetrics?: LabelTextMetrics,
): LabelFitResult {
  if (labels.length === 0) {
    return { labels: [], maxLineCount: 0, skipInterval: 1, zoneSizeNeeded: 0 };
  }

  // Step 1: Compute original label pixel widths
  const measureText = textMetrics?.measureText ?? ((text: string) => text.length * estimateCharWidth);
  const originalWidths = labels.map(measureText);
  const maxLabelPx = Math.max(...originalWidths);

  // Step 2: Wrap/truncate all labels at labelSlotWidth
  const initialWrapped = labels.map(l => wrapLabel(l, labelSlotWidth, measureText));

  // Step 3: Detect severe truncation — a label whose single line was truncated (can't wrap)
  const severeTruncation = initialWrapped.some(w => w.truncated && w.lines.length === 1);

  let skipInterval = 1;
  let fitted: FittedLabel[];

  if (severeTruncation) {
    // Step 4a: Severe truncation — compute skip interval from original widths,
    // then re-wrap visible labels at the wider effective slot so they read clearly.
    if (niceSkipOptions) {
      const { intervals, firstAbsoluteIndex } = niceSkipOptions;
      for (const n of intervals) {
        if (n <= 1) continue;
        if (n * labelSlotWidth < maxLabelPx) continue;
        let visibleWidthSum = 0;
        let visibleCount = 0;
        for (let i = 0; i < labels.length; i++) {
          if ((firstAbsoluteIndex + i) % n === 0) {
            visibleWidthSum += originalWidths[i];
            visibleCount++;
          }
        }
        if (visibleCount === 0) continue;
        if (visibleWidthSum + Math.max(0, visibleCount - 1) * MIN_LABEL_GAP_PX <= availableWidth) {
          skipInterval = n;
          break;
        }
      }
      if (skipInterval === 1 && labels.length > 1) {
        skipInterval = -1; // sentinel for first+last only
      }
    } else {
      for (let n = 2; n <= labels.length; n++) {
        if (n * labelSlotWidth < maxLabelPx) continue;
        let visibleWidthSum = 0;
        for (let i = 0; i < labels.length; i += n) {
          visibleWidthSum += originalWidths[i];
        }
        if (visibleWidthSum <= availableWidth) {
          skipInterval = n;
          break;
        }
      }
    }

    // Re-wrap at the effective slot so visible labels show readable text
    const effectiveSlotWidth =
      skipInterval > 1 ? skipInterval * labelSlotWidth :
      skipInterval === -1 ? availableWidth / 2 :
      labelSlotWidth;

    fitted = labels.map(l => {
      const { lines, truncated } = wrapLabel(l, effectiveSlotWidth, measureText);
      return { original: l, lines, truncated, skip: false };
    });
  } else {
    // Step 4b: No severe truncation — multi-word labels wrapped cleanly.
    // Use the already-wrapped labels; only cull if their total width still overflows.
    const totalEffectiveWidth = initialWrapped.reduce((sum, w) => {
      const maxLineWidth = Math.max(...w.lines.map(measureText));
      return sum + maxLineWidth;
    }, 0);

    if (totalEffectiveWidth + Math.max(0, labels.length - 1) * MIN_LABEL_GAP_PX > availableWidth) {
      if (niceSkipOptions) {
        const { intervals, firstAbsoluteIndex } = niceSkipOptions;
        for (const n of intervals) {
          if (n <= 1) continue;
          let visibleCount = 0;
          for (let i = 0; i < labels.length; i++) {
            if ((firstAbsoluteIndex + i) % n === 0) visibleCount++;
          }
          if (visibleCount === 0) continue;
          if (visibleCount * labelSlotWidth <= availableWidth) {
            skipInterval = n;
            break;
          }
        }
        if (skipInterval === 1 && labels.length > 1) {
          skipInterval = -1; // sentinel for first+last only
        }
      } else {
        for (let n = 2; n <= labels.length; n++) {
          let visibleCount = 0;
          for (let i = 0; i < labels.length; i += n) visibleCount++;
          if (visibleCount * labelSlotWidth <= availableWidth) {
            skipInterval = n;
            break;
          }
        }
      }
    }

    fitted = initialWrapped.map((w, i) => ({
      original: labels[i],
      lines: w.lines,
      truncated: w.truncated,
      skip: false,
    }));
  }

  // Step 5: Apply skip flags
  if (skipInterval === -1) {
    for (let i = 0; i < fitted.length; i++) {
      if (i !== 0 && i !== fitted.length - 1) {
        fitted[i] = { ...fitted[i], skip: true };
      }
    }
    skipInterval = fitted.length; // report effective interval
  } else if (skipInterval > 1) {
    if (niceSkipOptions) {
      const { firstAbsoluteIndex } = niceSkipOptions;
      for (let i = 0; i < fitted.length; i++) {
        if ((firstAbsoluteIndex + i) % skipInterval !== 0) {
          fitted[i] = { ...fitted[i], skip: true };
        }
      }
    } else {
      for (let i = 0; i < fitted.length; i++) {
        if (i % skipInterval !== 0) {
          fitted[i] = { ...fitted[i], skip: true };
        }
      }
    }
  }

  // Step 6: Compute maxLineCount and zoneSizeNeeded from the fitted labels
  const maxLineCount = Math.max(...fitted.map(f => f.lines.length));
  const zoneSizeNeeded = maxLineCount * (textMetrics?.lineHeight ?? LINE_HEIGHT_PX);

  return { labels: fitted, maxLineCount, skipInterval, zoneSizeNeeded };
}
