import { select, Selection } from 'd3-selection';
import { scaleLinear, ScaleLinear, ScaleBand, ScalePoint } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { ChartType, ChartConfig, ResolvedTheme, ZoneType, ZoneRect, LayoutResult } from '../types';
import { measureSvgFooterHeight, renderSvgFooter } from './footer';
import { Legend } from '../interaction/legend';
import { getTickPositions } from '../layout/tick-positions';
import { fitLabels, LabelFitResult, LabelTextMetrics, NiceSkipOptions, truncateLabel } from '../layout/label-fitting';
import { createSvgTextMeasurement } from '../layout/text-measurement';
import { resolveTheme } from '../theme/theme';
import { createZones, applyMeasuredSizes } from '../layout/zones';
import { computeLayout } from '../layout/layout-engine';
import { formatNumber } from '../locale/number';
import { getLocaleStrings } from '../locale/strings';
import {
  buildCategoricalScales,
  getCategoricalValuePadding,
  isCategoricalValueAxisZeroForced,
  isNumericValueAxisZeroForced,
  padNumericRange,
  padValueRange,
} from '../layout/axis-ranges';
import {
  createZoneMeasurementContext,
  measureCategoricalAxisTitles,
  measureCategoricalRightMargin,
  measureCategoricalXAxisLabels,
  measureCategoricalYAxisLabels,
  measureHeaderZone,
} from '../layout/zone-measurement';
import { captureChartFocusBeforeRedraw } from '../interaction/keyboard';
import { applyInteractiveChartAriaAttributes } from '../a11y/aria';

type XScale = ScaleBand<string> | ScalePoint<string> | ScaleLinear<number, number>;
type YScale = ScaleLinear<number, number> | ScaleBand<string> | ScalePoint<string>;

/** Size (px) of the tick marks on the X-axis. */
const X_AXIS_TICK_SIZE = 8;
/** Gap (px) between the X-axis tick mark and the label text. */
const X_AXIS_TICK_LABEL_GAP = 4;
/** Estimated width (px) per character when fitting axis labels without DOM measurement. */
const AXIS_LABEL_CHAR_WIDTH = 8;
/** Fallback width (px) available to horizontal category labels when their zone is absent. */
const HORIZONTAL_LABEL_FALLBACK_WIDTH = 100;
/** Space between horizontal category text and the plot axis. */
const HORIZONTAL_LABEL_TICK_MARGIN = 16;
/** Line-height multiplier used to estimate wrapped horizontal label height. */
const HORIZONTAL_LABEL_LINE_HEIGHT = 1.4;
/** Maximum number of wrapped lines shown for a horizontal category label. */
const HORIZONTAL_LABEL_MAX_LINES = 3;
/** Pyramid labels reserve two estimated line heights per visible category. */
const PYRAMID_LABEL_HEIGHT_MULTIPLIER = 2;
/** Maximum imbalance allowed between adjacent pyramid label skip intervals. */
const PYRAMID_SKIP_BALANCE_RATIO = 1.25;

export const BURGER_MENU_CLEARANCE = 24;

const HORIZONTAL_CHART_TYPES = new Set<ChartType>([
  'horizontalBar',
  'groupedHorizontalBar',
  'stackedHorizontalBar',
  'percentHorizontalBar',
  'pyramid',
]);

let scaffoldInstanceCounter = 0;

interface ChartScaffoldConfigBase {
  container: HTMLElement;
  chartType: ChartType;
  config: ChartConfig;
  seriesCount: number;
  seriesNames?: string[];
  xLabel?: string;
  yLabel?: string;
  burgerMenuVisible?: boolean;
}

export interface CategoricalScaffoldConfig extends ChartScaffoldConfigBase {
  mode: 'categorical';
  categories: string[];
  categoryLabels?: string[];
  valueRange: [number, number];
  timeSeriesLabels?: NiceSkipOptions;
}

export interface NumericScaffoldConfig extends ChartScaffoldConfigBase {
  mode: 'numeric';
  xValueRange: [number, number];
  yValueRange: [number, number];
  paddingMode?: 'away-from-zero' | 'symmetric';
}

export type ChartScaffoldConfig = CategoricalScaffoldConfig | NumericScaffoldConfig;

export interface ScaffoldRenderContext {
  svg: Selection<SVGSVGElement, unknown, null, undefined>;
  plotArea: ZoneRect;
  theme: ResolvedTheme;
  xScale: XScale;
  yScale: YScale;
  layout: LayoutResult;
  setSeriesToggle?: (callback: (index: number, active: boolean) => void) => void;
  setLegendItemStates?: (activeStates: boolean[]) => void;
}

interface RenderedScales {
  xScale: XScale;
  yScale: YScale;
}

interface AxisRenderOptions {
  tickValues: number[];
  fittedLabels: LabelFitResult;
  textMetrics: LabelTextMetrics;
}

export class ChartScaffold {
  private container: HTMLElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private theme: ResolvedTheme;
  private resizeObserver: ResizeObserver | null = null;
  private textStyleObserver: MutationObserver | null = null;
  private config: ChartConfig;
  private chartType: ChartType;
  private scaffoldConfig: ChartScaffoldConfig;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private textMetricTimer: ReturnType<typeof setTimeout> | null = null;
  private textMetricFingerprint: string | null = null;
  private legend: Legend | null = null;
  private renderCallback: ((ctx: ScaffoldRenderContext) => void) | null = null;
  private readonly reducedMotion: boolean;
  private readonly instanceId: number;
  private readonly clipPathId: string;
  private readonly originalOverflow: string = '';

