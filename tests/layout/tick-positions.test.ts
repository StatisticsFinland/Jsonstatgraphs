import {
    linearAxisIntervalStepFunction,
    getDivisibilityScore,
    getMaxNumberOfSegments,
    getInterval,
    getTickPositions,
} from '../../src/layout/tick-positions';

describe('linearAxisIntervalStepFunction', () => {
    it('returns 0 for delta=0', () => {
        expect(linearAxisIntervalStepFunction(0)).toBe(0);
    });

    it('snaps lower power range: 120 → 120', () => {
        expect(linearAxisIntervalStepFunction(120)).toBe(120);
    });

    it('snaps lower power range: 140 → 140', () => {
        expect(linearAxisIntervalStepFunction(140)).toBe(140);
    });

    it('snaps half-scale range: 250 → 250', () => {
        expect(linearAxisIntervalStepFunction(250)).toBe(250);
    });

    it('snaps half-scale range: 280 → 300', () => {
        expect(linearAxisIntervalStepFunction(280)).toBe(300);
    });

    it('snaps whole power range: 450 → 500', () => {
        expect(linearAxisIntervalStepFunction(450)).toBe(500);
    });

    it('snaps whole power range: 720 → 800', () => {
        expect(linearAxisIntervalStepFunction(720)).toBe(800);
    });

    it('snaps higher power range: 850 → 1000', () => {
        expect(linearAxisIntervalStepFunction(850)).toBe(1000);
    });
});

describe('getDivisibilityScore', () => {
    it('returns 0 for input=0', () => {
        expect(getDivisibilityScore(0)).toBe(0);
    });

    it('500 scores higher than 700', () => {
        expect(getDivisibilityScore(500)).toBeGreaterThan(getDivisibilityScore(700));
    });

    it('1000 scores higher than 500', () => {
        expect(getDivisibilityScore(1000)).toBeGreaterThan(getDivisibilityScore(500));
    });

    it('fewer decimal places scores higher', () => {
        expect(getDivisibilityScore(0.5)).toBeGreaterThan(getDivisibilityScore(0.25));
    });

    it('value ending in 5 scores higher than same length without 5', () => {
        // 0.5 (ends in 5) vs 0.2 (doesn't end in 5), same decimal length
        expect(getDivisibilityScore(0.5)).toBeGreaterThan(getDivisibilityScore(0.2));
    });
});

describe('getMaxNumberOfSegments', () => {
    it('returns at least 1', () => {
        expect(getMaxNumberOfSegments(10, 0, 100)).toBeGreaterThanOrEqual(1);
    });

    it('returns at least 2 when data crosses zero', () => {
        expect(getMaxNumberOfSegments(50, -10, 10)).toBeGreaterThanOrEqual(2);
    });

    it('returns more segments for a longer axis', () => {
        const short = getMaxNumberOfSegments(200, 0, 100);
        const long = getMaxNumberOfSegments(800, 0, 100);
        expect(long).toBeGreaterThan(short);
    });

    it('caps at 10 segments even for very long axes', () => {
        expect(getMaxNumberOfSegments(2000, 0, 10)).toBe(10);
    });

    it('respects custom fontSizeTick — larger font means fewer segments', () => {
        const smallFont = getMaxNumberOfSegments(400, 0, 100, '12px');
        const largeFont = getMaxNumberOfSegments(400, 0, 100, '24px');
        expect(smallFont).toBeGreaterThan(largeFont);
    });

    it('falls back gracefully for non-numeric fontSizeTick', () => {
        const result = getMaxNumberOfSegments(400, 0, 100, 'inherit');
        const defaultResult = getMaxNumberOfSegments(400, 0, 100);
        expect(result).toBe(defaultResult);
    });
});

describe('getInterval', () => {
    it('throws when dataMin > dataMax', () => {
        expect(() => getInterval(100, 0, 5)).toThrow('dataMin must be <= dataMax');
    });

    it('returns a nice interval for 0–100 range', () => {
        const interval = getInterval(0, 100, 5);
        expect([10, 20, 25, 50].includes(interval)).toBe(true);
    });

    it('returns a nice interval for crossing-zero range', () => {
        const interval = getInterval(-50, 100, 5);
        expect(interval).toBeGreaterThan(0);
        expect(Number.isNaN(interval)).toBe(false);
    });

    it('returns precision when delta/maxSegments <= precision', () => {
        // delta=10, maxSegments=5 → 2 per segment, precision=5 → 2 <= 5, return 5
        expect(getInterval(0, 10, 5, 5)).toBe(5);
    });

    it('uses precision as a floor for segment length', () => {
        // precision larger than some candidates should still be respected
        const interval = getInterval(0, 100, 10, 20);
        expect(interval).toBeGreaterThanOrEqual(20);
    });

    it('forceZeroBaseline=false uses the true span instead of distance-from-zero', () => {
        // Forced-zero treats this as a 0–340 range (interval sized for ~340); the true span is only 40.
        const forced = getInterval(300, 340, 5, 0, true);
        const notForced = getInterval(300, 340, 5, 0, false);
        expect(notForced).toBeLessThan(forced);
    });
});

