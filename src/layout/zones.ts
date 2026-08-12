import { ChartType, ZoneConfig, ZoneType } from '../types';

export interface CreateZonesOptions {
  chartType: ChartType;
  showHeader: boolean;
  showLegend: boolean;
  seriesCount: number;
  hasFooterContent?: boolean;
  hasBurgerMenu?: boolean;
  hasHeaderContent?: boolean;
}

export const ZONE_PRIORITIES: Record<ZoneType, number> = {
  [ZoneType.PlotArea]: 6,
  [ZoneType.XAxisLabels]: 5,
  [ZoneType.YAxisLabels]: 5,
  [ZoneType.RightMargin]: 5,
  [ZoneType.Header]: 4,
  [ZoneType.Legend]: 3,
  [ZoneType.XAxisTitle]: 2,
  [ZoneType.YAxisTitle]: 2,
  [ZoneType.FooterText]: 1,
};

export const PLOT_AREA_MIN_SIZE = 100;

const HORIZONTAL_CHART_TYPES = new Set<ChartType>([
  'horizontalBar',
  'groupedHorizontalBar',
  'stackedHorizontalBar',
  'percentHorizontalBar',
  'pyramid',
]);

export function applyMeasuredSizes(
  zones: ZoneConfig[],
  measurements: Partial<Record<ZoneType, number>>
): ZoneConfig[] {
  return zones.map(zone => {
    const measured = measurements[zone.type];
    if (measured !== undefined) {
      return { ...zone, preferredSize: measured };
    }
    return zone;
  });
}

export function createZones(options: CreateZonesOptions): ZoneConfig[] {
  const { chartType, showHeader, showLegend, seriesCount, hasBurgerMenu, hasHeaderContent } = options;

  const isPie = chartType === 'pie';
  const isMap = chartType === 'map';
  const isHorizontal = HORIZONTAL_CHART_TYPES.has(chartType);

  const yAxisLabelsPreferred = isHorizontal ? 100 : 60;
  const xAxisLabelsPreferred = isHorizontal ? 30 : 40;

  return [
    {
      type: ZoneType.Header,
      visible: showHeader || Boolean(hasBurgerMenu),
      minSize: 0,
      preferredSize: hasBurgerMenu && !hasHeaderContent ? 48 : (showHeader ? 40 : 0),
      priority: ZONE_PRIORITIES[ZoneType.Header],
    },
    {
      type: ZoneType.YAxisTitle,
      visible: !isPie && !isMap,
      minSize: 0,
      preferredSize: 25,
      priority: ZONE_PRIORITIES[ZoneType.YAxisTitle],
    },
    {
      type: ZoneType.YAxisLabels,
      visible: !isPie && !isMap,
      minSize: 0,
      preferredSize: yAxisLabelsPreferred,
      priority: ZONE_PRIORITIES[ZoneType.YAxisLabels],
    },
    {
      type: ZoneType.PlotArea,
      visible: true,
      minSize: PLOT_AREA_MIN_SIZE,
      preferredSize: 0,
      priority: ZONE_PRIORITIES[ZoneType.PlotArea],
    },
    {
      type: ZoneType.RightMargin,
      visible: chartType === 'line' || chartType === 'scatterPlot' || chartType === 'map' || HORIZONTAL_CHART_TYPES.has(chartType),
      minSize: 0,
      preferredSize: 20,
      priority: ZONE_PRIORITIES[ZoneType.RightMargin],
    },
    {
      type: ZoneType.XAxisLabels,
      visible: !isPie && !isMap,
      minSize: 0,
      preferredSize: xAxisLabelsPreferred,
      priority: ZONE_PRIORITIES[ZoneType.XAxisLabels],
    },
    {
      type: ZoneType.XAxisTitle,
      visible: !isPie && !isMap,
      minSize: 0,
      preferredSize: 25,
      priority: ZONE_PRIORITIES[ZoneType.XAxisTitle],
    },
    {
      type: ZoneType.Legend,
      visible: (isMap || isPie) ? showLegend : (showLegend && seriesCount > 1),
      minSize: 0,
      preferredSize: 30,
      priority: ZONE_PRIORITIES[ZoneType.Legend],
    },
    {
      type: ZoneType.FooterText,
      visible: options.hasFooterContent ?? true,
      minSize: 0,
      preferredSize: 20,
      priority: ZONE_PRIORITIES[ZoneType.FooterText],
    },
  ];
}
