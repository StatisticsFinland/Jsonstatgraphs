import { fitLabels } from '../../src/layout/label-fitting';

describe('fitLabels', () => {
  // 1. Short labels that fit
  describe('short labels that fit within slot width', () => {
    it('returns single-line labels with no truncation and no skip', () => {
      const labels = ['Jan', 'Feb', 'Mar'];
      // slotWidth=40px, charWidth=8 → max label chars=5, all 3 chars fit
      const result = fitLabels(labels, 120, 40, 8);
      expect(result.skipInterval).toBe(1);
      expect(result.maxLineCount).toBe(1);
      expect(result.zoneSizeNeeded).toBe(16);
      result.labels.forEach(fl => {
        expect(fl.lines).toHaveLength(1);
        expect(fl.truncated).toBe(false);
        expect(fl.skip).toBe(false);
      });
      expect(result.labels.map(fl => fl.lines[0])).toEqual(['Jan', 'Feb', 'Mar']);
    });
  });

  // 2. Long labels → wrapping at spaces
  describe('long labels that need wrapping', () => {
    it('wraps at space boundaries', () => {
      const labels = ['Hello World'];
      // charWidth=8, slotWidth=48 (6 chars) → "Hello World"=88px doesn't fit; "Hello"=40px fits, "World"=40px fits
      const result = fitLabels(labels, 48, 48, 8);
      expect(result.labels[0].lines).toEqual(['Hello', 'World']);
      expect(result.labels[0].truncated).toBe(false);
      expect(result.maxLineCount).toBe(2);
      expect(result.zoneSizeNeeded).toBe(32);
    });

    it('wraps multi-word label greedily', () => {
      const labels = ['one two three four'];
      // charWidth=8, slotWidth=80 (10 chars) → "one two" = 7 chars=56px fits; "three" would make 13 chars=104 → new line; "three four"=10 chars=80px fits
      const result = fitLabels(labels, 80, 80, 8);
      expect(result.labels[0].lines[0]).toBe('one two');
      expect(result.labels[0].lines[1]).toBe('three four');
      expect(result.labels[0].truncated).toBe(false);
    });
  });

  // 3. Very long words → truncation with "…"
  describe('labels with very long words', () => {
    it('truncates a word that exceeds slot width', () => {
      const labels = ['Abcdefghijklmnop'];
      // charWidth=8, slotWidth=64 (8 chars) → 16 chars=128px doesn't fit; single word → truncated
      const result = fitLabels(labels, 64, 64, 8);
      expect(result.labels[0].truncated).toBe(true);
      expect(result.labels[0].lines[0]).toMatch(/…$/);
      // Must fit: line length * 8 <= 64
      expect(result.labels[0].lines[0].length * 8).toBeLessThanOrEqual(64);
    });

    it('labels with no spaces get truncated immediately', () => {
      const labels = ['VeryLongWordWithoutSpaces'];
      const result = fitLabels(labels, 80, 80, 8);
      // 24 chars * 8 = 192 > 80 → truncated
      expect(result.labels[0].truncated).toBe(true);
      expect(result.labels[0].lines[0]).toMatch(/…$/);
    });
  });

  // 4. Mix of short and long labels
  describe('mix of short and long labels', () => {
    it('wraps only labels that need it', () => {
      const labels = ['OK', 'A very long label here'];
      // charWidth=8, slotWidth=64 → "OK"=16px fits; "A very long label here"=176px doesn't
      const result = fitLabels(labels, 128, 64, 8);
      expect(result.labels[0].lines).toHaveLength(1);
      expect(result.labels[0].truncated).toBe(false);
      expect(result.labels[1].lines.length).toBeGreaterThan(1);
    });
  });

  // 5. Max 3 lines wrapping
  describe('max 3 lines constraint', () => {
    it('uses at most 3 lines regardless of word count', () => {
      const label = 'one two three four five six seven eight';
      // charWidth=8, slotWidth=32 (4 chars) → very narrow, many words
      const result = fitLabels([label], 32, 32, 8);
      expect(result.labels[0].lines.length).toBeLessThanOrEqual(3);
      expect(result.maxLineCount).toBeLessThanOrEqual(3);
    });
  });

  // 6. Skip interval
  describe('skip interval when too many labels for available width', () => {
    it('skips labels when they fit only without a readable gap', () => {
      const labels = ['2019', '2020', '2021', '2022', '2023'];
      const result = fitLabels(labels, 305, 61, 8, undefined, {
        lineHeight: 29,
        measureText: () => 59,
      });

      expect(result.skipInterval).toBe(2);
      expect(result.labels.filter(label => !label.skip).map(label => label.original)).toEqual([
        '2019',
        '2021',
        '2023',
      ]);
    });

    it('sets skipInterval=2 and marks odd-indexed labels as skip when many labels', () => {
      // 10 labels "ABCD" (4 chars, 32px) with slotWidth=30 → truncated to "AB…" (3 chars, 24px)
      // totalEffectiveWidth = 10 * 24 = 240 > 150
      // N=1: 10*30=300>150; N=2: ceil(10/2)=5*30=150<=150 → skipInterval=2
      const labels = Array.from({ length: 10 }, () => 'ABCD');
      const result = fitLabels(labels, 150, 30, 8);
      expect(result.skipInterval).toBeGreaterThan(1);
      // Labels at index % skipInterval !== 0 should have skip=true
      result.labels.forEach((fl, i) => {
        if (i % result.skipInterval !== 0) {
          expect(fl.skip).toBe(true);
        } else {
          expect(fl.skip).toBe(false);
        }
      });
    });

    it('skipInterval=1 when all labels fit total available width', () => {
      const labels = ['A', 'B', 'C'];
      // charWidth=8, each label=1 char=8px; slotWidth=80; availableWidth=240 → total=24px <= 240
      const result = fitLabels(labels, 240, 80, 8);
      expect(result.skipInterval).toBe(1);
      result.labels.forEach(fl => expect(fl.skip).toBe(false));
    });
  });

  // 7. Empty labels array
  describe('empty labels array', () => {
    it('returns empty result with zeros', () => {
      const result = fitLabels([], 400, 100, 8);
      expect(result.labels).toEqual([]);
      expect(result.maxLineCount).toBe(0);
      expect(result.skipInterval).toBe(1);
      expect(result.zoneSizeNeeded).toBe(0);
    });
  });

  // 8. Single label
  describe('single label', () => {
    it('handles a single short label', () => {
      const result = fitLabels(['Hello'], 200, 200, 8);
      expect(result.labels).toHaveLength(1);
      expect(result.labels[0].lines).toEqual(['Hello']);
      expect(result.labels[0].skip).toBe(false);
      expect(result.skipInterval).toBe(1);
    });

    it('handles a single label that needs wrapping', () => {
      const result = fitLabels(['Hello World'], 80, 80, 8);
      // "Hello World"=88px > 80px; "Hello"=40px, "World"=40px
      expect(result.labels[0].lines).toEqual(['Hello', 'World']);
      expect(result.labels[0].skip).toBe(false);
    });
  });

  // 9. Labels with no spaces get truncated
  describe('labels with no spaces', () => {
    it('truncates with ellipsis when no wrap point is available', () => {
      const labels = ['ABCDEFGHIJKLMNOP'];
      // charWidth=8, slotWidth=40 (5 chars max) → truncated
      const result = fitLabels(labels, 40, 40, 8);
      expect(result.labels[0].truncated).toBe(true);
      expect(result.labels[0].lines).toHaveLength(1);
      expect(result.labels[0].lines[0]).toMatch(/…$/);
    });
  });

  // Zone size
  describe('zoneSizeNeeded', () => {
    it('is 16 for single-line labels', () => {
      const result = fitLabels(['A', 'B'], 200, 100, 8);
      expect(result.zoneSizeNeeded).toBe(16);
    });

    it('is 32 for two-line labels', () => {
      const result = fitLabels(['Hello World'], 48, 48, 8);
      expect(result.zoneSizeNeeded).toBe(32);
    });

    it('is 48 for three-line labels', () => {
      // Force 3 lines: 3-word label with narrow slot
      // charWidth=8, slotWidth=32 (4 chars): "ab cd ef" → "ab"(16)+"cd"(16)+"ef"(16)
      const result = fitLabels(['ab cd ef'], 32, 32, 8);
      expect(result.maxLineCount).toBe(3);
      expect(result.zoneSizeNeeded).toBe(48);
    });

    it('uses supplied text metrics for wrapping and line height', () => {
      const result = fitLabels(['wide words'], 70, 70, 8, undefined, {
        measureText: text => text.length * 8 + Math.max(0, text.length - 1) * 2,
        lineHeight: 24,
      });

      expect(result.labels[0].lines).toEqual(['wide', 'words']);
      expect(result.zoneSizeNeeded).toBe(48);
    });
  });
});

