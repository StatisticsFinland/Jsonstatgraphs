import type { Selection } from 'd3-selection';
import type { ChartConfig, ChartType, ResolvedTheme } from '../types';
import { fitLabels, LabelTextMetrics, NiceSkipOptions } from './label-fitting';
import { getTickPositions } from './tick-positions';
import { formatNumber } from '../locale/number';
import { PLOT_AREA_MIN_SIZE } from './zones';

export interface ZoneMeasurementContext {
  svg: Selection<SVGSVGElement, unknown, null, undefined>;
  config: ChartConfig;
  theme: ResolvedTheme;
  xAxisTextMetrics?: LabelTextMetrics;
  yAxisTextMetrics?: LabelTextMetrics;
}

const FALLBACK_CHAR_WIDTH = 8;
const TITLE_LINE_HEIGHT = 1.25;
const HEADER_HORIZONTAL_PADDING = 20;
const HEADER_VERTICAL_PADDING = 12;
const MENU_ONLY_HEADER_HEIGHT = 48;
const FOOTER_LINE_HEIGHT = 1.4;
const FOOTER_VERTICAL_PADDING = 4;
const AXIS_CHAR_WIDTH = 8;
const HORIZONTAL_LABEL_WIDTH_RATIO = 0.4;
const ESTIMATED_AXIS_HEIGHT_RATIO = 0.6;
const RIGHT_MARGIN_CAP = 40;
const AXIS_TICK_MARGIN = 16;
const X_AXIS_TICK_SIZE = 8;
const X_AXIS_TICK_LABEL_GAP = 4;

const HORIZONTAL_CHART_TYPES = new Set<ChartType>([
  'horizontalBar',
  'groupedHorizontalBar',
  'stackedHorizontalBar',
  'percentHorizontalBar',
  'pyramid',
]);

const HORIZONTAL_BAR_CHART_TYPES = new Set<ChartType>([
  'horizontalBar',
  'groupedHorizontalBar',
  'stackedHorizontalBar',
  'percentHorizontalBar',
]);

export function measureHeaderZone(
  context: ZoneMeasurementContext,
  containerWidth: number,
  burgerMenuClearance: number,
): number {
  const { config, theme, svg } = context;
  const titleFontSize = Number.parseFloat(theme.fontSizeTitle) || 16;
  const subtitleFontSize = Number.parseFloat(theme.fontSizeLabel) || 14;
  const titleLineHeight = titleFontSize * TITLE_LINE_HEIGHT;
  const subtitleLineHeight = subtitleFontSize * TITLE_LINE_HEIGHT;

  if (config.showHeader === false) {
    return config.burgerMenuVisible ? MENU_ONLY_HEADER_HEIGHT : 0;
  }

  if (config.title) {
    const titleMaxWidth = containerWidth - HEADER_HORIZONTAL_PADDING * 2 - (
      config.burgerMenuVisible ? burgerMenuClearance : 0
    );
    const tempText = svg.append('text')
      .attr('font-size', theme.fontSizeTitle)
      .attr('font-family', theme.fontFamily)
      .attr('font-weight', theme.fontWeightBold)
      .attr('visibility', 'hidden');
    const textNode = tempText.node()!;
    const measureText = (text: string): number => {
      textNode.textContent = text;
      try {
        const computed = textNode.getComputedTextLength();
        return computed > 0 ? computed : text.length * FALLBACK_CHAR_WIDTH;
      } catch {
        return text.length * FALLBACK_CHAR_WIDTH;
      }
    };

    const words = config.title.split(/\s+/);
    let titleLineCount = 0;
    let currentLine = '';
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (titleMaxWidth > 0 && measureText(candidate) > titleMaxWidth && currentLine) {
        titleLineCount++;
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine) titleLineCount++;
    tempText.remove();

    const titleHeight = Math.max(1, titleLineCount) * titleLineHeight;
    return titleHeight
      + HEADER_VERTICAL_PADDING
      + (config.subtitle ? subtitleLineHeight : 0);
  }

  return config.subtitle
    ? subtitleLineHeight + HEADER_VERTICAL_PADDING
    : (config.burgerMenuVisible ? MENU_ONLY_HEADER_HEIGHT : 0);
}

export function measureFooterZone(config: ChartConfig, theme: ResolvedTheme): number {
  if (!config.footerItems || config.footerItems.length === 0) return 0;
  const tickFontSize = Number.parseFloat(theme.fontSizeTick) || 12;
  return config.footerItems.length * Math.ceil(tickFontSize * FOOTER_LINE_HEIGHT)
    + FOOTER_VERTICAL_PADDING;
}

export function createZoneMeasurementContext(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
  config: ChartConfig,
  theme: ResolvedTheme,
  textMetrics?: { xAxis?: LabelTextMetrics; yAxis?: LabelTextMetrics },
): ZoneMeasurementContext {
  return {
    svg,
    config,
    theme,
    xAxisTextMetrics: textMetrics?.xAxis,
    yAxisTextMetrics: textMetrics?.yAxis,
  };
}

export interface CategoricalMeasurementOptions {
  chartType: ChartType;
  categories: string[];
  categoryLabels?: string[];
  valueRange: [number, number];
  isHorizontal: boolean;
  timeSeriesLabels?: NiceSkipOptions;
  yLabel?: string;
  xLabel?: string;
  isPercent: boolean;
  paddedValueRange: [number, number];
  zeroBaselineForced: boolean;
}

