import { createZones, applyMeasuredSizes, CreateZonesOptions, PLOT_AREA_MIN_SIZE, ZONE_PRIORITIES } from '../../src/layout/zones';
import { ZoneType } from '../../src/types';

function makeOptions(overrides: Partial<CreateZonesOptions> = {}): CreateZonesOptions {
  return {
    chartType: 'verticalBar',
    showHeader: true,
    showLegend: true,
    seriesCount: 2,
    ...overrides,
  };
}

function getZone(zones: ReturnType<typeof createZones>, type: ZoneType) {
  const z = zones.find(z => z.type === type);
  if (!z) throw new Error(`Zone ${type} not found`);
  return z;
}

describe('ZONE_PRIORITIES', () => {
  it('has all ZoneType entries', () => {
    const types = Object.values(ZoneType);
    types.forEach(t => {
      expect(ZONE_PRIORITIES[t]).toBeDefined();
    });
  });

  it('PlotArea has highest priority', () => {
    const priorities = Object.values(ZONE_PRIORITIES);
    expect(ZONE_PRIORITIES[ZoneType.PlotArea]).toBe(Math.max(...priorities));
  });

  it('FooterText has lowest priority', () => {
    const priorities = Object.values(ZONE_PRIORITIES);
    expect(ZONE_PRIORITIES[ZoneType.FooterText]).toBe(Math.min(...priorities));
  });

  it('has correct relative ordering for collapse behavior', () => {
    // Footer collapses first, then axis titles, then legend, then header
    // Axis labels and plot area have higher priority and collapse later
    expect(ZONE_PRIORITIES[ZoneType.FooterText]).toBeLessThan(ZONE_PRIORITIES[ZoneType.XAxisTitle]);
    expect(ZONE_PRIORITIES[ZoneType.FooterText]).toBeLessThan(ZONE_PRIORITIES[ZoneType.YAxisTitle]);
    expect(ZONE_PRIORITIES[ZoneType.XAxisTitle]).toBeLessThan(ZONE_PRIORITIES[ZoneType.Legend]);
    expect(ZONE_PRIORITIES[ZoneType.YAxisTitle]).toBeLessThan(ZONE_PRIORITIES[ZoneType.Legend]);
    expect(ZONE_PRIORITIES[ZoneType.Legend]).toBeLessThan(ZONE_PRIORITIES[ZoneType.Header]);
    expect(ZONE_PRIORITIES[ZoneType.Header]).toBeLessThan(ZONE_PRIORITIES[ZoneType.XAxisLabels]);
    expect(ZONE_PRIORITIES[ZoneType.Header]).toBeLessThan(ZONE_PRIORITIES[ZoneType.YAxisLabels]);
  });
});

describe('PLOT_AREA_MIN_SIZE', () => {
  it('equals 100', () => {
    expect(PLOT_AREA_MIN_SIZE).toBe(100);
  });
});

