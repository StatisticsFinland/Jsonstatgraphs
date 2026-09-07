import { select, Selection } from 'd3-selection';
import { geoPath, geoIdentity } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { ChartConfig, MapChartData, MapClassBreak, ResolvedTheme, ZoneType, ZoneRect, LayoutResult } from '../types';
import { resolveTheme } from '../theme/theme';
import { createZones, applyMeasuredSizes } from '../layout/zones';
import { computeLayout } from '../layout/layout-engine';
import { measureSvgFooterHeight, renderSvgFooter } from './footer';
import { createSvgTextMeasurement, wrapMeasuredText } from '../layout/text-measurement';
import { bindInteractions, DataElementInfo, BoundInteractions } from './bindInteractions';
import { applyChartAriaAttributes, applyInteractiveChartAriaAttributes, applySeriesGroupAttributes } from '../a11y/aria';
import { captureChartFocusBeforeRedraw } from '../interaction/keyboard';
import { BURGER_MENU_CLEARANCE } from './base';
import { formatNumber } from '../locale/number';
import { getLocaleStrings } from '../locale/strings';


export interface MapChartConfig {
  container: HTMLElement;
  data: MapChartData;
  config: ChartConfig;
}

export interface MapChartInstance {
  update(data: MapChartData, config?: ChartConfig): void;
  destroy(): void;
}

interface MapHeaderLayout {
  titleLines: string[];
  subtitleLines: string[];
  titleLineHeight: number;
  subtitleLineHeight: number;
  height: number;
}

const MAP_HEADER_HORIZONTAL_PADDING = 20;
const MAP_HEADER_VERTICAL_PADDING = 12;
const MAP_HEADER_CONTENT_GAP = 4;
const MAP_MENU_ONLY_HEADER_HEIGHT = 48;
const MAP_FOOTER_HORIZONTAL_PADDING = 8;

function getClassificationBreaks(data: MapChartData): MapClassBreak[] {
  return data.classification.method === 'linear' ? [] : data.classification.breaks;
}

function renderMap(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
  data: MapChartData,
  plotArea: ZoneRect,
  theme: ResolvedTheme,
  locale?: string,
): DataElementInfo[] {
  const featureCollection = {
    type: 'FeatureCollection' as const,
    features: data.regions.map(r => r.feature),
  };

  const projection = geoIdentity()
    .reflectY(true)
    .fitSize([plotArea.width, plotArea.height], featureCollection as GeoPermissibleObjects);

  const pathGenerator = geoPath(projection);

  const interactionGroup = svg.append('g');

  const mapGroup = interactionGroup.append('g')
    .attr('class', 'jsc-map-regions')
    .attr('transform', `translate(${plotArea.x},${plotArea.y})`);
  applySeriesGroupAttributes(mapGroup.node() as SVGGElement, data.geoDimensionLabel, 0, locale);

  function formatValue(value: number | null): string {
    if (value === null) {
      return '\u2013';
    } else if (data.decimals !== undefined) {
      return formatNumber(value, locale, {
        minimumFractionDigits: data.decimals,
        maximumFractionDigits: data.decimals,
      });
    } else {
      return formatNumber(value, locale);
    }
  }

  const elements: DataElementInfo[] = [];

  data.regions.forEach((region, index) => {
    const path = mapGroup.append('path')
      .attr('class', region.classIndex >= 0 ? 'jsc-map-region' : 'jsc-map-region jsc-map-no-data')
      .attr('d', pathGenerator(region.feature as GeoPermissibleObjects) ?? '')
      .attr('fill', region.color)
      .attr('stroke', theme.colorBackground)
      .attr('stroke-width', 0.5)
      .attr('data-code', region.code)
      .attr('tabindex', '0');

    const formattedValue = formatValue(region.value);
    const formattedMeasurement = data.unit
      ? `${formattedValue} ${data.unit}`
      : formattedValue;

    elements.push({
      element: path.node() as SVGElement,
      seriesIndex: 0,
      pointIndex: index,
      pointKey: region.code,
      category: region.label,
      seriesName: data.valueDimensionLabel,
      value: region.value,
      formattedValue: formattedMeasurement,
      ariaLabel: `${data.geoDimensionLabel}: ${region.label}, ${formattedMeasurement}`,
      dimensionLabels: [
        { label: data.geoDimensionLabel, value: region.label },
      ],
    });
  });

  return elements;
}