export function measureCategoricalYAxisLabels(
  context: ZoneMeasurementContext,
  options: CategoricalMeasurementOptions,
  containerWidth: number,
  containerHeight: number,
): number {
  const { theme, config } = context;
  const labelTexts = options.categoryLabels ?? options.categories;
  if (options.isHorizontal) {
    const maxWidth = containerWidth * HORIZONTAL_LABEL_WIDTH_RATIO;
    const fitResult = fitLabels(
      labelTexts,
      maxWidth,
      maxWidth,
      AXIS_CHAR_WIDTH,
      undefined,
      context.yAxisTextMetrics,
    );
    const measureText = context.yAxisTextMetrics?.measureText
      ?? ((text: string) => text.length * AXIS_CHAR_WIDTH);
    const maxLineWidth = fitResult.labels.reduce(
      (max, label) => Math.max(max, ...label.lines.map(measureText)),
      0,
    );
    return maxLineWidth + AXIS_TICK_MARGIN;
  }

  const estimatedAxisHeight = containerHeight * ESTIMATED_AXIS_HEIGHT_RATIO;
  const ticks = getTickPositions(
    options.paddedValueRange[0],
    options.paddedValueRange[1],
    estimatedAxisHeight,
    undefined,
    theme.fontSizeTick,
    options.zeroBaselineForced,
  );
  const maxTickLength = ticks.reduce(
    (max, tick) => Math.max(max, formatNumber(tick, config.locale).length),
    0,
  );
  return maxTickLength * AXIS_CHAR_WIDTH + AXIS_TICK_MARGIN;
}

export function measureCategoricalRightMargin(
  context: ZoneMeasurementContext,
  options: CategoricalMeasurementOptions,
  containerWidth: number,
  yAxisWidth: number,
): number {
  const { chartType, categories, paddedValueRange } = options;
  if (chartType === 'line') {
    const preMarginPlotWidth = containerWidth - yAxisWidth;
    if (categories.length <= 1 || preMarginPlotWidth <= 0) return 0;
    const slotWidth = preMarginPlotWidth / (categories.length - 1);
    return Math.max(0, Math.min(Math.ceil(slotWidth / 2), RIGHT_MARGIN_CAP));
  }
  if (!HORIZONTAL_CHART_TYPES.has(chartType)) return 0;

  const estimatedPlotWidth = containerWidth - yAxisWidth;
  const ticks = getTickPositions(
    paddedValueRange[0],
    paddedValueRange[1],
    estimatedPlotWidth,
    undefined,
    context.theme.fontSizeTick,
  );
  if (ticks.length === 0) return 0;
  const lastTick = ticks.at(-1)!;
  const lastTickLabel = formatNumber(lastTick, context.config.locale);
  const measureText = context.xAxisTextMetrics?.measureText
    ?? ((text: string) => text.length * AXIS_CHAR_WIDTH);
  return Math.ceil(
    measureText(lastTickLabel) / 2,
  );
}

export function measureCategoricalXAxisLabels(
  context: ZoneMeasurementContext,
  options: CategoricalMeasurementOptions,
  containerWidth: number,
  yAxisWidth: number,
  rightMargin: number,
): number {
  if (options.isHorizontal) {
    const tickFontSize = Number.parseFloat(context.theme.fontSizeTick) || 12;
    const lineHeight = context.xAxisTextMetrics?.lineHeight ?? tickFontSize * 1.2;
    return Math.ceil(lineHeight + X_AXIS_TICK_SIZE + X_AXIS_TICK_LABEL_GAP);
  }

  const isLine = options.chartType === 'line';
  const slotDivisor = isLine
    ? Math.max(options.categories.length - 1, 1)
    : Math.max(options.categories.length, 1);
  const estimatedPlotWidth = Math.max(
    PLOT_AREA_MIN_SIZE,
    containerWidth - yAxisWidth - rightMargin,
  );
  const availableWidth = isLine ? estimatedPlotWidth : containerWidth;
  const slotWidth = availableWidth / slotDivisor;
  const fitResult = fitLabels(
    options.categoryLabels ?? options.categories,
    availableWidth,
    slotWidth,
    AXIS_CHAR_WIDTH,
    options.timeSeriesLabels,
    context.xAxisTextMetrics,
  );
  return fitResult.zoneSizeNeeded + X_AXIS_TICK_SIZE + X_AXIS_TICK_LABEL_GAP;
}

export function measureCategoricalAxisTitles(
  context: ZoneMeasurementContext,
  options: CategoricalMeasurementOptions,
): { yAxisTitle: number; xAxisTitle: number } {
  const yAxisTitle = options.isHorizontal && HORIZONTAL_BAR_CHART_TYPES.has(options.chartType)
    ? undefined
    : (options.isHorizontal ? options.xLabel : options.yLabel);
  const xAxisTitle = options.isHorizontal ? options.yLabel : options.xLabel;
  const axisTitleHeight = Math.ceil(
    (Number.parseFloat(context.theme.fontSizeLabel) || 14) * 1.5,
  );
  return {
    yAxisTitle: yAxisTitle ? axisTitleHeight : 0,
    xAxisTitle: xAxisTitle ? axisTitleHeight : 0,
  };
}