describe('fitLabels with niceSkipOptions', () => {
  it('uses nice intervals instead of brute-force', () => {
    // 20 short labels, narrow width that can fit ~4 labels
    const labels = Array.from({ length: 20 }, (_, i) => `${1990 + i}`);
    const result = fitLabels(labels, 160, 40, 8, {
      intervals: [1, 2, 5, 10, 25],
      firstAbsoluteIndex: 1990,
    });
    // skip=5 should work: 4 visible labels (1990, 1995, 2000, 2005)
    expect(result.skipInterval).toBe(5);
    expect(result.labels.filter(l => !l.skip).map(l => l.original)).toEqual([
      '1990', '1995', '2000', '2005',
    ]);
  });

  it('aligns to round boundaries', () => {
    // Years 1987-2006 (20 labels), narrow width that fits ~2 labels
    const labels = Array.from({ length: 20 }, (_, i) => `${1987 + i}`);
    const result = fitLabels(labels, 80, 40, 8, {
      intervals: [1, 2, 5, 10, 25],
      firstAbsoluteIndex: 1987,
    });
    // skip=10 should work: 2 visible labels (1990, 2000)
    expect(result.skipInterval).toBe(10);
    const visible = result.labels.filter(l => !l.skip).map(l => l.original);
    expect(visible).toEqual(['1990', '2000']);
  });

  it('falls back to first and last when no nice interval fits', () => {
    const labels = Array.from({ length: 100 }, (_, i) => `${1900 + i}`);
    const result = fitLabels(labels, 80, 40, 8, {
      intervals: [1, 2, 5], // max interval too small
      firstAbsoluteIndex: 1900,
    });
    const visible = result.labels.filter(l => !l.skip).map(l => l.original);
    expect(visible).toEqual(['1900', '1999']);
  });

  it('preserves original behavior when niceSkipOptions is not provided', () => {
    const labels = Array.from({ length: 20 }, (_, i) => `L${i}`);
    const result = fitLabels(labels, 80, 20, 8);
    // Original brute-force: skip=5, showing indices 0, 5, 10, 15
    expect(result.skipInterval).toBe(5);
    expect(result.labels[0].skip).toBe(false);
    expect(result.labels[1].skip).toBe(true);
    expect(result.labels[5].skip).toBe(false);
  });

  it('does not skip when all labels fit', () => {
    const labels = ['2020', '2021', '2022'];
    const result = fitLabels(labels, 300, 100, 8, {
      intervals: [1, 2, 5, 10],
      firstAbsoluteIndex: 2020,
    });
    expect(result.skipInterval).toBe(1);
    expect(result.labels.every(l => !l.skip)).toBe(true);
  });

  it('skips intervals with zero aligned hits and falls back', () => {
    // Years 1991-1994 (4 labels), very narrow (room for 1 label)
    // interval=5 has no aligned years (none divisible by 5)
    // Should fall back to first+last
    const labels = ['1991', '1992', '1993', '1994'];
    const result = fitLabels(labels, 40, 40, 8, {
      intervals: [1, 2, 5, 10],
      firstAbsoluteIndex: 1991,
    });
    const visible = result.labels.filter(l => !l.skip).map(l => l.original);
    // interval=2 should work: 1992 and 1994 are aligned (divisible by 2)
    // or if 2 doesn't fit, falls back to first+last
    expect(visible.length).toBeGreaterThanOrEqual(1);
    // No empty axis
    expect(visible).not.toHaveLength(0);
  });
});