function measureMapHeader(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
  config: ChartConfig,
  theme: ResolvedTheme,
  containerWidth: number,
): MapHeaderLayout {
  const titleFontSize = Number.parseFloat(theme.fontSizeTitle) || 16;
  const subtitleFontSize = Number.parseFloat(theme.fontSizeLabel) || 14;
  const titleMeasurement = createSvgTextMeasurement(svg, {
    parentClass: 'jsc-header',
    textClass: 'jsc-title',
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSizeTitle,
    fontWeight: theme.fontWeightBold,
    fallbackCharWidth: 8,
    fallbackLineHeight: titleFontSize * 1.25,
  });
  const subtitleMeasurement = createSvgTextMeasurement(svg, {
    parentClass: 'jsc-header',
    textClass: 'jsc-subtitle',
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSizeLabel,
    fontWeight: theme.fontWeightNormal,
    fallbackCharWidth: 8,
    fallbackLineHeight: subtitleFontSize * 1.25,
  });
  const maxWidth = Math.max(1, containerWidth - MAP_HEADER_HORIZONTAL_PADDING * 2 - (
    config.burgerMenuVisible ? BURGER_MENU_CLEARANCE : 0
  ));
  const titleLines = config.title
    ? wrapMeasuredText(config.title, maxWidth, titleMeasurement.measureText)
    : [];
  const subtitleLines = config.subtitle
    ? wrapMeasuredText(config.subtitle, maxWidth, subtitleMeasurement.measureText)
    : [];
  titleMeasurement.destroy();
  subtitleMeasurement.destroy();
  const hasContent = titleLines.length > 0 || subtitleLines.length > 0;
  const gap = titleLines.length > 0 && subtitleLines.length > 0 ? MAP_HEADER_CONTENT_GAP : 0;
  const contentHeight = titleLines.length * titleMeasurement.lineHeight
    + subtitleLines.length * subtitleMeasurement.lineHeight
    + gap;
  const height = config.showHeader === false
    ? (config.burgerMenuVisible ? MAP_MENU_ONLY_HEADER_HEIGHT : 0)
    : hasContent
      ? contentHeight + MAP_HEADER_VERTICAL_PADDING
      : (config.burgerMenuVisible ? MAP_MENU_ONLY_HEADER_HEIGHT : 0);
  return {
    titleLines,
    subtitleLines,
    titleLineHeight: titleMeasurement.lineHeight,
    subtitleLineHeight: subtitleMeasurement.lineHeight,
    height,
  };
}

function renderHeader(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
  layout: LayoutResult,
  config: ChartConfig,
  theme: ResolvedTheme,
  headerLayout: MapHeaderLayout,
): void {
  const headerRect = layout.zones.get(ZoneType.Header);
  if (!headerRect || config.showHeader === false) return;
  const { titleLines, subtitleLines, titleLineHeight, subtitleLineHeight } = headerLayout;
  if (titleLines.length === 0 && subtitleLines.length === 0) return;
  const headerGroup = svg.append('g').attr('class', 'jsc-header').attr('aria-hidden', 'true');
  const contentStartX = headerRect.x + MAP_HEADER_HORIZONTAL_PADDING;
  const titleBlockHeight = titleLines.length * titleLineHeight;
  const subtitleBlockHeight = subtitleLines.length * subtitleLineHeight;
  const gap = titleLines.length > 0 && subtitleLines.length > 0 ? MAP_HEADER_CONTENT_GAP : 0;
  const totalContentHeight = titleBlockHeight + gap + subtitleBlockHeight;
  const contentStartY = headerRect.y + (headerRect.height - totalContentHeight) / 2;

  if (titleLines.length > 0) {
    const titleEl = headerGroup.append('text')
      .attr('class', 'jsc-title')
      .attr('x', contentStartX)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', theme.fontSizeTitle)
      .attr('font-family', theme.fontFamily)
      .attr('font-weight', theme.fontWeightBold)
      .attr('fill', theme.colorText);

    for (let i = 0; i < titleLines.length; i++) {
      const y = contentStartY + (i + 0.5) * titleLineHeight;
      titleEl.append('tspan').attr('x', contentStartX).attr('y', y).text(titleLines[i]);
    }
  }

  if (subtitleLines.length > 0) {
    const subtitleEl = headerGroup.append('text')
      .attr('class', 'jsc-subtitle')
      .attr('x', contentStartX)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', theme.fontSizeLabel)
      .attr('font-family', theme.fontFamily)
      .attr('font-weight', theme.fontWeightNormal)
      .attr('fill', theme.colorTextSecondary);
    subtitleLines.forEach((line, index) => {
      subtitleEl.append('tspan')
        .attr('x', contentStartX)
        .attr('y', contentStartY + titleBlockHeight + gap + (index + 0.5) * subtitleLineHeight)
        .text(line);
    });
  }
}