describe('createZones', () => {
  it('returns all 9 zone types', () => {
    const zones = createZones(makeOptions());
    const types = zones.map(z => z.type);
    Object.values(ZoneType).forEach(t => {
      expect(types).toContain(t);
    });
    expect(zones).toHaveLength(9);
  });

  describe('Header zone', () => {
    it('is visible when showHeader=true', () => {
      const zones = createZones(makeOptions({ showHeader: true }));
      expect(getZone(zones, ZoneType.Header).visible).toBe(true);
    });

    it('is hidden when showHeader=false', () => {
      const zones = createZones(makeOptions({ showHeader: false }));
      const h = getZone(zones, ZoneType.Header);
      expect(h.visible).toBe(false);
    });

    it('has preferredSize 40 when visible', () => {
      const zones = createZones(makeOptions({ showHeader: true }));
      expect(getZone(zones, ZoneType.Header).preferredSize).toBe(40);
    });

    it('reserves 48 px for a menu without header content', () => {
      const zones = createZones(makeOptions({
        showHeader: true,
        hasBurgerMenu: true,
        hasHeaderContent: false,
      }));
      expect(getZone(zones, ZoneType.Header).preferredSize).toBe(48);
    });

    it('reserves menu clearance when headers are disabled', () => {
      const zones = createZones(makeOptions({
        showHeader: false,
        hasBurgerMenu: true,
        hasHeaderContent: true,
      }));
      const header = getZone(zones, ZoneType.Header);
      expect(header.visible).toBe(true);
      expect(header.preferredSize).toBe(48);
    });

    it('keeps the existing 40 px row when a menu has header content', () => {
      const zones = createZones(makeOptions({
        showHeader: true,
        hasBurgerMenu: true,
        hasHeaderContent: true,
      }));
      expect(getZone(zones, ZoneType.Header).preferredSize).toBe(40);
    });

    it('has preferredSize 0 when not visible', () => {
      const zones = createZones(makeOptions({ showHeader: false }));
      expect(getZone(zones, ZoneType.Header).preferredSize).toBe(0);
    });

    it('has minSize 0', () => {
      const zones = createZones(makeOptions());
      expect(getZone(zones, ZoneType.Header).minSize).toBe(0);
    });
  });

  describe('Axis zones for pie chart', () => {
    const pieZones = createZones(makeOptions({ chartType: 'pie' }));

    it.each([ZoneType.YAxisTitle, ZoneType.YAxisLabels, ZoneType.XAxisLabels, ZoneType.XAxisTitle])(
      '%s is not visible for pie chart',
      (type) => {
        expect(getZone(pieZones, type).visible).toBe(false);
      }
    );
  });

  describe('Axis zones for non-pie chart', () => {
    const barZones = createZones(makeOptions({ chartType: 'verticalBar' }));

    it.each([ZoneType.YAxisTitle, ZoneType.YAxisLabels, ZoneType.XAxisLabels, ZoneType.XAxisTitle])(
      '%s is visible for bar chart',
      (type) => {
        expect(getZone(barZones, type).visible).toBe(true);
      }
    );
  });

  describe('Axis preferred sizes — vertical charts', () => {
    it.each(['verticalBar', 'groupedVerticalBar', 'stackedVerticalBar', 'line'] as const)(
      '%s: yAxisLabels=60, xAxisLabels=40',
      (chartType) => {
        const zones = createZones(makeOptions({ chartType }));
        expect(getZone(zones, ZoneType.YAxisLabels).preferredSize).toBe(60);
        expect(getZone(zones, ZoneType.XAxisLabels).preferredSize).toBe(40);
      }
    );
  });

  describe('Axis preferred sizes — horizontal charts', () => {
    it.each(['horizontalBar', 'groupedHorizontalBar', 'stackedHorizontalBar', 'percentHorizontalBar'] as const)(
      '%s: yAxisLabels=100, xAxisLabels=30',
      (chartType) => {
        const zones = createZones(makeOptions({ chartType }));
        expect(getZone(zones, ZoneType.YAxisLabels).preferredSize).toBe(100);
        expect(getZone(zones, ZoneType.XAxisLabels).preferredSize).toBe(30);
      }
    );
  });

  describe('Axis titles', () => {
    it('yAxisTitle has preferredSize 25 and minSize 0', () => {
      const zones = createZones(makeOptions());
      const z = getZone(zones, ZoneType.YAxisTitle);
      expect(z.preferredSize).toBe(25);
      expect(z.minSize).toBe(0);
    });

    it('xAxisTitle has preferredSize 25 and minSize 0', () => {
      const zones = createZones(makeOptions());
      const z = getZone(zones, ZoneType.XAxisTitle);
      expect(z.preferredSize).toBe(25);
      expect(z.minSize).toBe(0);
    });
  });

  describe('Legend zone', () => {
    it('is visible when showLegend=true and seriesCount > 1', () => {
      const zones = createZones(makeOptions({ showLegend: true, seriesCount: 2 }));
      expect(getZone(zones, ZoneType.Legend).visible).toBe(true);
    });

    it('is hidden when showLegend=false', () => {
      const zones = createZones(makeOptions({ showLegend: false, seriesCount: 2 }));
      expect(getZone(zones, ZoneType.Legend).visible).toBe(false);
    });

    it('is hidden when seriesCount <= 1 for non-pie chart', () => {
      const zones = createZones(makeOptions({ showLegend: true, seriesCount: 1 }));
      expect(getZone(zones, ZoneType.Legend).visible).toBe(false);
    });

    it('is hidden for pie chart with 1 series', () => {
      const zones = createZones(makeOptions({ chartType: 'pie', showLegend: true, seriesCount: 1 }));
      expect(getZone(zones, ZoneType.Legend).visible).toBe(false);
    });

    it('is hidden for pie chart when showLegend=false', () => {
      const zones = createZones(makeOptions({ chartType: 'pie', showLegend: false, seriesCount: 1 }));
      expect(getZone(zones, ZoneType.Legend).visible).toBe(false);
    });

    it('has preferredSize 30 and minSize 0', () => {
      const zones = createZones(makeOptions());
      const z = getZone(zones, ZoneType.Legend);
      expect(z.preferredSize).toBe(30);
      expect(z.minSize).toBe(0);
    });
  });

  describe('FooterText zone', () => {
    it('is visible when hasFooterContent is not specified (defaults true)', () => {
      const zones = createZones(makeOptions());
      expect(getZone(zones, ZoneType.FooterText).visible).toBe(true);
    });

    it('is visible when hasFooterContent=true', () => {
      const zones = createZones(makeOptions({ hasFooterContent: true }));
      expect(getZone(zones, ZoneType.FooterText).visible).toBe(true);
    });

    it('is not visible when hasFooterContent=false', () => {
      const zones = createZones(makeOptions({ hasFooterContent: false }));
      expect(getZone(zones, ZoneType.FooterText).visible).toBe(false);
    });

    it('has preferredSize 20 and minSize 0', () => {
      const zones = createZones(makeOptions());
      const z = getZone(zones, ZoneType.FooterText);
      expect(z.preferredSize).toBe(20);
      expect(z.minSize).toBe(0);
    });
  });

  describe('PlotArea zone', () => {
    it('is always visible', () => {
      const zones = createZones(makeOptions());
      expect(getZone(zones, ZoneType.PlotArea).visible).toBe(true);
    });

    it('has minSize equal to PLOT_AREA_MIN_SIZE', () => {
      const zones = createZones(makeOptions());
      expect(getZone(zones, ZoneType.PlotArea).minSize).toBe(PLOT_AREA_MIN_SIZE);
    });

    it('has preferredSize 0', () => {
      const zones = createZones(makeOptions());
      expect(getZone(zones, ZoneType.PlotArea).preferredSize).toBe(0);
    });
  });

  describe('Zone priorities', () => {
    it('each zone has the correct priority from ZONE_PRIORITIES', () => {
      const zones = createZones(makeOptions());
      zones.forEach(z => {
        expect(z.priority).toBe(ZONE_PRIORITIES[z.type]);
      });
    });
  });

  describe('RightMargin zone visibility', () => {
    it('is visible for line chart', () => {
      const zones = createZones(makeOptions({ chartType: 'line' }));
      expect(getZone(zones, ZoneType.RightMargin).visible).toBe(true);
    });

    it.each(['horizontalBar', 'groupedHorizontalBar', 'stackedHorizontalBar', 'percentHorizontalBar', 'pyramid', 'scatterPlot'] as const)(
      'is visible for %s',
      (chartType) => {
        const zones = createZones(makeOptions({ chartType }));
        expect(getZone(zones, ZoneType.RightMargin).visible).toBe(true);
      }
    );

    it.each(['verticalBar', 'groupedVerticalBar', 'stackedVerticalBar', 'pie'] as const)(
      'is NOT visible for %s',
      (chartType) => {
        const zones = createZones(makeOptions({ chartType }));
        expect(getZone(zones, ZoneType.RightMargin).visible).toBe(false);
      }
    );

    it('has preferredSize 20 and minSize 0', () => {
      const zones = createZones(makeOptions({ chartType: 'horizontalBar' }));
      const z = getZone(zones, ZoneType.RightMargin);
      expect(z.preferredSize).toBe(20);
      expect(z.minSize).toBe(0);
    });
  });
});

