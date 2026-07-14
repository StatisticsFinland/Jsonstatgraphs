import { LayoutResult, ZoneConfig, ZoneType, ZoneRect } from '../types';
import { PLOT_AREA_MIN_SIZE } from './zones';

// Full-width zones above the shared row, in vertical stacking order
const FULL_WIDTH_ZONES_BEFORE: ZoneType[] = [
  ZoneType.Header,
  ZoneType.YAxisTitle,
];

// Full-width zones below the shared row, in vertical stacking order
const FULL_WIDTH_ZONES_AFTER: ZoneType[] = [
  ZoneType.XAxisLabels,
  ZoneType.XAxisTitle,
  ZoneType.Legend,
  ZoneType.FooterText,
];

// All vertical full-width zones (excludes YAxisLabels and PlotArea which share a row)
const ALL_VERTICAL_ZONES: ZoneType[] = [
  ...FULL_WIDTH_ZONES_BEFORE,
  ...FULL_WIDTH_ZONES_AFTER,
];

export function computeLayout(
  containerWidth: number,
  containerHeight: number,
  zones: ZoneConfig[]
): LayoutResult {
  // Edge case: zero or negative container dimensions
  if (containerWidth <= 0 || containerHeight <= 0) {
    return {
      zones: new Map<ZoneType, ZoneRect>(),
      collapsed: zones.map(z => z.type),
    };
  }

  // Step 1: Separate visible zones from non-visible ones
  const collapsed: ZoneType[] = [];
  const visibleMap = new Map<ZoneType, ZoneConfig>();

  for (const zone of zones) {
    if (zone.visible) {
      visibleMap.set(zone.type, zone);
    } else {
      collapsed.push(zone.type);
    }
  }

  // Step 2: Sum preferred heights of all visible full-width zones
  let usedVerticalHeight = 0;
  for (const type of ALL_VERTICAL_ZONES) {
    const zone = visibleMap.get(type);
    if (zone) {
      usedVerticalHeight += zone.preferredSize;
    }
  }

  // PlotArea gets all remaining vertical space
  let plotAreaHeight = containerHeight - usedVerticalHeight;

  // Step 3: If PlotArea is too small, collapse lowest-priority vertical zones
  if (plotAreaHeight < PLOT_AREA_MIN_SIZE) {
    // Sort collapsible zones by priority ascending (lowest priority collapses first)
    const collapsibleZones = ALL_VERTICAL_ZONES
      .filter(t => visibleMap.has(t))
      .map(t => visibleMap.get(t)!)
      .sort((a, b) => a.priority - b.priority);

    for (const zone of collapsibleZones) {
      if (plotAreaHeight >= PLOT_AREA_MIN_SIZE) break;
      plotAreaHeight += zone.preferredSize;
      collapsed.push(zone.type);
      visibleMap.delete(zone.type);
    }
  }

  // Clamp to avoid negative height if container is smaller than PLOT_AREA_MIN_SIZE
  plotAreaHeight = Math.max(0, plotAreaHeight);

  // Step 4: Allocate horizontal space for the shared row
  const yAxisLabelsZone = visibleMap.get(ZoneType.YAxisLabels);
  let yAxisLabelsWidth = 0;
  if (yAxisLabelsZone) {
    // Cap so that PlotArea always gets at least PLOT_AREA_MIN_SIZE width
    yAxisLabelsWidth = Math.min(
      yAxisLabelsZone.preferredSize,
      Math.max(0, containerWidth - PLOT_AREA_MIN_SIZE)
    );
  }
  const rightMarginZone = visibleMap.get(ZoneType.RightMargin);
  let rightMarginWidth = 0;
  if (rightMarginZone) {
    rightMarginWidth = Math.min(
      rightMarginZone.preferredSize,
      Math.max(0, containerWidth - yAxisLabelsWidth - PLOT_AREA_MIN_SIZE)
    );
    rightMarginWidth = Math.max(0, rightMarginWidth);
  }
  const plotAreaWidth = containerWidth - yAxisLabelsWidth - rightMarginWidth;

  // Step 5: Compute zone rectangles by stacking vertically
  const resultZones = new Map<ZoneType, ZoneRect>();
  let currentY = 0;

  // Full-width zones before the shared row (Header, YAxisTitle)
  for (const type of FULL_WIDTH_ZONES_BEFORE) {
    const zone = visibleMap.get(type);
    if (zone) {
      resultZones.set(type, {
        x: 0,
        y: currentY,
        width: containerWidth,
        height: zone.preferredSize,
      });
      currentY += zone.preferredSize;
    }
  }

  // Shared row: YAxisLabels (left) | PlotArea (right)
  const sharedRowY = currentY;

  if (yAxisLabelsZone) {
    resultZones.set(ZoneType.YAxisLabels, {
      x: 0,
      y: sharedRowY,
      width: yAxisLabelsWidth,
      height: plotAreaHeight,
    });
  }

  if (visibleMap.has(ZoneType.PlotArea)) {
    resultZones.set(ZoneType.PlotArea, {
      x: yAxisLabelsWidth,
      y: sharedRowY,
      width: plotAreaWidth,
      height: plotAreaHeight,
    });
  }

  if (rightMarginZone) {
    resultZones.set(ZoneType.RightMargin, {
      x: yAxisLabelsWidth + plotAreaWidth,
      y: sharedRowY,
      width: rightMarginWidth,
      height: plotAreaHeight,
    });
  }

  currentY += plotAreaHeight;

  // Full-width zones after the shared row (XAxisLabels, XAxisTitle, Legend, FooterText)
  for (const type of FULL_WIDTH_ZONES_AFTER) {
    const zone = visibleMap.get(type);
    if (zone) {
      resultZones.set(type, {
        x: 0,
        y: currentY,
        width: containerWidth,
        height: zone.preferredSize,
      });
      currentY += zone.preferredSize;
    }
  }

  return { zones: resultZones, collapsed };
}