function renderLegend(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
  layout: LayoutResult,
  data: MapChartData,
  theme: ResolvedTheme,
  mapRightEdge?: number,
  locale?: string,
): void {
  const strings = getLocaleStrings(locale);
  // Check if we should render in the right margin (vertical) or bottom (horizontal)
  const rightMarginRect = layout.zones.get(ZoneType.RightMargin);
  const legendRect = layout.zones.get(ZoneType.Legend);

  const MIN_RIGHT_LEGEND_WIDTH = 40;
  const useRightSide = rightMarginRect !== undefined && rightMarginRect.width >= MIN_RIGHT_LEGEND_WIDTH;
  const targetRect = useRightSide ? rightMarginRect : legendRect;
  if (!targetRect || targetRect.width <= 0 || targetRect.height <= 0) return;

  const legendX = useRightSide && mapRightEdge !== undefined
    ? Math.min(mapRightEdge, targetRect.x)
    : targetRect.x;

  const legendGroup = svg.append('g')
    .attr('class', 'jsc-map-legend')
    .attr('aria-hidden', 'true')
    .attr('transform', `translate(${legendX},${targetRect.y})`);

  if (data.classification.method === 'linear') {
    renderGradientLegend(legendGroup, targetRect, data, theme, useRightSide, locale);
    return;
  }

  const SWATCH_SIZE = 14;
  const SWATCH_GAP = 4;
  const fontSize = Number.parseFloat(theme.fontSizeTick) || 12;

  const items: { color: string; label: string }[] = [];

  const breaks = getClassificationBreaks(data);
  for (const brk of breaks) {
    const fmtMin = data.decimals !== undefined
      ? formatNumber(brk.min, locale, { minimumFractionDigits: data.decimals, maximumFractionDigits: data.decimals })
      : formatNumber(brk.min, locale);
    if (brk.openEnded) {
      items.push({ color: brk.color, label: `\u2265\u2009${fmtMin}` });
    } else {
      const fmtMax = data.decimals !== undefined
        ? formatNumber(brk.max, locale, { minimumFractionDigits: data.decimals, maximumFractionDigits: data.decimals })
        : formatNumber(brk.max, locale);
      items.push({ color: brk.color, label: `${fmtMin}\u2013${fmtMax}` });
    }
  }

  if (data.hasNoData) {
    items.push({ color: data.noDataColor, label: strings.noData });
  }

  if (useRightSide) {
    // Vertical layout (right side)
    const ITEM_GAP = 6;
    const PADDING_LEFT = 8;
    const lineHeight = SWATCH_SIZE + ITEM_GAP;
    const totalHeight = items.length * lineHeight - ITEM_GAP;
    const startY = Math.max(0, (targetRect.height - totalHeight) / 2);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const y = startY + i * lineHeight;

      legendGroup.append('rect')
        .attr('x', PADDING_LEFT)
        .attr('y', y)
        .attr('width', SWATCH_SIZE)
        .attr('height', SWATCH_SIZE)
        .attr('fill', item.color)
        .attr('stroke', theme.colorBorder)
        .attr('stroke-width', 0.5);

      legendGroup.append('text')
        .attr('x', PADDING_LEFT + SWATCH_SIZE + SWATCH_GAP)
        .attr('y', y + SWATCH_SIZE / 2)
        .attr('dominant-baseline', 'central')
        .attr('font-size', theme.fontSizeTick)
        .attr('font-family', theme.fontFamily)
        .attr('fill', theme.colorTextSecondary)
        .text(item.label);
    }
  } else {
    // Horizontal layout (bottom)
    const ITEM_GAP = 12;
    const CHAR_WIDTH_ESTIMATE = fontSize * 0.6;
    let totalWidth = 0;
    for (const item of items) {
      totalWidth += SWATCH_SIZE + SWATCH_GAP + item.label.length * CHAR_WIDTH_ESTIMATE;
    }
    totalWidth += (items.length - 1) * ITEM_GAP;

    let currentX = Math.max(0, (targetRect.width - totalWidth) / 2);
    const centerY = targetRect.height / 2;

    for (const item of items) {
      legendGroup.append('rect')
        .attr('x', currentX)
        .attr('y', centerY - SWATCH_SIZE / 2)
        .attr('width', SWATCH_SIZE)
        .attr('height', SWATCH_SIZE)
        .attr('fill', item.color)
        .attr('stroke', theme.colorBorder)
        .attr('stroke-width', 0.5);

      legendGroup.append('text')
        .attr('x', currentX + SWATCH_SIZE + SWATCH_GAP)
        .attr('y', centerY)
        .attr('dominant-baseline', 'central')
        .attr('font-size', theme.fontSizeTick)
        .attr('font-family', theme.fontFamily)
        .attr('fill', theme.colorTextSecondary)
        .text(item.label);

      currentX += SWATCH_SIZE + SWATCH_GAP + item.label.length * CHAR_WIDTH_ESTIMATE + ITEM_GAP;
    }
  }
}

