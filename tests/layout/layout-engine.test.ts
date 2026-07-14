import { computeLayout } from '../../src/layout/layout-engine';
import { createZones, CreateZonesOptions, PLOT_AREA_MIN_SIZE } from '../../src/layout/zones';
import { ZoneType } from '../../src/types';

// --- Helpers ---

function makeOptions(overrides: Partial<CreateZonesOptions> = {}): CreateZonesOptions {
  return {
    chartType: 'verticalBar',
    showHeader: true,
    showLegend: true,
    seriesCount: 2,
    ...overrides,
  };
}

// --- Tests ---

describe('computeLayout', () => {
  describe('basic layout with all zones visible', () => {
    const zones = createZones(makeOptions());
    const result = computeLayout(800, 600, zones);
    // Vertical zones: Header(40) + YAxisTitle(25) + XAxisLabels(40) + XAxisTitle(25) + Legend(30) + FooterText(20) = 180
    // PlotArea height = 600 - 180 = 420
    // YAxisLabels width = min(60, 800 - 100) = 60
    // PlotArea width = 800 - 60 = 740

    it('returns a zones map with all 8 entries', () => {
      expect(result.zones.size).toBe(8);
    });

    it('collapsed list contains only the invisible RightMargin zone (not visible for verticalBar)', () => {
      expect(result.collapsed).toHaveLength(1);
      expect(result.collapsed).toContain(ZoneType.RightMargin);
    });

    it('Header rect is correct', () => {
      expect(result.zones.get(ZoneType.Header)).toEqual({ x: 0, y: 0, width: 800, height: 40 });
    });

    it('YAxisTitle rect is correct', () => {
      expect(result.zones.get(ZoneType.YAxisTitle)).toEqual({ x: 0, y: 40, width: 800, height: 25 });
    });

    it('YAxisLabels rect is correct', () => {
      expect(result.zones.get(ZoneType.YAxisLabels)).toEqual({ x: 0, y: 65, width: 60, height: 420 });
    });

    it('PlotArea rect is correct', () => {
      expect(result.zones.get(ZoneType.PlotArea)).toEqual({ x: 60, y: 65, width: 740, height: 420 });
    });

    it('XAxisLabels rect is correct', () => {
      expect(result.zones.get(ZoneType.XAxisLabels)).toEqual({ x: 0, y: 485, width: 800, height: 40 });
    });

    it('XAxisTitle rect is correct', () => {
      expect(result.zones.get(ZoneType.XAxisTitle)).toEqual({ x: 0, y: 525, width: 800, height: 25 });
    });

    it('Legend rect is correct', () => {
      expect(result.zones.get(ZoneType.Legend)).toEqual({ x: 0, y: 550, width: 800, height: 30 });
    });

    it('FooterText rect is correct', () => {
      expect(result.zones.get(ZoneType.FooterText)).toEqual({ x: 0, y: 580, width: 800, height: 20 });
    });
  });

  describe('zones collapse in priority order when height is too small', () => {
    // Container 800x255: usedVertical=180, PlotArea=75 < 100
    // Collapse FooterText (priority 1, size 20) -> PlotArea=95 < 100
    // Collapse YAxisTitle (priority 2, size 25) -> PlotArea=120 >= 100
    const zones = createZones(makeOptions());
    const result = computeLayout(800, 255, zones);

    it('exactly three zones are collapsed (RightMargin invisible + FooterText + YAxisTitle)', () => {
      expect(result.collapsed).toHaveLength(3);
    });

    it('FooterText is collapsed (lowest priority, collapses first)', () => {
      expect(result.collapsed).toContain(ZoneType.FooterText);
    });

    it('one axis title is also collapsed', () => {
      const axisTitle = result.collapsed.find(t => t === ZoneType.YAxisTitle || t === ZoneType.XAxisTitle);
      expect(axisTitle).toBeDefined();
    });

    it('remaining zones are all in the result', () => {
      expect(result.zones.size).toBe(6);
    });

    it('PlotArea height meets the minimum after collapse', () => {
      expect(result.zones.get(ZoneType.PlotArea)!.height).toBeGreaterThanOrEqual(PLOT_AREA_MIN_SIZE);
    });

    it('Header is NOT collapsed and IS in the zones map', () => {
      expect(result.collapsed).not.toContain(ZoneType.Header);
      expect(result.zones.has(ZoneType.Header)).toBe(true);
    });
  });

  describe('Footer collapses first (lowest priority), then axis titles', () => {
    describe('at 800x255: FooterText and YAxisTitle collapse', () => {
      const zones = createZones(makeOptions());
      const result = computeLayout(800, 255, zones);

      it('exactly one axis title is collapsed (plus RightMargin invisible)', () => {
        expect(result.collapsed).toHaveLength(3);
        const axisTitle = result.collapsed.find(t => t === ZoneType.YAxisTitle || t === ZoneType.XAxisTitle);
        expect(axisTitle).toBeDefined();
      });

      it('FooterText is collapsed (priority 1, collapses before axis titles)', () => {
        expect(result.collapsed).toContain(ZoneType.FooterText);
      });

      it('Header is still present (priority 4 > axis title priority 2)', () => {
        expect(result.zones.has(ZoneType.Header)).toBe(true);
      });
    });

    describe('at 800x250: FooterText and YAxisTitle collapse, XAxisTitle survives', () => {
      // PlotArea = 250-180 = 70 < 100. Collapse FooterText(20): 90 < 100. Collapse YAxisTitle(25): 115 >= 100.
      const zones = createZones(makeOptions());
      const result = computeLayout(800, 250, zones);

      it('YAxisTitle is collapsed', () => {
        expect(result.collapsed).toContain(ZoneType.YAxisTitle);
      });

      it('XAxisTitle is NOT collapsed', () => {
        expect(result.collapsed).not.toContain(ZoneType.XAxisTitle);
        expect(result.zones.has(ZoneType.XAxisTitle)).toBe(true);
      });

      it('FooterText and YAxisTitle collapsed (plus RightMargin invisible = 3 total)', () => {
        expect(result.collapsed).toHaveLength(3);
      });

      it('Header is still present', () => {
        expect(result.zones.has(ZoneType.Header)).toBe(true);
      });

      it('PlotArea height is 115', () => {
        expect(result.zones.get(ZoneType.PlotArea)!.height).toBe(115);
      });
    });
  });

  describe('Header survives through the collapse cascade', () => {
    const zones = createZones(makeOptions());

    it('at 800×230, footer and both axis titles collapse but Header survives', () => {
      const result = computeLayout(800, 230, zones);
      expect(result.collapsed).toContain(ZoneType.FooterText);
      expect(result.collapsed).toContain(ZoneType.YAxisTitle);
      expect(result.collapsed).toContain(ZoneType.XAxisTitle);
      expect(result.collapsed).not.toContain(ZoneType.Header);
      expect(result.zones.has(ZoneType.Header)).toBe(true);
      expect(result.collapsed).not.toContain(ZoneType.Legend);
      expect(result.zones.has(ZoneType.Legend)).toBe(true);
    });

    it('at 800×210, axis titles and footer collapse but Header survives', () => {
      const result = computeLayout(800, 210, zones);
      expect(result.collapsed).toContain(ZoneType.YAxisTitle);
      expect(result.collapsed).toContain(ZoneType.XAxisTitle);
      expect(result.collapsed).toContain(ZoneType.FooterText);
      expect(result.collapsed).not.toContain(ZoneType.Header);
      expect(result.zones.has(ZoneType.Header)).toBe(true);
      expect(result.collapsed).not.toContain(ZoneType.Legend);
      expect(result.zones.has(ZoneType.Legend)).toBe(true);
    });

    it('at 800×180, axis titles, footer, and legend collapse but Header survives', () => {
      const result = computeLayout(800, 180, zones);
      expect(result.collapsed).toContain(ZoneType.YAxisTitle);
      expect(result.collapsed).toContain(ZoneType.XAxisTitle);
      expect(result.collapsed).toContain(ZoneType.FooterText);
      expect(result.collapsed).toContain(ZoneType.Legend);
      expect(result.collapsed).not.toContain(ZoneType.Header);
      expect(result.zones.has(ZoneType.Header)).toBe(true);
    });

    it('at 800×150, Header finally collapses (all vertical zones gone)', () => {
      const result = computeLayout(800, 150, zones);
      expect(result.collapsed).toContain(ZoneType.Header);
      expect(result.collapsed).toContain(ZoneType.YAxisTitle);
      expect(result.collapsed).toContain(ZoneType.XAxisTitle);
      expect(result.collapsed).toContain(ZoneType.FooterText);
      expect(result.collapsed).toContain(ZoneType.Legend);
      expect(result.zones.has(ZoneType.Header)).toBe(false);
    });
  });

  describe('non-visible zones are excluded from layout', () => {
    const zones = createZones(makeOptions({ showHeader: false }));
    const result = computeLayout(800, 600, zones);

    it('Header is not in the zones map', () => {
      expect(result.zones.has(ZoneType.Header)).toBe(false);
    });

    it('Header is in the collapsed list', () => {
      expect(result.collapsed).toContain(ZoneType.Header);
    });

    it('zones map has 7 entries (all visible zones)', () => {
      expect(result.zones.size).toBe(7);
    });

    it('all other zones are present in the result', () => {
      const expected = [
        ZoneType.YAxisTitle,
        ZoneType.YAxisLabels,
        ZoneType.PlotArea,
        ZoneType.XAxisLabels,
        ZoneType.XAxisTitle,
        ZoneType.Legend,
        ZoneType.FooterText,
      ];
      expected.forEach(type => {
        expect(result.zones.has(type)).toBe(true);
      });
    });
  });

  describe('PlotArea always gets remaining vertical space', () => {
    it('PlotArea height equals containerHeight minus all other zone heights (800x600)', () => {
      const zones = createZones(makeOptions());
      const result = computeLayout(800, 600, zones);
      // vertical zones sum: 40+25+40+25+30+20 = 180
      expect(result.zones.get(ZoneType.PlotArea)!.height).toBe(600 - 180);
    });

    it('PlotArea height equals containerHeight minus all other zone heights (800x400)', () => {
      const zones = createZones(makeOptions());
      const result = computeLayout(800, 400, zones);
      // vertical zones sum: 180, PlotArea = 220 >= 100, no collapse
      expect(result.zones.get(ZoneType.PlotArea)!.height).toBe(400 - 180);
    });

    it('PlotArea is always present when container has space', () => {
      const zones = createZones(makeOptions());
      const result = computeLayout(800, 500, zones);
      expect(result.zones.has(ZoneType.PlotArea)).toBe(true);
    });
  });

  describe('Y-axis labels width is capped to ensure PlotArea minimum width', () => {
    // Container 155x600: YAxisLabels preferred=60, but 155-100=55 < 60, so width=55
    const zones = createZones(makeOptions());
    const result = computeLayout(155, 600, zones);

    it('YAxisLabels width is capped to containerWidth - PLOT_AREA_MIN_SIZE', () => {
      expect(result.zones.get(ZoneType.YAxisLabels)!.width).toBe(155 - PLOT_AREA_MIN_SIZE);
    });

    it('PlotArea width equals PLOT_AREA_MIN_SIZE when capped', () => {
      expect(result.zones.get(ZoneType.PlotArea)!.width).toBe(PLOT_AREA_MIN_SIZE);
    });

    it('PlotArea x equals capped YAxisLabels width', () => {
      const yAxisLabelsWidth = 155 - PLOT_AREA_MIN_SIZE;
      expect(result.zones.get(ZoneType.PlotArea)!.x).toBe(yAxisLabelsWidth);
    });

    it('YAxisLabels width is not capped when container is wide enough', () => {
      const wideResult = computeLayout(800, 600, zones);
      expect(wideResult.zones.get(ZoneType.YAxisLabels)!.width).toBe(60); // full preferred
    });
  });

  describe('zero-size container returns empty result', () => {
    const zones = createZones(makeOptions());

    it('zero width returns empty zones map', () => {
      const result = computeLayout(0, 600, zones);
      expect(result.zones.size).toBe(0);
    });

    it('zero height returns empty zones map', () => {
      const result = computeLayout(800, 0, zones);
      expect(result.zones.size).toBe(0);
    });

    it('zero width collapses all zones', () => {
      const result = computeLayout(0, 600, zones);
      expect(result.collapsed).toHaveLength(zones.length);
    });

    it('zero height collapses all zones', () => {
      const result = computeLayout(800, 0, zones);
      expect(result.collapsed).toHaveLength(zones.length);
    });

    it('negative dimensions return empty result', () => {
      const result = computeLayout(-100, -100, zones);
      expect(result.zones.size).toBe(0);
      expect(result.collapsed).toHaveLength(zones.length);
    });
  });

  describe('only PlotArea remains when container is extremely small', () => {
    // Pie chart with no header/legend: only PlotArea and FooterText visible
    // Container 800x115: PlotArea = 115-20 = 95 < 100, collapse FooterText -> 115 >= 100
    const zones = createZones(makeOptions({ chartType: 'pie', showHeader: false, showLegend: false, seriesCount: 1 }));
    const result = computeLayout(800, 115, zones);

    it('only PlotArea is in the zones map', () => {
      expect(result.zones.size).toBe(1);
      expect(result.zones.has(ZoneType.PlotArea)).toBe(true);
    });

    it('FooterText is collapsed', () => {
      expect(result.collapsed).toContain(ZoneType.FooterText);
    });

    it('PlotArea height meets the minimum', () => {
      expect(result.zones.get(ZoneType.PlotArea)!.height).toBeGreaterThanOrEqual(PLOT_AREA_MIN_SIZE);
    });

    it('PlotArea x is 0 when YAxisLabels is not visible', () => {
      expect(result.zones.get(ZoneType.PlotArea)!.x).toBe(0);
    });

    it('PlotArea uses full container width when YAxisLabels is not visible', () => {
      expect(result.zones.get(ZoneType.PlotArea)!.width).toBe(800);
    });
  });

  describe('RightMargin zone for line charts', () => {
    it('RightMargin zone is allocated with width > 0 for line charts', () => {
      const zones = createZones(makeOptions({ chartType: 'line' }));
      // Apply a preferred size to RightMargin (simulates measurement)
      const measuredZones = zones.map(z =>
        z.type === ZoneType.RightMargin ? { ...z, preferredSize: 20 } : z
      );
      const result = computeLayout(800, 600, measuredZones);
      const rightMargin = result.zones.get(ZoneType.RightMargin);
      expect(rightMargin).toBeDefined();
      expect(rightMargin!.width).toBe(20);
    });

    it('PlotArea width = containerWidth - yAxisLabelsWidth - rightMarginWidth for line charts', () => {
      const zones = createZones(makeOptions({ chartType: 'line' }));
      const measuredZones = zones.map(z =>
        z.type === ZoneType.RightMargin ? { ...z, preferredSize: 20 } : z
      );
      const result = computeLayout(800, 600, measuredZones);
      const plotArea = result.zones.get(ZoneType.PlotArea)!;
      const yAxisLabels = result.zones.get(ZoneType.YAxisLabels)!;
      const rightMargin = result.zones.get(ZoneType.RightMargin)!;
      expect(plotArea.width).toBe(800 - yAxisLabels.width - rightMargin.width);
    });

    it('RightMargin is collapsed (invisible) for non-line charts', () => {
      const zones = createZones(makeOptions({ chartType: 'verticalBar' }));
      const result = computeLayout(800, 600, zones);
      expect(result.collapsed).toContain(ZoneType.RightMargin);
      expect(result.zones.has(ZoneType.RightMargin)).toBe(false);
    });

    it('RightMargin is positioned to the right of PlotArea', () => {
      const zones = createZones(makeOptions({ chartType: 'line' }));
      const measuredZones = zones.map(z =>
        z.type === ZoneType.RightMargin ? { ...z, preferredSize: 20 } : z
      );
      const result = computeLayout(800, 600, measuredZones);
      const plotArea = result.zones.get(ZoneType.PlotArea)!;
      const rightMargin = result.zones.get(ZoneType.RightMargin)!;
      expect(rightMargin.x).toBe(plotArea.x + plotArea.width);
    });

    it('RightMargin clamps to 0 in very narrow containers', () => {
      // containerWidth=200, YAxisLabels preferredSize=180, RightMargin preferredSize=30
      // After YAxisLabels allocation: yAxisLabelsWidth = min(180, max(0, 200-100)) = 100
      // RightMargin allocation: min(30, max(0, 200-100-100)) = min(30, 0) = 0
      const zones = createZones(makeOptions({ chartType: 'line' }));
      const measuredZones = zones.map(z => {
        if (z.type === ZoneType.YAxisLabels) return { ...z, preferredSize: 180 };
        if (z.type === ZoneType.RightMargin) return { ...z, preferredSize: 30 };
        return z;
      });
      const result = computeLayout(200, 600, measuredZones);
      const rightMargin = result.zones.get(ZoneType.RightMargin);
      expect(rightMargin).toBeDefined();
      expect(rightMargin!.width).toBe(0);
      const plotArea = result.zones.get(ZoneType.PlotArea)!;
      expect(plotArea.width).toBeGreaterThanOrEqual(PLOT_AREA_MIN_SIZE);
    });
  });
});