describe('fitLabels long time series culling', () => {
  it('50-year time series with nice intervals shows readable labels, not ellipsis', () => {
    const labels = Array.from({ length: 50 }, (_, i) => String(1970 + i));
    const availableWidth = 600;
    const labelSlotWidth = 600 / 49;
    const charWidth = 8;
    const niceSkipOptions = { intervals: [1, 2, 5, 10, 25, 50, 100], firstAbsoluteIndex: 1970 };

    const result = fitLabels(labels, availableWidth, labelSlotWidth, charWidth, niceSkipOptions);

    expect(result.skipInterval).toBeGreaterThanOrEqual(5);

    const visibleLabels = result.labels.filter(l => !l.skip);
    visibleLabels.forEach(fl => {
      fl.lines.forEach(line => {
        expect(line).not.toBe('…');
      });
      expect(fl.truncated).toBe(false);
    });

    visibleLabels.forEach(fl => {
      const year = parseInt(fl.original, 10);
      expect(year % result.skipInterval).toBe(0);
    });
  });

  it('100-year time series in narrow container falls back to first+last', () => {
    const labels = Array.from({ length: 100 }, (_, i) => String(1900 + i));
    const availableWidth = 80;
    const labelSlotWidth = 80 / 99;
    const charWidth = 8;
    const niceSkipOptions = { intervals: [1, 2, 5], firstAbsoluteIndex: 1900 };

    const result = fitLabels(labels, availableWidth, labelSlotWidth, charWidth, niceSkipOptions);

    const visibleLabels = result.labels.filter(l => !l.skip);
    expect(visibleLabels).toHaveLength(2);
    expect(visibleLabels[0].original).toBe('1900');
    expect(visibleLabels[1].original).toBe('1999');

    visibleLabels.forEach(fl => {
      fl.lines.forEach(line => {
        expect(line).not.toBe('…');
      });
    });
  });

  it('brute-force skip with small slot width produces readable visible labels', () => {
    const labels = Array.from({ length: 40 }, (_, i) => `Cat${i}`);
    const availableWidth = 400;
    const labelSlotWidth = 400 / 40;
    const charWidth = 8;

    const result = fitLabels(labels, availableWidth, labelSlotWidth, charWidth);

    expect(result.skipInterval).toBeGreaterThan(1);

    const visibleLabels = result.labels.filter(l => !l.skip);
    visibleLabels.forEach(fl => {
      fl.lines.forEach(line => {
        expect(line).not.toBe('…');
      });
      expect(fl.truncated).toBe(false);
    });

    const maxVisibleLabelPx = Math.max(...visibleLabels.map(fl => fl.original.length * charWidth));
    expect(result.skipInterval * labelSlotWidth).toBeGreaterThanOrEqual(maxVisibleLabelPx);
  });

  it('wrappable labels are not over-culled', () => {
    // Multi-word labels that wrap cleanly should NOT trigger culling
    const labels = ['Hello World', 'Foo Bar', 'Test Case'];
    // charWidth=8, slotWidth=48: "Hello"=40px fits, "World"=40px fits → wraps to 2 lines, no truncation
    const result = fitLabels(labels, 144, 48, 8);
    expect(result.skipInterval).toBe(1);
    expect(result.labels.every(l => !l.skip)).toBe(true);
    // Labels should be wrapped, not truncated
    expect(result.labels[0].lines).toEqual(['Hello', 'World']);
    expect(result.labels[0].truncated).toBe(false);
  });
});