function renderGradientLegend(
  legendGroup: Selection<SVGGElement, unknown, null, undefined>,
  targetRect: ZoneRect,
  data: MapChartData,
  theme: ResolvedTheme,
  useRightSide: boolean,
  locale?: string,
): void {
  if (data.classification.method !== 'linear') return;
  const strings = getLocaleStrings(locale);
  const { scaleMin, scaleMax, colors } = data.classification;
  const fontSize = Number.parseFloat(theme.fontSizeTick) || 12;

  const fmtMin = data.decimals !== undefined
    ? formatNumber(scaleMin, locale, { minimumFractionDigits: data.decimals, maximumFractionDigits: data.decimals })
    : formatNumber(scaleMin, locale);
  const fmtMax = data.decimals !== undefined
    ? formatNumber(scaleMax, locale, { minimumFractionDigits: data.decimals, maximumFractionDigits: data.decimals })
    : formatNumber(scaleMax, locale);

  // Degenerate data: render a single solid swatch instead of a gradient
  if (scaleMin === scaleMax) {
    const PADDING_LEFT = 8;
    const SWATCH_SIZE = 14;
    const swatchColor = colors[0] || '#cccccc';
    if (useRightSide) {
      const startY = (targetRect.height - SWATCH_SIZE) / 2;
      legendGroup.append('rect')
        .attr('x', PADDING_LEFT)
        .attr('y', startY)
        .attr('width', SWATCH_SIZE)
        .attr('height', SWATCH_SIZE)
        .attr('fill', swatchColor)
        .attr('stroke', theme.colorBorder)
        .attr('stroke-width', 0.5);
      legendGroup.append('text')
        .attr('x', PADDING_LEFT + SWATCH_SIZE + 4)
        .attr('y', startY + SWATCH_SIZE / 2)
        .attr('dominant-baseline', 'central')
        .attr('font-size', theme.fontSizeTick)
        .attr('font-family', theme.fontFamily)
        .attr('fill', theme.colorTextSecondary)
        .text(fmtMin);
    } else {
      const centerY = targetRect.height / 2;
      const startX = Math.max(0, (targetRect.width - SWATCH_SIZE - 4 - fmtMin.length * fontSize * 0.6) / 2);
      legendGroup.append('rect')
        .attr('x', startX)
        .attr('y', centerY - SWATCH_SIZE / 2)
        .attr('width', SWATCH_SIZE)
        .attr('height', SWATCH_SIZE)
        .attr('fill', swatchColor)
        .attr('stroke', theme.colorBorder)
        .attr('stroke-width', 0.5);
      legendGroup.append('text')
        .attr('x', startX + SWATCH_SIZE + 4)
        .attr('y', centerY)
        .attr('dominant-baseline', 'central')
        .attr('font-size', theme.fontSizeTick)
        .attr('font-family', theme.fontFamily)
        .attr('fill', theme.colorTextSecondary)
        .text(fmtMin);
    }
    return;
  }

  const gradientId = `jsc-map-gradient-${Date.now()}`;
  const defs = legendGroup.append('defs');
  const gradient = defs.append('linearGradient').attr('id', gradientId);

  if (useRightSide) {
    gradient.attr('x1', '0').attr('y1', '1').attr('x2', '0').attr('y2', '0');
    if (colors.length === 1) {
      gradient.append('stop').attr('offset', '0%').attr('stop-color', colors[0]);
      gradient.append('stop').attr('offset', '100%').attr('stop-color', colors[0]);
    } else {
      for (let i = 0; i < colors.length; i++) {
        gradient.append('stop')
          .attr('offset', `${(i / (colors.length - 1)) * 100}%`)
          .attr('stop-color', colors[i]);
      }
    }
    const PADDING_LEFT = 8;
    const BAR_WIDTH = 14;
    const BAR_HEIGHT = Math.min(targetRect.height * 0.6, 150);
    const startY = (targetRect.height - BAR_HEIGHT) / 2;

    legendGroup.append('rect')
      .attr('x', PADDING_LEFT)
      .attr('y', startY)
      .attr('width', BAR_WIDTH)
      .attr('height', BAR_HEIGHT)
      .attr('fill', `url(#${gradientId})`)
      .attr('stroke', theme.colorBorder)
      .attr('stroke-width', 0.5);

    legendGroup.append('text')
      .attr('x', PADDING_LEFT + BAR_WIDTH + 4)
      .attr('y', startY)
      .attr('dominant-baseline', 'hanging')
      .attr('font-size', theme.fontSizeTick)
      .attr('font-family', theme.fontFamily)
      .attr('fill', theme.colorTextSecondary)
      .text(fmtMax);

    legendGroup.append('text')
      .attr('x', PADDING_LEFT + BAR_WIDTH + 4)
      .attr('y', startY + BAR_HEIGHT)
      .attr('dominant-baseline', 'auto')
      .attr('font-size', theme.fontSizeTick)
      .attr('font-family', theme.fontFamily)
      .attr('fill', theme.colorTextSecondary)
      .text(fmtMin);

    if (data.hasNoData) {
      const noDataY = startY + BAR_HEIGHT + 16;
      legendGroup.append('rect')
        .attr('x', PADDING_LEFT)
        .attr('y', noDataY)
        .attr('width', BAR_WIDTH)
        .attr('height', BAR_WIDTH)
        .attr('fill', data.noDataColor)
        .attr('stroke', theme.colorBorder)
        .attr('stroke-width', 0.5);
      legendGroup.append('text')
        .attr('x', PADDING_LEFT + BAR_WIDTH + 4)
        .attr('y', noDataY + BAR_WIDTH / 2)
        .attr('dominant-baseline', 'central')
        .attr('font-size', theme.fontSizeTick)
        .attr('font-family', theme.fontFamily)
        .attr('fill', theme.colorTextSecondary)
        .text(strings.noData);
    }
  } else {
    gradient.attr('x1', '0').attr('y1', '0').attr('x2', '1').attr('y2', '0');
    if (colors.length === 1) {
      gradient.append('stop').attr('offset', '0%').attr('stop-color', colors[0]);
      gradient.append('stop').attr('offset', '100%').attr('stop-color', colors[0]);
    } else {
      for (let i = 0; i < colors.length; i++) {
        gradient.append('stop')
          .attr('offset', `${(i / (colors.length - 1)) * 100}%`)
          .attr('stop-color', colors[i]);
      }
    }
    const CHAR_WIDTH_EST = fontSize * 0.6;
    const minLabelWidth = fmtMin.length * CHAR_WIDTH_EST;
    const maxLabelWidth = fmtMax.length * CHAR_WIDTH_EST;
    const BAR_HEIGHT = 14;
    const BAR_WIDTH = Math.min(targetRect.width * 0.5, 200);
    const totalWidth = minLabelWidth + BAR_WIDTH + maxLabelWidth + 8;
    const startX = Math.max(0, (targetRect.width - totalWidth) / 2);
    const centerY = targetRect.height / 2;

    legendGroup.append('text')
      .attr('x', startX)
      .attr('y', centerY)
      .attr('dominant-baseline', 'central')
      .attr('text-anchor', 'start')
      .attr('font-size', theme.fontSizeTick)
      .attr('font-family', theme.fontFamily)
      .attr('fill', theme.colorTextSecondary)
      .text(fmtMin);

    legendGroup.append('rect')
      .attr('x', startX + minLabelWidth + 4)
      .attr('y', centerY - BAR_HEIGHT / 2)
      .attr('width', BAR_WIDTH)
      .attr('height', BAR_HEIGHT)
      .attr('fill', `url(#${gradientId})`)
      .attr('stroke', theme.colorBorder)
      .attr('stroke-width', 0.5);

    legendGroup.append('text')
      .attr('x', startX + minLabelWidth + 4 + BAR_WIDTH + 4)
      .attr('y', centerY)
      .attr('dominant-baseline', 'central')
      .attr('text-anchor', 'start')
      .attr('font-size', theme.fontSizeTick)
      .attr('font-family', theme.fontFamily)
      .attr('fill', theme.colorTextSecondary)
      .text(fmtMax);

    if (data.hasNoData) {
      const noDataX = startX + minLabelWidth + 4 + BAR_WIDTH + 4 + maxLabelWidth + 12;
      legendGroup.append('rect')
        .attr('x', noDataX)
        .attr('y', centerY - BAR_HEIGHT / 2)
        .attr('width', BAR_HEIGHT)
        .attr('height', BAR_HEIGHT)
        .attr('fill', data.noDataColor)
        .attr('stroke', theme.colorBorder)
        .attr('stroke-width', 0.5);
      legendGroup.append('text')
        .attr('x', noDataX + BAR_HEIGHT + 4)
        .attr('y', centerY)
        .attr('dominant-baseline', 'central')
        .attr('font-size', theme.fontSizeTick)
        .attr('font-family', theme.fontFamily)
        .attr('fill', theme.colorTextSecondary)
        .text(strings.noData);
    }
  }
}

