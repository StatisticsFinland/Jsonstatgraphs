const PIE_LABEL_MAX_CHARS = 20;
const PIE_CALLOUT_GAP = 16;
const PIE_CALLOUT_FIXED_WIDTH = 120;

export const PIE_CALLOUT_MIN_PLOT_WIDTH = 480;

export function truncatePieCalloutLabel(label: string): string {
  if (label.length <= PIE_LABEL_MAX_CHARS) return label;
  return `${label.slice(0, PIE_LABEL_MAX_CHARS - 3)}...`;
}

export function getPieCalloutMinimumWidth(
  labels: string[],
  measureText: (text: string) => number,
): number {
  const widestLabel = Math.max(
    0,
    ...labels.map(label => measureText(truncatePieCalloutLabel(label))),
  );
  return Math.max(
    PIE_CALLOUT_MIN_PLOT_WIDTH,
    widestLabel * 2 + PIE_CALLOUT_GAP * 2 + PIE_CALLOUT_FIXED_WIDTH,
  );
}

export const PIE_CALLOUT_LABEL_GAP = PIE_CALLOUT_GAP;