  constructor(config: ChartScaffoldConfig) {
    this.scaffoldConfig = config;
    this.container = config.container;

    // Ensure container is a positioning context for overlay elements (legend, tooltip)
    const containerPosition = getComputedStyle(this.container).position;
    if (containerPosition === 'static') {
      this.container.style.position = 'relative';
    }
    this.originalOverflow = this.container.style.overflow;
    this.container.style.overflow = 'hidden';

    this.config = config.config;
    this.chartType = config.chartType;
    this.theme = resolveTheme(this.container, config.config.theme);
    this.instanceId = ++scaffoldInstanceCounter;
    this.clipPathId = `jsc-plot-clip-${this.instanceId}`;

    this.reducedMotion =
      globalThis.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.container.appendChild(svgEl);
    applyInteractiveChartAriaAttributes(svgEl, config.config.locale);
    this.svg = select(svgEl) as Selection<SVGSVGElement, unknown, null, undefined>;
    this.svg
      .attr('class', 'jsc-chart')
      .attr('width', '100%')
      .attr('height', '100%');

    this.resizeObserver = new ResizeObserver(() => {
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.render();
      }, 150);
    });
    this.resizeObserver.observe(this.container);

    this.textStyleObserver = new MutationObserver(() => this.scheduleTextMetricCheck());
    this.textStyleObserver.observe(document.head, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    let ancestor: HTMLElement | null = this.container;
    while (ancestor !== null) {
      this.textStyleObserver.observe(ancestor, {
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
      ancestor = ancestor.parentElement;
    }
  }

  private captureTextMetricFingerprint(): string {
    const sample = 'Accessibility labels 0123456789';
    const measurements = ['jsc-axis-x', 'jsc-axis-y'].map(parentClass => {
      const measurement = createSvgTextMeasurement(this.svg, {
        parentClass,
        fontFamily: this.theme.fontFamily,
        fontSize: this.theme.fontSizeTick,
        fallbackCharWidth: AXIS_LABEL_CHAR_WIDTH,
        fallbackLineHeight: (Number.parseFloat(this.theme.fontSizeTick) || 12) * 1.2,
      });
      const result = [
        Math.round(measurement.measureText(sample) * 100) / 100,
        Math.round(measurement.lineHeight * 100) / 100,
      ];
      measurement.destroy();
      return result;
    });
    return JSON.stringify(measurements);
  }

  private scheduleTextMetricCheck(): void {
    if (this.textMetricTimer !== null) clearTimeout(this.textMetricTimer);
    this.textMetricTimer = setTimeout(() => {
      this.textMetricTimer = null;
      const previousTheme = this.theme;
      this.theme = resolveTheme(this.container, this.config.theme);
      const textThemeKeys: Array<keyof ResolvedTheme> = [
        'fontFamily',
        'fontSizeTitle',
        'fontSizeLabel',
        'fontSizeTick',
        'fontWeightNormal',
        'fontWeightBold',
      ];
      const textThemeChanged = textThemeKeys.some(
        key => this.theme[key] !== previousTheme[key],
      );
      const nextFingerprint = this.captureTextMetricFingerprint();
      if (textThemeChanged || (
        this.textMetricFingerprint !== null && nextFingerprint !== this.textMetricFingerprint
      )) {
        this.render();
      } else {
        this.textMetricFingerprint = nextFingerprint;
      }
    }, 50);
  }

  private buildScales(
    isHorizontal: boolean,
    categories: string[],
    minValue: number,
    maxValue: number,
    plotAreaRect: ZoneRect,
    tickValues?: number[],
    scaleType: 'band' | 'point' = 'band'
  ): {
    xScale: XScale;
    yScale: YScale;
  } {
    return buildCategoricalScales(
      this.scaffoldConfig.chartType,
      this.theme,
      isHorizontal,
      categories,
      minValue,
      maxValue,
      plotAreaRect,
      tickValues,
      scaleType,
    );
  }

  private renderHeader(layout: LayoutResult): void {
    const headerRect = layout.zones.get(ZoneType.Header);
    if (!headerRect || this.scaffoldConfig.config.showHeader === false) return;

    const { title, subtitle } = this.scaffoldConfig.config;
    const headerGroup = this.svg.append('g').attr('class', 'jsc-header').attr('aria-hidden', 'true');

    const CHAR_WIDTH = 8;
    const LINE_HEIGHT = 1.25; // em
    const PADDING = 20; // px per side
    const maxWidth = headerRect.width - PADDING * 2 - (
      this.scaffoldConfig.config.burgerMenuVisible ? BURGER_MENU_CLEARANCE : 0
    );

    const measureText = (textEl: SVGTextElement, str: string): number => {
      textEl.textContent = str;
      try {
        const len = textEl.getComputedTextLength();
        return len > 0 ? len : str.length * CHAR_WIDTH;
      } catch {
        return str.length * CHAR_WIDTH;
      }
    };

    const wrapText = (text: string, textEl: SVGTextElement): string[] => {
      const fullWidth = measureText(textEl, text);
      if (fullWidth <= maxWidth) return [text];

      const words = text.split(/\s+/);
      const lines: string[] = [];
      let currentLine = '';
      for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        const width = measureText(textEl, candidate);
        if (width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = candidate;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines.length > 0 ? lines : [text];
    };

    // Create hidden measurement text element
    const measureEl = this.svg.append('text')
      .attr('font-size', this.theme.fontSizeTitle)
      .attr('font-family', this.theme.fontFamily)
      .attr('font-weight', this.theme.fontWeightBold)
      .attr('visibility', 'hidden')
      .node()!;

    let titleLines: string[] = [];
    if (title) {
      titleLines = wrapText(title, measureEl);
    }

    // Remove measurement element
    measureEl.remove();

    // Calculate vertical positioning
    const titleFontSize = Number.parseFloat(this.theme.fontSizeTitle) || 16;
    const subtitleFontSize = Number.parseFloat(this.theme.fontSizeLabel) || 14;
    const titleLineHeight = titleFontSize * LINE_HEIGHT;
    const titleBlockHeight = titleLines.length * titleLineHeight;
    const subtitleBlockHeight = subtitle ? subtitleFontSize * LINE_HEIGHT : 0;
    const gap = (title && subtitle) ? 4 : 0;
    const totalContentHeight = titleBlockHeight + gap + subtitleBlockHeight;

    const contentStartY = headerRect.y + (headerRect.height - totalContentHeight) / 2;
    const contentStartX = headerRect.x + PADDING;

    if (titleLines.length > 0) {
      const titleEl = headerGroup
        .append('text')
        .attr('class', 'jsc-title')
        .attr('x', contentStartX)
        .attr('text-anchor', 'start')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', this.theme.fontSizeTitle)
        .attr('font-family', this.theme.fontFamily)
        .attr('font-weight', this.theme.fontWeightBold)
        .attr('fill', this.theme.colorText);

      for (let i = 0; i < titleLines.length; i++) {
        const y = contentStartY + (i + 0.5) * titleLineHeight;
        titleEl.append('tspan')
          .attr('x', contentStartX)
          .attr('y', y)
          .text(titleLines[i]);
      }
    }

    if (subtitle) {
      const subtitleY = contentStartY + titleBlockHeight + gap + subtitleFontSize * 0.5 * LINE_HEIGHT;
      headerGroup
        .append('text')
        .attr('class', 'jsc-subtitle')
        .attr('x', contentStartX)
        .attr('y', subtitleY)
        .attr('text-anchor', 'start')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', this.theme.fontSizeLabel)
        .attr('font-family', this.theme.fontFamily)
        .attr('font-weight', this.theme.fontWeightNormal)
        .attr('fill', this.theme.colorTextSecondary)
        .text(subtitle);
    }
  }

  private renderNumericGrid(
    xScale: ScaleLinear<number, number>,
    yScale: ScaleLinear<number, number>,
    plotAreaRect: ZoneRect,
    xTickValues: number[],
    yTickValues: number[]
  ): void {
    const gridGroup = this.svg
      .append('g')
      .attr('class', 'jsc-grid')
      .attr('aria-hidden', 'true')
      .attr('transform', `translate(${plotAreaRect.x},${plotAreaRect.y})`);

    // Horizontal grid lines (from Y ticks)
    yTickValues.forEach((tick) => {
      gridGroup
        .append('line')
        .attr('x1', 0)
        .attr('x2', plotAreaRect.width)
        .attr('y1', yScale(tick))
        .attr('y2', yScale(tick))
        .attr('stroke', this.theme.colorBorder)
        .attr('opacity', this.theme.gridOpacity)
        .attr('stroke-width', 1);
    });

    // Vertical grid lines (from X ticks)
    xTickValues.forEach((tick) => {
      gridGroup
        .append('line')
        .attr('x1', xScale(tick))
        .attr('x2', xScale(tick))
        .attr('y1', 0)
        .attr('y2', plotAreaRect.height)
        .attr('stroke', this.theme.colorBorder)
        .attr('opacity', this.theme.gridOpacity)
        .attr('stroke-width', 1);
    });
  }

  private renderGrid(
    isHorizontal: boolean,
    xScale: XScale,
    yScale: YScale,
    plotAreaRect: ZoneRect,
    tickValues: number[]
  ): void {
    const gridGroup = this.svg
      .append('g')
      .attr('class', 'jsc-grid')
      .attr('aria-hidden', 'true')
      .attr('transform', `translate(${plotAreaRect.x},${plotAreaRect.y})`);

    if (isHorizontal) {
      const xLinear = xScale as ScaleLinear<number, number>;
      tickValues.forEach((tick) => {
        gridGroup
          .append('line')
          .attr('x1', xLinear(tick))
          .attr('x2', xLinear(tick))
          .attr('y1', 0)
          .attr('y2', plotAreaRect.height)
          .attr('stroke', this.theme.colorBorder)
          .attr('opacity', this.theme.gridOpacity)
          .attr('stroke-width', 1);
      });
    } else {
      const yLinear = yScale as ScaleLinear<number, number>;
      tickValues.forEach((tick) => {
        gridGroup
          .append('line')
          .attr('x1', 0)
          .attr('x2', plotAreaRect.width)
          .attr('y1', yLinear(tick))
          .attr('y2', yLinear(tick))
          .attr('stroke', this.theme.colorBorder)
          .attr('opacity', this.theme.gridOpacity)
          .attr('stroke-width', 1);
      });
    }
  }

  private renderNumericAxes(
    xScale: ScaleLinear<number, number>,
    yScale: ScaleLinear<number, number>,
    layout: LayoutResult,
    plotAreaRect: ZoneRect,
    xTickValues: number[],
    yTickValues: number[]
  ): void {
    const styleAxis = (g: Selection<SVGGElement, unknown, null, undefined>): void => {
      g.selectAll('text')
        .attr('font-size', this.theme.fontSizeTick)
        .attr('font-family', this.theme.fontFamily)
        .attr('fill', this.theme.colorTextSecondary);
      g.selectAll('line, path')
        .attr('stroke', this.theme.colorTick);
      g.select('.domain').attr('stroke', this.theme.colorTick);
    };

    if (layout.zones.has(ZoneType.YAxisLabels)) {
      const yAxisGroup = this.svg
        .append('g')
        .attr('class', 'jsc-axis-y')
        .attr('aria-hidden', 'true')
        .attr('transform', `translate(${plotAreaRect.x},${plotAreaRect.y})`);
      yAxisGroup
        .call(axisLeft(yScale)
          .tickValues(yTickValues)
          .tickFormat(d => formatNumber(Number(d), this.config.locale))
          .tickSizeOuter(0) as never)
        .call(styleAxis);
    }

    if (layout.zones.has(ZoneType.XAxisLabels)) {
      const xAxisGroup = this.svg
        .append('g')
        .attr('class', 'jsc-axis-x')
        .attr('aria-hidden', 'true')
        .attr('transform', `translate(${plotAreaRect.x},${plotAreaRect.y + plotAreaRect.height})`);
      xAxisGroup
        .call(axisBottom(xScale)
          .tickValues(xTickValues)
          .tickFormat(d => formatNumber(Number(d), this.config.locale))
          .tickSizeOuter(0) as never)
        .call(styleAxis);
    }
  }

  private renderAxes(
    isHorizontal: boolean,
    xScale: XScale,
    yScale: YScale,
    layout: LayoutResult,
    plotAreaRect: ZoneRect,
    options: AxisRenderOptions,
  ): void {
    const { tickValues, fittedLabels, textMetrics } = options;
    const axisFontSize = Number.parseFloat(this.theme.fontSizeTick) || 12;
    const styleAxis = (g: Selection<SVGGElement, unknown, null, undefined>): void => {
      g.selectAll('text')
        .attr('font-size', this.theme.fontSizeTick)
        .attr('font-family', this.theme.fontFamily)
        .attr('fill', this.theme.colorTextSecondary);
      g.selectAll('line, path')
        .attr('stroke', this.theme.colorTick);
      g.select('.domain').attr('stroke', this.theme.colorTick);
    };

    if (layout.zones.has(ZoneType.YAxisLabels)) {
      const yAxisGroup = this.svg
        .append('g')
        .attr('class', 'jsc-axis-y')
        .attr('aria-hidden', 'true')
        .attr('transform', `translate(${plotAreaRect.x},${plotAreaRect.y})`);

      if (isHorizontal) {
        yAxisGroup.call(axisLeft(yScale as ScaleBand<string>).tickSizeOuter(0) as never).call(styleAxis);
        // Replace D3's default tick text with fitted labels for horizontal band (Y) axis
        yAxisGroup.selectAll('.tick text').remove();
        yAxisGroup.selectAll<SVGGElement, unknown>('.tick').each(function(_d, i) {
          const fitted = fittedLabels.labels[i];
          if (!fitted || fitted.skip) {
            select(this).style('display', 'none');
            return;
          }
          const text = select(this).append('text')
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '')
            .attr('font-family', '')
            .attr('fill', '');
          const totalLines = fitted.lines.length;
          for (let lineIdx = 0; lineIdx < totalLines; lineIdx++) {
            const lineHeightEm = textMetrics.lineHeight / axisFontSize;
            const lineOffset = (lineIdx - (totalLines - 1) / 2) * lineHeightEm;
            text.append('tspan')
              .attr('x', -9)
              .attr('dy', lineIdx === 0 ? `${lineOffset}em` : `${lineHeightEm}em`)
              .text(fitted.lines[lineIdx]);
          }
        });
        // Re-apply axis styles after custom text injection
        yAxisGroup.call(styleAxis);
      } else {
        yAxisGroup
          .call(axisLeft(yScale as ScaleLinear<number, number>)
            .tickValues(tickValues)
            .tickFormat(d => formatNumber(Number(d), this.config.locale))
            .tickSizeOuter(0) as never)
          .call(styleAxis);
      }
    }

    if (layout.zones.has(ZoneType.XAxisLabels)) {
      const xAxisGroup = this.svg
        .append('g')
        .attr('class', 'jsc-axis-x')
        .attr('aria-hidden', 'true')
        .attr(
          'transform',
          `translate(${plotAreaRect.x},${plotAreaRect.y + plotAreaRect.height})`
        );

      if (isHorizontal) {
        const axis = axisBottom(xScale as ScaleLinear<number, number>)
          .tickValues(tickValues)
          .tickSizeOuter(0);
        axis.tickFormat((d) => formatNumber(
          this.scaffoldConfig.chartType === 'pyramid' ? Math.abs(Number(d)) : Number(d),
          this.config.locale,
        ));
        xAxisGroup
          .call(axis as never)
          .call(styleAxis);
      } else {
        const visibleLabelIndices = fittedLabels.labels
          .map((label, index) => label.skip ? -1 : index)
          .filter(index => index >= 0);
        const firstVisibleIndex = visibleLabelIndices[0];
        const lastVisibleIndex = visibleLabelIndices.at(-1);
        const svgNode = this.svg.node();
        xAxisGroup.call(
          (axisBottom(xScale as ScaleBand<string>)
            .tickSizeInner(X_AXIS_TICK_SIZE)
            .tickSizeOuter(0)) as never
        ).call(styleAxis);
        // Replace D3's default tick text with fitted labels for non-horizontal band (X) axis
        xAxisGroup.selectAll('.tick text').remove();
        xAxisGroup.selectAll<SVGGElement, unknown>('.tick').each(function(_d, i) {
          const fitted = fittedLabels.labels[i];
          if (!fitted || fitted.skip) {
            select(this).style('display', 'none');
            return;
          }
          const text = select(this).append('text')
            .attr('y', X_AXIS_TICK_SIZE + X_AXIS_TICK_LABEL_GAP)
            .attr('dominant-baseline', 'hanging')
            .attr('text-anchor', 'middle')
            .attr('font-size', '')
            .attr('font-family', '')
            .attr('fill', '');
          for (let lineIdx = 0; lineIdx < fitted.lines.length; lineIdx++) {
            const lineHeightEm = textMetrics.lineHeight / axisFontSize;
            text.append('tspan')
              .attr('x', 0)
              .attr('dy', lineIdx === 0 ? '0' : `${lineHeightEm}em`)
              .text(fitted.lines[lineIdx]);
          }
          const textNode = text.node();
          if (textNode && svgNode && (i === firstVisibleIndex || i === lastVisibleIndex)) {
            const textRect = textNode.getBoundingClientRect();
            const svgRect = svgNode.getBoundingClientRect();
            if (textRect.width > 0 && i === firstVisibleIndex && textRect.left < svgRect.left) {
              text.attr('text-anchor', 'start');
            } else if (textRect.width > 0 && i === lastVisibleIndex && textRect.right > svgRect.right) {
              text.attr('text-anchor', 'end');
            }
          }
        });
        // Re-apply axis styles after custom text injection
        xAxisGroup.call(styleAxis);
      }
    }
  }

  private renderAxisTitles(isHorizontal: boolean, layout: LayoutResult): void {
    const plotAreaRect = layout.zones.get(ZoneType.PlotArea);
    const yAxisTitleRect = layout.zones.get(ZoneType.YAxisTitle);
    if (yAxisTitleRect) {
      const yAxisTitle = isHorizontal
        ? this.scaffoldConfig.xLabel
        : this.scaffoldConfig.yLabel;

      if (yAxisTitle) {
        const titleX = plotAreaRect ? plotAreaRect.x : yAxisTitleRect.x;
        this.svg
          .append('text')
          .attr('class', 'jsc-axis-title-y')
          .attr('aria-hidden', 'true')
          .attr('x', titleX)
          .attr('y', yAxisTitleRect.y + yAxisTitleRect.height / 2)
          .attr('text-anchor', 'start')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', this.theme.fontSizeLabel)
          .attr('font-family', this.theme.fontFamily)
          .attr('fill', this.theme.colorTextSecondary)
          .text(yAxisTitle);
      }
    }

    const xAxisTitleRect = layout.zones.get(ZoneType.XAxisTitle);
    if (xAxisTitleRect) {
      const xAxisTitle = isHorizontal ? this.scaffoldConfig.yLabel : undefined;

      if (xAxisTitle) {
        this.svg
          .append('text')
          .attr('class', 'jsc-axis-title-x')
          .attr('aria-hidden', 'true')
          .attr('x', plotAreaRect ? plotAreaRect.x + plotAreaRect.width / 2 : xAxisTitleRect.x + xAxisTitleRect.width / 2)
          .attr('y', xAxisTitleRect.y + xAxisTitleRect.height / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', this.theme.fontSizeLabel)
          .attr('font-family', this.theme.fontFamily)
          .attr('fill', this.theme.colorTextSecondary)
          .text(xAxisTitle);
      }
    }
  }

  private renderFooter(layout: LayoutResult): void {
    const footerRect = layout.zones.get(ZoneType.FooterText);
    if (!footerRect) return;

    const footerItems = this.scaffoldConfig.config.footerItems;
    if (!footerItems || footerItems.length === 0) return;

    const plotAreaRect = layout.zones.get(ZoneType.PlotArea);
    const footerX = plotAreaRect ? plotAreaRect.x : footerRect.x;
    const footerMeasurement = createSvgTextMeasurement(this.svg, {
      parentClass: 'jsc-footer',
      textClass: 'jsc-footer-text',
      fontFamily: this.theme.fontFamily,
      fontSize: this.theme.fontSizeTick,
      fallbackCharWidth: 8,
      fallbackLineHeight: Math.ceil((Number.parseFloat(this.theme.fontSizeTick) || 12) * 1.4),
    });
    const maxWidth = footerRect.x + footerRect.width - footerX;

    renderSvgFooter({
      parent: this.svg,
      footerItems,
      sourceLink: this.scaffoldConfig.config.sourceLink,
      theme: this.theme,
      x: footerX,
      y: footerRect.y,
      lineHeight: footerMeasurement.lineHeight,
      maxWidth,
      textMetrics: footerMeasurement,
    });
    footerMeasurement.destroy();
  }

  private renderLegend(layout: LayoutResult): void {
    this.legend?.destroy();
    this.legend = null;

    const legendRect = layout.zones.get(ZoneType.Legend);
    if (!legendRect) return;

    const { seriesCount, seriesNames } = this.scaffoldConfig;
    const strings = getLocaleStrings(this.config.locale);
    const names: string[] = seriesNames && seriesNames.length > 0
      ? seriesNames
      : Array.from({ length: seriesCount }, (_, i) => `${strings.series} ${i + 1}`);

    this.legend = new Legend(this.container, names, this.theme, {
      accessibilityMode: this.config.accessibilityMode,
      chartType: this.scaffoldConfig.chartType,
      locale: this.config.locale,
    });

    const legendEl = this.container.querySelector('.jsc-legend') as HTMLDivElement | null;
    if (legendEl) {
      legendEl.style.position = 'absolute';
      legendEl.style.left = `${legendRect.x}px`;
      legendEl.style.top = `${legendRect.y}px`;
      legendEl.style.width = `${legendRect.width}px`;
      legendEl.style.boxSizing = 'border-box';
    }

    this.legend.render();
  }

  /** Measures the header zone height (title + subtitle) in px. */
  private measureHeaderZone(containerWidth: number): number {
    return measureHeaderZone(
      createZoneMeasurementContext(this.svg, this.scaffoldConfig.config, this.theme),
      containerWidth,
      BURGER_MENU_CLEARANCE,
    );
  }

  /**
   * Measures the legend zone height in px. Returns `undefined` when the legend is not shown.
   * Handles both categorical (pie check) and numeric (no pie: seriesCount > 1).
   */
  private measureLegendZone(containerWidth: number): number | undefined {
    const { config, seriesCount, seriesNames } = this.scaffoldConfig;
    const showLegend = config.showLegend ?? true;
    const isPie = this.scaffoldConfig.chartType === 'pie';
    // Numeric charts are never pie, so this safely handles both branches
    const legendVisible = isPie ? showLegend : (showLegend && seriesCount > 1);
    if (!legendVisible) return undefined;

    const names = (seriesNames && seriesNames.length > 0)
      ? seriesNames
      : Array.from({ length: seriesCount }, (_, i) => `Series ${i + 1}`);
    const labelFontSize = Number.parseFloat(this.theme.fontSizeLabel) || 14;
    const LEGEND_CHAR_WIDTH = Math.ceil(labelFontSize * 0.57); // ~8px at default 14px label font
    const ITEM_PADDING = Math.ceil(labelFontSize * 2.85); // swatch + margins + button padding (~40px at 14px)
    const ITEM_GAP = Math.ceil(labelFontSize * 1.14); // inter-item gap (~16px at 14px)
    const ROW_HEIGHT = Math.ceil(labelFontSize * 1.7); // row height (~24px at 14px)
    const ROW_GAP = Math.ceil(labelFontSize * 0.57); // row gap (~8px at 14px)

    let currentRowWidth = 0;
    let rows = 1;
    for (const name of names) {
      const itemWidth = name.length * LEGEND_CHAR_WIDTH + ITEM_PADDING;
      if (currentRowWidth > 0 && currentRowWidth + ITEM_GAP + itemWidth > containerWidth) {
        rows++;
        currentRowWidth = itemWidth;
      } else {
        currentRowWidth += (currentRowWidth > 0 ? ITEM_GAP : 0) + itemWidth;
      }
    }
    return rows * ROW_HEIGHT + (rows - 1) * ROW_GAP + 8; // +8 for padding
  }

  /** Measures the footer zone height in px. Returns 0 when there are no footer items. */
  private measureFooterZone(containerWidth: number, footerX: number): number {
    const footerItems = this.scaffoldConfig.config.footerItems;
    if (!footerItems || footerItems.length === 0) return 0;
    const measurement = createSvgTextMeasurement(this.svg, {
      parentClass: 'jsc-footer',
      textClass: 'jsc-footer-text',
      fontFamily: this.theme.fontFamily,
      fontSize: this.theme.fontSizeTick,
      fallbackCharWidth: 8,
      fallbackLineHeight: Math.ceil((Number.parseFloat(this.theme.fontSizeTick) || 12) * 1.4),
    });
    const height = measureSvgFooterHeight(
      footerItems,
      Math.max(1, containerWidth - footerX),
      measurement,
    );
    measurement.destroy();
    return height;
  }

  private measureNumericZoneSizes(
    containerWidth: number,
    containerHeight: number
  ): Partial<Record<ZoneType, number>> {
    const cfg = this.scaffoldConfig as NumericScaffoldConfig;
    const tickFontSize = Number.parseFloat(this.theme.fontSizeTick) || 12;
    const CHAR_WIDTH = Math.max(8, tickFontSize * 0.5);
    const measurements: Partial<Record<ZoneType, number>> = {};

    // Header zone — same logic as categorical
    measurements[ZoneType.Header] = this.measureHeaderZone(containerWidth);

    // Y-axis labels — estimated from numeric tick labels
    const [xMin, xMax] = cfg.xValueRange;
    const [yMin, yMax] = cfg.yValueRange;

    const yForceZeroBaseline = isNumericValueAxisZeroForced(cfg.config);
    const xPadded = padValueRange(xMin, xMax);
    const yPadded = yForceZeroBaseline
      ? padValueRange(yMin, yMax)
      : padNumericRange(yMin, yMax);

    const estimatedAxisHeight = containerHeight * 0.6;
    const yTicks = getTickPositions(yPadded[0], yPadded[1], estimatedAxisHeight, undefined, this.theme.fontSizeTick, yForceZeroBaseline);
    const maxYTickLen = yTicks.reduce((max, t) => Math.max(max, formatNumber(t, this.config.locale).length), 0);
    measurements[ZoneType.YAxisLabels] = maxYTickLen * CHAR_WIDTH + 16;

    // X-axis labels — single line of numeric ticks
    measurements[ZoneType.XAxisLabels] = Math.ceil(tickFontSize * 1.2 + 12);

    // Right margin — from last X tick label
    const yAxisWidth = measurements[ZoneType.YAxisLabels] ?? 60;
    const estimatedPlotWidth = Math.max(100, containerWidth - yAxisWidth);
    const xTicks = getTickPositions(xPadded[0], xPadded[1], estimatedPlotWidth, undefined, this.theme.fontSizeTick, true);
    if (xTicks.length > 0) {
      const lastTickStr = formatNumber(xTicks.at(-1)!, this.config.locale);
      measurements[ZoneType.RightMargin] = Math.ceil(lastTickStr.length * CHAR_WIDTH / 2);
    } else {
      measurements[ZoneType.RightMargin] = 0;
    }

    // Axis title zones
    const axisTitleHeight = Math.ceil(
      (Number.parseFloat(this.theme.fontSizeLabel) || 14) * 1.5,
    );
    measurements[ZoneType.YAxisTitle] = cfg.yLabel ? axisTitleHeight : 0;
    measurements[ZoneType.XAxisTitle] = cfg.xLabel ? axisTitleHeight : 0;

    // Legend zone — scatter can have multiple series
    const legendHeight = this.measureLegendZone(containerWidth);
    if (legendHeight !== undefined) {
      measurements[ZoneType.Legend] = legendHeight;
    }

    // Footer zone
    measurements[ZoneType.FooterText] = this.measureFooterZone(
      containerWidth,
      measurements[ZoneType.YAxisLabels] ?? 0,
    );

    return measurements;
  }

  private measureZoneSizes(
    containerWidth: number,
    containerHeight: number,
    isHorizontal: boolean
  ): Partial<Record<ZoneType, number>> {
    if (this.scaffoldConfig.mode !== 'categorical') {
      return this.measureNumericZoneSizes(containerWidth, containerHeight);
    }

    const { categories } = this.scaffoldConfig;
    const [minValue, maxValue] = this.scaffoldConfig.valueRange;
    const isPercent = this.scaffoldConfig.chartType === 'percentVerticalBar' || this.scaffoldConfig.chartType === 'percentHorizontalBar';
    const [paddedMin, paddedMax] = getCategoricalValuePadding(
      this.scaffoldConfig.chartType,
      this.config,
      minValue,
      maxValue,
      isPercent,
    );

    const xAxisMeasurement = createSvgTextMeasurement(this.svg, {
      parentClass: 'jsc-axis-x',
      fontFamily: this.theme.fontFamily,
      fontSize: this.theme.fontSizeTick,
      fallbackCharWidth: AXIS_LABEL_CHAR_WIDTH,
      fallbackLineHeight: (Number.parseFloat(this.theme.fontSizeTick) || 12) * 1.2,
    });
    const yAxisMeasurement = createSvgTextMeasurement(this.svg, {
      parentClass: 'jsc-axis-y',
      fontFamily: this.theme.fontFamily,
      fontSize: this.theme.fontSizeTick,
      fallbackCharWidth: AXIS_LABEL_CHAR_WIDTH,
      fallbackLineHeight: (Number.parseFloat(this.theme.fontSizeTick) || 12) * 1.2,
    });
    const measurementContext = createZoneMeasurementContext(this.svg, this.config, this.theme, {
      xAxis: xAxisMeasurement,
      yAxis: yAxisMeasurement,
    });
    const measurementOptions = {
      chartType: this.scaffoldConfig.chartType,
      categories,
      categoryLabels: this.scaffoldConfig.categoryLabels,
      valueRange: this.scaffoldConfig.valueRange,
      isHorizontal,
      timeSeriesLabels: this.scaffoldConfig.timeSeriesLabels,
      xLabel: this.scaffoldConfig.xLabel,
      yLabel: this.scaffoldConfig.yLabel,
      isPercent,
      paddedValueRange: [paddedMin, paddedMax] as [number, number],
      zeroBaselineForced: isCategoricalValueAxisZeroForced(
        this.scaffoldConfig.chartType,
        this.config,
      ),
    };

    const measurements: Partial<Record<ZoneType, number>> = {};

    // Header zone — estimate lines for title wrapping
    measurements[ZoneType.Header] = this.measureHeaderZone(containerWidth);

    // Y-axis labels zone
    measurements[ZoneType.YAxisLabels] = measureCategoricalYAxisLabels(
      measurementContext,
      measurementOptions,
      containerWidth,
      containerHeight,
    );

    // RightMargin zone — for line charts and horizontal bar charts, reserves space so edge labels don't clip
    measurements[ZoneType.RightMargin] = measureCategoricalRightMargin(
      measurementContext,
      measurementOptions,
      containerWidth,
      measurements[ZoneType.YAxisLabels] ?? 60,
    );

    // X-axis labels zone
    measurements[ZoneType.XAxisLabels] = measureCategoricalXAxisLabels(
      measurementContext,
      measurementOptions,
      containerWidth,
      measurements[ZoneType.YAxisLabels] ?? 60,
      measurements[ZoneType.RightMargin] ?? 0,
    );

    // Axis title zones
    const axisTitles = measureCategoricalAxisTitles(measurementContext, measurementOptions);
    measurements[ZoneType.YAxisTitle] = axisTitles.yAxisTitle;
    measurements[ZoneType.XAxisTitle] = axisTitles.xAxisTitle;

    // Legend zone — estimate rows based on items fitting container width
    const legendHeight = this.measureLegendZone(containerWidth);
    if (legendHeight !== undefined) {
      measurements[ZoneType.Legend] = legendHeight;
    }

    // Footer zone — always stacked
    measurements[ZoneType.FooterText] = this.measureFooterZone(
      containerWidth,
      measurements[ZoneType.YAxisLabels] ?? 0,
    );

    xAxisMeasurement.destroy();
    yAxisMeasurement.destroy();

    return measurements;
  }

  private fitHorizontalCategoryLabels(
    categories: string[],
    labelTexts: string[],
    yScale: YScale,
    layout: LayoutResult,
    plotAreaRect: ZoneRect,
    textMetrics: LabelTextMetrics,
  ): LabelFitResult {
    const labelZoneWidth = layout.zones.get(ZoneType.YAxisLabels)?.width
      ?? HORIZONTAL_LABEL_FALLBACK_WIDTH;
    const labelWidth = Math.max(0, labelZoneWidth - HORIZONTAL_LABEL_TICK_MARGIN);
    let fittedLabels = fitLabels(
      labelTexts,
      labelWidth,
      labelWidth,
      AXIS_LABEL_CHAR_WIDTH,
      undefined,
      textMetrics,
    );
    const lineHeight = (Number.parseFloat(this.theme.fontSizeTick) || 12)
      * HORIZONTAL_LABEL_LINE_HEIGHT;
    const categoryBandHeight = (yScale as ScaleBand<string>).bandwidth();
    const maxLabelLines = Math.max(
      1,
      Math.min(HORIZONTAL_LABEL_MAX_LINES, Math.floor(categoryBandHeight / lineHeight)),
    );
    const maxVisibleLabels = Math.max(
      1,
      Math.floor(plotAreaRect.height / (lineHeight * maxLabelLines)),
    );
    const visibleLabelIndices = new Set<number>();

    if (categories.length <= maxVisibleLabels) {
      categories.forEach((_category, index) => visibleLabelIndices.add(index));
    } else if (categories.length === 1) {
      visibleLabelIndices.add(0);
    } else {
      const visibleCount = Math.max(2, maxVisibleLabels);
      for (let position = 0; position < visibleCount; position++) {
        visibleLabelIndices.add(Math.round(
          position * (categories.length - 1) / (visibleCount - 1),
        ));
      }
    }

    fittedLabels = {
      ...fittedLabels,
      skipInterval: categories.length > maxVisibleLabels
        ? Math.ceil((categories.length - 1) / Math.max(maxVisibleLabels - 1, 1))
        : 1,
      labels: fittedLabels.labels.map((label, index) => {
        let lines = label.lines;
        let wasTruncated = label.truncated;
        if (lines.length > maxLabelLines) {
          const preservedLines = lines.slice(0, maxLabelLines - 1);
          const remainingText = lines.slice(maxLabelLines - 1).join(' ');
          const truncated = truncateLabel(
            remainingText,
            labelWidth,
            AXIS_LABEL_CHAR_WIDTH,
          );
          lines = [...preservedLines, truncated.text];
          wasTruncated = true;
        }
        return {
          ...label,
          lines,
          truncated: wasTruncated,
          skip: !visibleLabelIndices.has(index),
        };
      }),
    };

    if (this.scaffoldConfig.chartType !== 'pyramid') return fittedLabels;

    const pyramidMaxVisibleLabels = Math.max(
      1,
      Math.floor(
        plotAreaRect.height / (lineHeight * PYRAMID_LABEL_HEIGHT_MULTIPLIER),
      ),
    );
    let visibleLabelCount = Math.min(
      categories.length,
      categories.length > 1 ? Math.max(2, pyramidMaxVisibleLabels) : 1,
    );
    if (visibleLabelCount >= categories.length) return fittedLabels;

    const lastIndex = categories.length - 1;
    while (
      visibleLabelCount > 2
      && Math.ceil(lastIndex / (visibleLabelCount - 1))
        / Math.floor(lastIndex / (visibleLabelCount - 1)) > PYRAMID_SKIP_BALANCE_RATIO
    ) {
      visibleLabelCount--;
    }
    const selectedIndices = new Set(Array.from(
      { length: visibleLabelCount },
      (_, position) => Math.round(position * lastIndex / (visibleLabelCount - 1)),
    ));
    return {
      ...fittedLabels,
      skipInterval: Math.ceil(lastIndex / (visibleLabelCount - 1)),
      labels: fittedLabels.labels.map((label, index) => ({
        ...label,
        skip: !selectedIndices.has(index),
      })),
    };
  }

  private renderCategoricalContent(
    layout: LayoutResult,
    plotAreaRect: ZoneRect,
    isHorizontal: boolean,
  ): RenderedScales {
    if (this.scaffoldConfig.mode !== 'categorical') {
      throw new Error('Categorical rendering requires categorical scaffold configuration');
    }

    const { categories, valueRange } = this.scaffoldConfig;
    const [minValue, maxValue] = valueRange;
    const isPercent = this.scaffoldConfig.chartType === 'percentVerticalBar'
      || this.scaffoldConfig.chartType === 'percentHorizontalBar';
    const [paddedMin, paddedMax] = getCategoricalValuePadding(
      this.scaffoldConfig.chartType,
      this.config,
      minValue,
      maxValue,
      isPercent,
    );
    const forceZeroBaseline = isCategoricalValueAxisZeroForced(
      this.scaffoldConfig.chartType,
      this.config,
    );
    const axisLength = isHorizontal ? plotAreaRect.width : plotAreaRect.height;
    const rawTicks = getTickPositions(
      paddedMin,
      paddedMax,
      axisLength,
      undefined,
      this.theme.fontSizeTick,
      forceZeroBaseline,
    );
    const tickValues = rawTicks.length >= 2 ? rawTicks : [paddedMin, paddedMax];
    const scaleType = this.scaffoldConfig.chartType === 'line' ? 'point' : 'band';
    const { xScale, yScale } = this.buildScales(
      isHorizontal,
      categories,
      paddedMin,
      paddedMax,
      plotAreaRect,
      tickValues,
      scaleType,
    );

    const labelTexts = this.scaffoldConfig.categoryLabels ?? categories;
    const axisTextMeasurement = createSvgTextMeasurement(this.svg, {
      parentClass: isHorizontal ? 'jsc-axis-y' : 'jsc-axis-x',
      fontFamily: this.theme.fontFamily,
      fontSize: this.theme.fontSizeTick,
      fallbackCharWidth: AXIS_LABEL_CHAR_WIDTH,
      fallbackLineHeight: (Number.parseFloat(this.theme.fontSizeTick) || 12) * 1.2,
    });
    let fittedLabels: LabelFitResult;
    if (isHorizontal) {
      fittedLabels = this.fitHorizontalCategoryLabels(
        categories,
        labelTexts,
        yScale,
        layout,
        plotAreaRect,
        axisTextMeasurement,
      );
    } else {
      const slotDivisor = this.scaffoldConfig.chartType === 'line'
        ? Math.max(categories.length - 1, 1)
        : Math.max(categories.length, 1);
      fittedLabels = fitLabels(
        labelTexts,
        plotAreaRect.width,
        plotAreaRect.width / slotDivisor,
        AXIS_LABEL_CHAR_WIDTH,
        this.scaffoldConfig.timeSeriesLabels,
        axisTextMeasurement,
      );
    }

    this.renderHeader(layout);
    if (this.scaffoldConfig.chartType !== 'pie') {
      this.renderGrid(isHorizontal, xScale, yScale, plotAreaRect, tickValues);
    }
    this.renderAxes(
      isHorizontal,
      xScale,
      yScale,
      layout,
      plotAreaRect,
      { tickValues, fittedLabels, textMetrics: axisTextMeasurement },
    );
    axisTextMeasurement.destroy();
    this.renderAxisTitles(isHorizontal, layout);
    this.renderFooter(layout);
    this.renderLegend(layout);

    return { xScale, yScale };
  }

  private renderNumericContent(
    layout: LayoutResult,
    plotAreaRect: ZoneRect,
  ): RenderedScales {
    if (this.scaffoldConfig.mode !== 'numeric') {
      throw new Error('Numeric rendering requires numeric scaffold configuration');
    }

    const [xRawMin, xRawMax] = this.scaffoldConfig.xValueRange;
    const [yRawMin, yRawMax] = this.scaffoldConfig.yValueRange;
    const yForceZeroBaseline = isNumericValueAxisZeroForced(this.scaffoldConfig.config);
    const [xPadMin, xPadMax] = padValueRange(xRawMin, xRawMax);
    const [yPadMin, yPadMax] = yForceZeroBaseline
      ? padValueRange(yRawMin, yRawMax)
      : padNumericRange(yRawMin, yRawMax);
    const xRawTicks = getTickPositions(
      xPadMin,
      xPadMax,
      plotAreaRect.width,
      undefined,
      this.theme.fontSizeTick,
      true,
    );
    const yRawTicks = getTickPositions(
      yPadMin,
      yPadMax,
      plotAreaRect.height,
      undefined,
      this.theme.fontSizeTick,
      yForceZeroBaseline,
    );
    const xTickValues = xRawTicks.length >= 2 ? xRawTicks : [xPadMin, xPadMax];
    const yTickValues = yRawTicks.length >= 2 ? yRawTicks : [yPadMin, yPadMax];
    const xScale = scaleLinear()
      .domain([xTickValues[0], xTickValues.at(-1) as number])
      .range([0, plotAreaRect.width]);
    const yScale = scaleLinear()
      .domain([yTickValues[0], yTickValues.at(-1) as number])
      .range([plotAreaRect.height, 0]);

    this.renderHeader(layout);
    this.renderNumericGrid(xScale, yScale, plotAreaRect, xTickValues, yTickValues);
    this.renderNumericAxes(xScale, yScale, layout, plotAreaRect, xTickValues, yTickValues);
    this.renderAxisTitles(false, layout);
    this.renderFooter(layout);
    this.renderLegend(layout);

    return { xScale, yScale };
  }

  render(): ScaffoldRenderContext {
    this.theme = resolveTheme(this.container, this.config.theme);
    // colorFocusRing is consumed via var(--jsc-color-focus-ring) in injected <style>
    // elements (bindInteractions.ts, legend.ts). Only set the inline property when the
    // user explicitly provides it via JS config, so CSS-only theming remains authoritative.
    if (this.config.theme?.colorFocusRing) {
      this.container.style.setProperty('--jsc-color-focus-ring', this.theme.colorFocusRing);
    } else {
      this.container.style.removeProperty('--jsc-color-focus-ring');
    }
    this.legend?.destroy();
    this.legend = null;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const isHorizontal = HORIZONTAL_CHART_TYPES.has(this.scaffoldConfig.chartType);

    const zones = createZones({
      chartType: this.scaffoldConfig.chartType,
      showHeader: this.scaffoldConfig.config.showHeader ?? false,
      showLegend: this.scaffoldConfig.config.showLegend ?? true,
      seriesCount: this.scaffoldConfig.seriesCount,
      hasBurgerMenu: this.scaffoldConfig.config.burgerMenuVisible,
      hasHeaderContent: this.scaffoldConfig.config.showHeader !== false && Boolean(
        this.scaffoldConfig.config.title?.trim() || this.scaffoldConfig.config.subtitle?.trim(),
      ),
    });
    const measurements = this.measureZoneSizes(width, height, isHorizontal);
    const measuredZones = applyMeasuredSizes(zones, measurements);
    const layout = computeLayout(width, height, measuredZones);

    const svgElement = this.svg.node();
    if (svgElement) applyInteractiveChartAriaAttributes(svgElement, this.config.locale);
    this.svg.attr('viewBox', `0 0 ${width} ${height}`);
    captureChartFocusBeforeRedraw(this.container);
    this.svg.selectAll('*').remove();

    const plotAreaRect = layout.zones.get(ZoneType.PlotArea) ?? {
      x: 0,
      y: 0,
      width: Math.max(0, width),
      height: Math.max(0, height),
    };

    // Clip path for plot area
    this.svg
      .append('defs')
      .append('clipPath')
      .attr('id', this.clipPathId)
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', plotAreaRect.width)
      .attr('height', plotAreaRect.height);

    const { xScale, yScale } = this.scaffoldConfig.mode === 'categorical'
      ? this.renderCategoricalContent(layout, plotAreaRect, isHorizontal)
      : this.renderNumericContent(layout, plotAreaRect);

    // Plot area group for chart renderers
    this.svg
      .append('g')
      .attr('class', 'jsc-plot-area')
      .attr('transform', `translate(${plotAreaRect.x},${plotAreaRect.y})`)
      .attr('clip-path', `url(#${this.clipPathId})`);

    const context: ScaffoldRenderContext = { svg: this.svg, plotArea: plotAreaRect, theme: this.theme, xScale, yScale, layout };

    const activeLegend = this.legend as Legend | null;
    if (activeLegend) {
      context.setSeriesToggle = (cb) => activeLegend.setToggleCallback(cb);
      context.setLegendItemStates = (states) => activeLegend.setItemStates(states);
    }

    if (this.renderCallback !== null) {
      this.renderCallback(context);
    }

    this.textMetricFingerprint = this.captureTextMetricFingerprint();

    return context;
  }

  onRender(callback: (ctx: ScaffoldRenderContext) => void): void {
    this.renderCallback = callback;
  }

  update(config: ChartScaffoldConfig): ScaffoldRenderContext {
    this.scaffoldConfig = config;
    this.container = config.container;
    this.config = config.config;
    this.chartType = config.chartType;
    this.theme = resolveTheme(this.container, config.config.theme);
    return this.render();
  }

  destroy(): void {
    if (this.resizeObserver !== null) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.textStyleObserver !== null) {
      this.textStyleObserver.disconnect();
      this.textStyleObserver = null;
    }
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.textMetricTimer !== null) {
      clearTimeout(this.textMetricTimer);
      this.textMetricTimer = null;
    }
    this.legend?.destroy();
    this.legend = null;
    this.svg.node()?.remove();
    this.container.style.overflow = this.originalOverflow;
  }
}