function visitCoordinates(
  geom: { type: string; coordinates: unknown },
  fn: (x: number, y: number) => void,
): void {
  const { type, coordinates } = geom;
  if (type === 'Point') {
    const [x, y] = coordinates as [number, number];
    fn(x, y);
  } else if (type === 'MultiPoint' || type === 'LineString') {
    for (const coord of coordinates as [number, number][]) fn(coord[0], coord[1]);
  } else if (type === 'MultiLineString' || type === 'Polygon') {
    for (const ring of coordinates as [number, number][][]) {
      for (const coord of ring) fn(coord[0], coord[1]);
    }
  } else if (type === 'MultiPolygon') {
    for (const polygon of coordinates as [number, number][][][]) {
      for (const ring of polygon) {
        for (const coord of ring) fn(coord[0], coord[1]);
      }
    }
  }
}

function computeGeoBboxAspectRatio(data: MapChartData): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const region of data.regions) {
    const geom = region.feature.geometry;
    visitCoordinates(geom as { type: string; coordinates: unknown }, (x, y) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0) return 1;
  return height / width; // > 1 means portrait
}

function measureMapZoneSizes(
  config: ChartConfig,
  data: MapChartData,
  theme: ResolvedTheme,
  isPortrait: boolean,
  headerHeight: number,
  footerHeight: number,
): Partial<Record<ZoneType, number>> {
  const measurements: Partial<Record<ZoneType, number>> = {};
  const tickFontSize = Number.parseFloat(theme.fontSizeTick) || 12;
  measurements[ZoneType.Header] = headerHeight;

  const showLegend = config.showLegend ?? true;
  const breaks = getClassificationBreaks(data);
  const isLinear = data.classification.method === 'linear';
  const itemCount = isLinear ? 1 : breaks.length + (data.hasNoData ? 1 : 0);

  if (isLinear && isPortrait && showLegend) {
    // Gradient bar + labels
    const SWATCH_SIZE = 14;
    const LEGEND_PADDING = 16;
    const CHAR_WIDTH_ESTIMATE = tickFontSize * 0.6;
    let maxLabelWidth = 8 * CHAR_WIDTH_ESTIMATE; // fallback estimate
    if (data.classification.method === 'linear') {
      const { scaleMin, scaleMax } = data.classification;
      const fmtMin = data.decimals !== undefined
        ? formatNumber(scaleMin, config.locale, { minimumFractionDigits: data.decimals, maximumFractionDigits: data.decimals })
        : formatNumber(scaleMin, config.locale);
      const fmtMax = data.decimals !== undefined
        ? formatNumber(scaleMax, config.locale, { minimumFractionDigits: data.decimals, maximumFractionDigits: data.decimals })
        : formatNumber(scaleMax, config.locale);
      maxLabelWidth = Math.max(fmtMin.length, fmtMax.length) * CHAR_WIDTH_ESTIMATE;
    }
    measurements[ZoneType.RightMargin] = SWATCH_SIZE + 4 + maxLabelWidth + LEGEND_PADDING;
    measurements[ZoneType.Legend] = 0;
  } else if (itemCount > 0 && isPortrait && showLegend) {
    // Place legend on the right side
    measurements[ZoneType.Legend] = 0;

    const SWATCH_SIZE = 14;
    const SWATCH_GAP = 4;
    const LEGEND_PADDING = 16;
    const CHAR_WIDTH_ESTIMATE = tickFontSize * 0.6;

    let maxLabelWidth = 0;
    for (const brk of breaks) {
      const fmtMin = data.decimals !== undefined
        ? formatNumber(brk.min, config.locale, { minimumFractionDigits: data.decimals, maximumFractionDigits: data.decimals })
        : formatNumber(brk.min, config.locale);
      const fmtMax = data.decimals !== undefined
        ? formatNumber(brk.max, config.locale, { minimumFractionDigits: data.decimals, maximumFractionDigits: data.decimals })
        : formatNumber(brk.max, config.locale);
      const label = `${fmtMin}\u2013${fmtMax}`;
      const labelWidth = label.length * CHAR_WIDTH_ESTIMATE;
      if (labelWidth > maxLabelWidth) maxLabelWidth = labelWidth;
    }
    if (data.hasNoData) {
      const noDataWidth = 'No data'.length * CHAR_WIDTH_ESTIMATE;
      if (noDataWidth > maxLabelWidth) maxLabelWidth = noDataWidth;
    }

    measurements[ZoneType.RightMargin] = SWATCH_SIZE + SWATCH_GAP + maxLabelWidth + LEGEND_PADDING;
  } else if (itemCount > 0 && showLegend) {
    // Keep horizontal bottom legend
    measurements[ZoneType.Legend] = Math.ceil(tickFontSize * 1.7) + 8;
    measurements[ZoneType.RightMargin] = 0;
  } else {
    measurements[ZoneType.Legend] = 0;
    measurements[ZoneType.RightMargin] = 0;
  }

  measurements[ZoneType.FooterText] = footerHeight;

  measurements[ZoneType.YAxisTitle] = 0;
  measurements[ZoneType.YAxisLabels] = 0;
  measurements[ZoneType.XAxisLabels] = 0;
  measurements[ZoneType.XAxisTitle] = 0;

  return measurements;
}

