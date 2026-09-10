// Threshold when the lower power step function is used to determine segment length.
const LOWER_POWER_SCALE_THRESHOLD = 1.5;

// Threshold when the half-scale step function is used.
const HALF_SCALE_THRESHOLD = 3;

// Threshold when the higher power step function is used.
const HIGHER_POWER_SCALE_THRESHOLD = 8;

// Keep this portion of candidates when eliminating by divisibility score.
const SEGMENT_CANDIDATE_ELIMINATION_THRESHOLD = 0.5;

/**
 * Estimates how many tick labels can fit on the axis without overlapping.
 */
export function getMaxNumberOfSegments(axisLengthPx: number, dataMin: number, dataMax: number, fontSizeTick?: string): number {
    const parsedFontSize = parseFloat(fontSizeTick ?? '20px');
    const CHAR_WIDTH_ESTIMATE = Math.ceil((Number.isFinite(parsedFontSize) ? parsedFontSize : 20) * 0.6); // ~12px at default 20px
    const HARD_MARGIN_PX = 15;

    const largestAbsValue = Math.max(Math.abs(dataMin), Math.abs(dataMax));
    const largestSmallerPowerOf10 = Math.pow(10, Math.floor(Math.log10(largestAbsValue)));
    const labelCharCount = largestSmallerPowerOf10.toString().length + (dataMin < 0 ? 1 : 0);
    const max = Math.ceil(axisLengthPx / (labelCharCount * CHAR_WIDTH_ESTIMATE + HARD_MARGIN_PX) - 1);
    const clamped = Math.max(max, dataMin < 0 && dataMax > 0 ? 2 : 1);
    // Ensure reasonable bounds
    const withFloor = axisLengthPx > 200 ? Math.max(clamped, 2) : clamped;
    return Math.min(withFloor, 10);
}

/**
 * Snaps a raw segment delta to a "nice" value based on its order of magnitude.
 */
export function linearAxisIntervalStepFunction(segmentDelta: number): number {
    if (segmentDelta === 0) return 0;

    const pow10Step = Math.pow(10, Math.floor(Math.log10(segmentDelta)));
    const ratio = segmentDelta / pow10Step;

    if (ratio < LOWER_POWER_SCALE_THRESHOLD) {
        return Math.ceil(segmentDelta / (pow10Step / 10)) * (pow10Step / 10);
    }

    if (ratio < HALF_SCALE_THRESHOLD) {
        return Math.ceil(segmentDelta * 2 / pow10Step) * pow10Step / 2;
    }

    if (ratio < HIGHER_POWER_SCALE_THRESHOLD) {
        return Math.ceil(ratio) * pow10Step;
    }

    return Math.ceil(segmentDelta / (pow10Step * 10)) * 10 * pow10Step;
}

/**
 * Returns a score representing how "round" a number is.
 * Higher score = more divisible = preferred for axis ticks.
 */
export function getDivisibilityScore(input: number): number {
    if (input === 0) return 0;

    if (Number.isInteger(input)) {
        let score = 0;
        let divider = 5;
        while (score < 50) {
            if (input % divider !== 0) break;
            score++;
            divider *= 2;
            if (input % divider !== 0) break;
            score++;
            divider *= 5;
        }
        return score;
    }

    // Decimal scoring
    const text = input.toString();
    if (text.includes('e-')) {
        const parts = text.split('e-');
        const decimals = Number.parseInt(parts[1]);
        return parts[0].endsWith('5') ? -2 * decimals + 1 : -2 * decimals;
    }
    const decimalPart = text.split('.')[1];
    return decimalPart.endsWith('5') ? -2 * decimalPart.length + 1 : -2 * decimalPart.length;
}

/**
 * Given a data range and max number of segments, returns a "nice" interval length.
 *
 * `forceZeroBaseline` mirrors the axis's own zero-anchoring: when true (default), a
 * non-zero-spanning range is treated as if measured from 0 (matching the always-zero
 * Y axis used by bar charts and the default line/scatter axis). When false, the true
 * span (`dataMax - dataMin`) is used instead, for axes allowed to omit zero (`cutValueAxis`).
 */
export function getInterval(dataMin: number, dataMax: number, maxNumberOfSegments: number, precision: number = 0, forceZeroBaseline: boolean = true): number {
    if (dataMin > dataMax) throw new Error('dataMin must be <= dataMax');

    const spansZero = dataMin < 0 && dataMax > 0;
    let delta: number;
    if (spansZero || !forceZeroBaseline) {
        delta = dataMax - dataMin;
    } else {
        delta = Math.max(Math.abs(dataMin), Math.abs(dataMax));
    }

    if (delta / maxNumberOfSegments <= precision) return precision;

    const candidates: [number, number][] = [];
    for (let n = maxNumberOfSegments; n >= 1; n--) {
        const segmentLength = linearAxisIntervalStepFunction(delta / n);
        if (segmentLength >= precision) {
            candidates.push([getDivisibilityScore(segmentLength), segmentLength]);
        }
    }

    // Sort by score descending, keep top half (at least 2)
    candidates.sort(([scoreA], [scoreB]) => scoreB - scoreA);
    const keepCount = Math.max(2, Math.ceil(candidates.length * SEGMENT_CANDIDATE_ELIMINATION_THRESHOLD));
    const survivors = candidates.slice(0, keepCount);

    // Sort survivors by segment length ascending (shortest first)
    survivors.sort(([, lengthA], [, lengthB]) => lengthA - lengthB);

    if (dataMin < 0 && dataMax > 0) {
        const result = survivors.find(([, length]) =>
            Math.ceil(Math.abs(dataMin) / length) + Math.ceil(dataMax / length) <= maxNumberOfSegments
        );
        return result ? result[1] : Number.NaN;
    }

    return survivors[0][1];
}

/**
 * Main entry point. Returns evenly-spaced tick positions for the given data range and axis size.
 *
 * `forceZeroBaseline` (default true) anchors the lower/upper bound at 0 whenever the data doesn't
 * cross zero, matching the always-zero axis used by bar charts and the default line/scatter axis.
 * Pass false to let the axis start/end at a "nice" bound near the actual data range instead,
 * for axes allowed to omit zero (`cutValueAxis`).
 */
export function getTickPositions(dataMin: number, dataMax: number, axisLengthPx: number, precision?: number, fontSizeTick?: string, forceZeroBaseline: boolean = true): number[] {
    if (dataMin === dataMax) return [dataMin];

    const maxSegments = getMaxNumberOfSegments(axisLengthPx, dataMin, dataMax, fontSizeTick);
    const interval = getInterval(dataMin, dataMax, maxSegments, precision, forceZeroBaseline);

    if (!interval || Number.isNaN(interval)) return [dataMin, dataMax];

    const lowerBound = forceZeroBaseline && dataMin >= 0 ? 0 : Math.floor(dataMin / interval) * interval;
    const upperBound = forceZeroBaseline && dataMax <= 0 ? 0 : Math.ceil(dataMax / interval) * interval;

    const ticks: number[] = [];
    // Use a counter-based loop to avoid floating-point accumulation
    const count = Math.round((upperBound - lowerBound) / interval);
    for (let i = 0; i <= count; i++) {
        ticks.push(lowerBound + i * interval);
    }
    return ticks;
}