describe('applyMeasuredSizes', () => {
  it('overrides preferredSize for specified zones', () => {
    const zones = createZones(makeOptions());
    const result = applyMeasuredSizes(zones, {
      [ZoneType.Header]: 99,
      [ZoneType.XAxisLabels]: 55,
    });
    expect(result.find(z => z.type === ZoneType.Header)!.preferredSize).toBe(99);
    expect(result.find(z => z.type === ZoneType.XAxisLabels)!.preferredSize).toBe(55);
    // Other zones should be unchanged
    const original = zones.find(z => z.type === ZoneType.YAxisLabels)!.preferredSize;
    expect(result.find(z => z.type === ZoneType.YAxisLabels)!.preferredSize).toBe(original);
  });

  it('does not mutate the input array', () => {
    const zones = createZones(makeOptions());
    const originalHeader = zones.find(z => z.type === ZoneType.Header)!.preferredSize;
    applyMeasuredSizes(zones, { [ZoneType.Header]: 99 });
    expect(zones.find(z => z.type === ZoneType.Header)!.preferredSize).toBe(originalHeader);
  });

  it('with empty measurements returns identical zones', () => {
    const zones = createZones(makeOptions());
    const result = applyMeasuredSizes(zones, {});
    result.forEach((zone, i) => {
      expect(zone.preferredSize).toBe(zones[i].preferredSize);
      expect(zone.type).toBe(zones[i].type);
    });
  });

  it('with non-existent zone type in measurements does not crash and array is unchanged', () => {
    const zones = createZones(makeOptions());
    // Cast to include a zone type that may not appear in the array (PlotArea has preferredSize 0 but is present)
    // Use an unusual scenario: pass measurement for a type not in zones by creating a minimal zones array
    const minimalZones = [zones.find(z => z.type === ZoneType.PlotArea)!];
    const result = applyMeasuredSizes(minimalZones, { [ZoneType.Header]: 50 });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(ZoneType.PlotArea);
    expect(result[0].preferredSize).toBe(minimalZones[0].preferredSize);
  });
});