export function createMapChart(chartConfig: MapChartConfig): MapChartInstance {
  const { container } = chartConfig;
  let data = chartConfig.data;
  let config = chartConfig.config;

  let boundInteractions: BoundInteractions | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let textStyleObserver: MutationObserver | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let textMetricTimer: ReturnType<typeof setTimeout> | null = null;
  let textMetricFingerprint: string | null = null;
  let cachedAspectRatio: number | null = null;
  const originalOverflow = container.style.overflow;

  const containerPosition = getComputedStyle(container).position;
  if (containerPosition === 'static') {
    container.style.position = 'relative';
  }
  container.style.overflow = 'hidden';
  container.classList.add('jsc-map-container');

  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  container.appendChild(svgEl);
  applyInteractiveChartAriaAttributes(svgEl, config.locale);
  const svg = select(svgEl) as Selection<SVGSVGElement, unknown, null, undefined>;
  svg.attr('class', 'jsc-chart').attr('width', '100%').attr('height', '100%');

  function createFooterMeasurement(theme: ResolvedTheme) {
    return createSvgTextMeasurement(svg, {
      parentClass: 'jsc-footer',
      textClass: 'jsc-footer-text',
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSizeTick,
      fallbackCharWidth: 8,
      fallbackLineHeight: Math.ceil((Number.parseFloat(theme.fontSizeTick) || 12) * 1.4),
    });
  }

  function captureTextMetricFingerprint(): string {
    const theme = resolveTheme(container, config.theme);
    const sample = 'Accessibility labels 0123456789';
    const measurements = [
      createSvgTextMeasurement(svg, {
        parentClass: 'jsc-header',
        textClass: 'jsc-title',
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSizeTitle,
        fontWeight: theme.fontWeightBold,
      }),
      createFooterMeasurement(theme),
    ];
    const fingerprint = JSON.stringify(measurements.map(measurement => [
      Math.round(measurement.measureText(sample) * 100) / 100,
      Math.round(measurement.lineHeight * 100) / 100,
    ]));
    measurements.forEach(measurement => measurement.destroy());
    return fingerprint;
  }

  function scheduleTextMetricCheck(): void {
    if (textMetricTimer !== null) clearTimeout(textMetricTimer);
    textMetricTimer = setTimeout(() => {
      textMetricTimer = null;
      const nextFingerprint = captureTextMetricFingerprint();
      if (textMetricFingerprint !== null && nextFingerprint !== textMetricFingerprint) {
        render();
      } else {
        textMetricFingerprint = nextFingerprint;
      }
    }, 50);
  }

  function render(): void {
    const theme = resolveTheme(container, config.theme);

    captureChartFocusBeforeRedraw(container);

    const width = container.clientWidth;
    const height = container.clientHeight;

    cachedAspectRatio ??= computeGeoBboxAspectRatio(data);
    const isPortrait = cachedAspectRatio > 1.2;
    const headerLayout = measureMapHeader(svg, config, theme, width);
    let footerHeight = 0;
    if (config.footerItems && config.footerItems.length > 0) {
      const footerMeasurement = createFooterMeasurement(theme);
      footerHeight = measureSvgFooterHeight(
        config.footerItems,
        Math.max(1, width - MAP_FOOTER_HORIZONTAL_PADDING * 2),
        footerMeasurement,
      );
      footerMeasurement.destroy();
    }

    const zones = createZones({
      chartType: 'map',
      showHeader: config.showHeader ?? false,
      showLegend: config.showLegend ?? true,
      seriesCount: data.classification.method === 'linear' ? 1 : data.classification.breaks.length,
      hasFooterContent: (config.footerItems && config.footerItems.length > 0),
      hasBurgerMenu: config.burgerMenuVisible,
      hasHeaderContent: config.showHeader !== false && Boolean(config.title?.trim() || config.subtitle?.trim()),
    });

    const measurements = measureMapZoneSizes(
      config,
      data,
      theme,
      isPortrait,
      headerLayout.height,
      footerHeight,
    );
    const measuredZones = applyMeasuredSizes(zones, measurements);
    const layout = computeLayout(width, height, measuredZones);

    const regionCount = data.regions.filter(r => r.classIndex >= 0).length;
    const strings = getLocaleStrings(config.locale);
    const ariaLabel = config.ariaLabel
      ?? config.title
      ?? `${data.valueDimensionLabel} ${strings.titleVariable} ${data.geoDimensionLabel} (${regionCount} ${strings.regions})`;
    applyChartAriaAttributes(container, ariaLabel, 'map', config.locale);
    applyInteractiveChartAriaAttributes(svgEl, config.locale);

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    const plotArea = layout.zones.get(ZoneType.PlotArea) ?? {
      x: 0, y: 0, width: Math.max(0, width), height: Math.max(0, height),
    };

    // Constrain the plot area to the map's natural aspect ratio so the map
    // fills the bounding rect exactly, rather than letterboxing one axis.
    const ar = cachedAspectRatio > 0 && Number.isFinite(cachedAspectRatio) ? cachedAspectRatio : 1; // height / width of geo bounding box
    const effectiveWidth = Math.min(plotArea.width, plotArea.height / ar);
    const effectiveHeight = Math.min(plotArea.height, plotArea.width * ar);
    const mapContentRect: ZoneRect = {
      x: plotArea.x + (plotArea.width - effectiveWidth) / 2,
      y: plotArea.y + (plotArea.height - effectiveHeight) / 2,
      width: effectiveWidth,
      height: effectiveHeight,
    };

    // Adjust right-margin zone to match the map's vertical extent so the
    // legend centres relative to the map, not the full plot area.
    const rightMarginZone = layout.zones.get(ZoneType.RightMargin);
    if (rightMarginZone) {
      rightMarginZone.y = mapContentRect.y;
      rightMarginZone.height = mapContentRect.height;
    }

    // Move the footer up to sit just below the map content when there is
    // excess vertical space (only move UP, never push it further down).
    const FOOTER_GAP = 8;
    const footerRect = layout.zones.get(ZoneType.FooterText);
    if (footerRect) {
      const mapBottom = mapContentRect.y + mapContentRect.height + FOOTER_GAP;
      // Don't move footer above the bottom-legend zone
      const legendZone = layout.zones.get(ZoneType.Legend);
      const minFooterY = legendZone ? legendZone.y + legendZone.height + FOOTER_GAP : 0;
      const adjustedY = Math.max(mapBottom, minFooterY);
      if (adjustedY < footerRect.y) {
        footerRect.y = adjustedY;
      }
    }

    renderHeader(svg, layout, config, theme, headerLayout);
    const elements = renderMap(
      svg,
      data,
      mapContentRect,
      theme,
      config.locale,
    );

    boundInteractions?.destroy();
    boundInteractions = bindInteractions({
      container,
      elements,
      theme,
      locale: config.locale,
      ariaLabel,
      pointAxis: 'both',
    });

    if (config.showLegend !== false) {
      const mapRightEdge = mapContentRect.x + mapContentRect.width;
      renderLegend(svg, layout, data, theme, mapRightEdge, config.locale);
    }

    if (footerRect && config.footerItems && config.footerItems.length > 0) {
      const footerMeasurement = createFooterMeasurement(theme);
      renderSvgFooter({
        parent: svg,
        footerItems: config.footerItems,
        sourceLink: config.sourceLink,
        theme,
        x: footerRect.x + MAP_FOOTER_HORIZONTAL_PADDING,
        y: footerRect.y,
        lineHeight: footerMeasurement.lineHeight,
        maxWidth: Math.max(1, footerRect.width - MAP_FOOTER_HORIZONTAL_PADDING * 2),
        textMetrics: footerMeasurement,
      });
      footerMeasurement.destroy();
    }

    textMetricFingerprint = captureTextMetricFingerprint();

  }

  render();

  resizeObserver = new ResizeObserver(() => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      render();
    }, 150);
  });
  resizeObserver.observe(container);
  textStyleObserver = new MutationObserver(() => scheduleTextMetricCheck());
  textStyleObserver.observe(document.head, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });
  let ancestor: HTMLElement | null = container;
  while (ancestor !== null) {
    textStyleObserver.observe(ancestor, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    ancestor = ancestor.parentElement;
  }

  return {
    update(newData: MapChartData, newConfig?: ChartConfig): void {
      data = newData;
      cachedAspectRatio = null;
      if (newConfig !== undefined) config = newConfig;
      render();
    },
    destroy(): void {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (textStyleObserver) {
        textStyleObserver.disconnect();
        textStyleObserver = null;
      }
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (textMetricTimer !== null) {
        clearTimeout(textMetricTimer);
        textMetricTimer = null;
      }
      boundInteractions?.destroy();
      boundInteractions = null;
      svg.node()?.remove();
      container.style.overflow = originalOverflow;
      container.classList.remove('jsc-map-container');
      container.removeAttribute('role');
      container.removeAttribute('aria-label');
      container.removeAttribute('aria-roledescription');
    },
  };
}