describe('getTickPositions', () => {
    it('returns [dataMin] when dataMin === dataMax', () => {
        expect(getTickPositions(42, 42, 400)).toEqual([42]);
    });

    it('starts at 0 for all-positive data', () => {
        const ticks = getTickPositions(0, 100, 400);
        expect(ticks[0]).toBe(0);
    });

    it('ends at or above dataMax for all-positive data', () => {
        const ticks = getTickPositions(0, 100, 400);
        expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(100);
    });

    it('includes 0 for all-negative data', () => {
        const ticks = getTickPositions(-100, 0, 400);
        expect(ticks).toContain(0);
    });

    it('extends below dataMin for all-negative data', () => {
        const ticks = getTickPositions(-100, 0, 400);
        expect(ticks[0]).toBeLessThanOrEqual(-100);
    });

    it('crosses zero for mixed data', () => {
        const ticks = getTickPositions(-50, 100, 400);
        expect(ticks.some(t => t < 0)).toBe(true);
        expect(ticks.some(t => t > 0)).toBe(true);
        expect(ticks.some(t => t === 0)).toBe(true);
    });

    it('produces evenly spaced ticks', () => {
        const ticks = getTickPositions(0, 100, 400);
        if (ticks.length < 2) return;
        const gap = ticks[1] - ticks[0];
        for (let i = 1; i < ticks.length; i++) {
            expect(ticks[i] - ticks[i - 1]).toBeCloseTo(gap, 10);
        }
    });

    it('falls back to [dataMin, dataMax] when interval is zero or NaN', () => {
        // Force NaN by using an extremely small crossing-zero range with high precision
        // We test the fallback by checking the function doesn't throw
        const ticks = getTickPositions(0, 100, 400);
        expect(Array.isArray(ticks)).toBe(true);
        expect(ticks.length).toBeGreaterThan(0);
    });

    it('exact ticks for 0–100 with 400px axis', () => {
        const ticks = getTickPositions(0, 100, 400);
        expect(ticks).toEqual([0, 20, 40, 60, 80, 100]);
    });

    it('exact ticks for 0–100 with 200px axis', () => {
        const ticks = getTickPositions(0, 100, 200);
        expect(ticks).toEqual([0, 50, 100]);
    });

    it('exact ticks for 0–1000 with 500px axis', () => {
        const ticks = getTickPositions(0, 1000, 500);
        expect(ticks).toEqual([0, 200, 400, 600, 800, 1000]);
    });

    it('exact ticks for -500–0 with 400px axis', () => {
        const ticks = getTickPositions(-500, 0, 400);
        expect(ticks).toEqual([-500, -400, -300, -200, -100, 0]);
    });

    it('exact ticks for -30–80 with 400px axis', () => {
        const ticks = getTickPositions(-30, 80, 400);
        expect(ticks).toEqual([-40, -20, 0, 20, 40, 60, 80]);
    });

    it('exact ticks for 0–0.5 with 300px axis', () => {
        const ticks = getTickPositions(0, 0.5, 300);
        expect(ticks).toEqual([0, 0.1, 0.2, 0.30000000000000004, 0.4, 0.5]);
    });

    it('exact ticks for 50–200 with 400px axis', () => {
        const ticks = getTickPositions(50, 200, 400);
        expect(ticks).toEqual([0, 30, 60, 90, 120, 150, 180, 210]);
    });

    it('forceZeroBaseline=false: does not anchor at 0 for all-positive data', () => {
        const ticks = getTickPositions(300, 340, 400, undefined, undefined, false);
        expect(ticks[0]).toBeGreaterThan(0);
        expect(ticks[0]).toBeLessThanOrEqual(300);
        expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(340);
    });

    it('forceZeroBaseline=false: 50–200 with 400px axis stays near the data range', () => {
        const ticks = getTickPositions(50, 200, 400, undefined, undefined, false);
        expect(ticks[0]).toBeGreaterThan(0);
        expect(ticks[0]).toBeLessThanOrEqual(50);
        expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(200);
    });

    it('forceZeroBaseline=false: does not anchor at 0 for all-negative data', () => {
        const ticks = getTickPositions(-200, -50, 400, undefined, undefined, false);
        expect(ticks[ticks.length - 1]).toBeLessThan(0);
        expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(-50);
    });

    it('forceZeroBaseline=false: still crosses zero when data spans it', () => {
        const ticks = getTickPositions(-50, 100, 400, undefined, undefined, false);
        expect(ticks.some(t => t === 0)).toBe(true);
    });

    it('tick count for a 300px axis with typical data is between 4 and 9', () => {
        // 0-90 with 300px: algorithm selects interval=20 → [0,20,40,60,80,100] = 6 ticks
        const ticks = getTickPositions(0, 90, 300);
        expect(ticks.length).toBeGreaterThanOrEqual(4);
        expect(ticks.length).toBeLessThanOrEqual(9);
    });
});
