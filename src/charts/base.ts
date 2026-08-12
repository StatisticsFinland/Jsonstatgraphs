import { select, Selection } from 'd3-selection';
import { scaleLinear, scaleBand, scalePoint, ScaleLinear, ScaleBand, ScalePoint } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { ChartType, ChartConfig, ResolvedTheme, ZoneType, ZoneRect, LayoutResult } from '../types';
import { renderSvgFooter } from './footer';
import { Legend } from '../interaction/legend';
import { getTickPositions } from '../layout/tick-positions';
import { fitLabels, LabelFitResult, NiceSkipOptions } from '../layout/label-fitting';
import { resolveTheme } from '../theme/theme';
import { createZones, applyMeasuredSizes, PLOT_AREA_MIN_SIZE } from '../layout/zones';
import { computeLayout } from '../layout/layout-engine';

type XScale = ScaleBand<string> | ScalePoint<string> | ScaleLinear<number, number>;
type YScale = ScaleLinear<number, number> | ScaleBand<string> | ScalePoint<string>;

/** Size (px) of the tick marks on the X-axis. */
const X_AXIS_TICK_SIZE = 8;
/** Gap (px) between the X-axis tick mark and the label text. */
const X_AXIS_TICK_LABEL_GAP = 4;

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

export class ChartScaffold {
  private container: HTMLElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private theme: ResolvedTheme;
  private resizeObserver: ResizeObserver | null = null;
  private config: ChartConfig;
  private chartType: ChartType;
  private scaffoldConfig: ChartScaffoldConfig;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
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
  }

  /**
   * Pad the value range so that getTickPositions naturally picks a tick
   * value beyond the data maximum (or below the data minimum).
   * Only pads the side away from zero — bar charts anchor at zero.
   */
  private padValueRange(min: number, max: number): [number, number] {
    const range = max - min;
    if (range <= 0) return [min, max];
    const headroom = range * 0.05;
    // Only pad the side away from zero
    const paddedMin = min < 0 ? min - headroom : min;
    const paddedMax = max > 0 ? max + headroom : max;
    return [paddedMin, paddedMax];
  }

  /** Symmetric 5% padding on both sides of a numeric range. */
  private padNumericRange(min: number, max: number): [number, number] {
    if (min === max) return [min - 1, max + 1];
    const pad = (max - min) * 0.05;
    return [min - pad, max + pad];
  }

  /**
   * Whether the categorical value axis must be anchored at 0. False only for line charts
   * with `cutValueAxis` enabled, letting the axis start/end away from zero.
   */
  private isCategoricalValueAxisZeroForced(): boolean {
    return !(this.scaffoldConfig.chartType === 'line' && this.scaffoldConfig.config.cutValueAxis === true);
  }

  /** Whether the numeric (scatter) value axis must be anchored at 0. False only when `cutValueAxis` is enabled. */
  private isNumericValueAxisZeroForced(cfg: NumericScaffoldConfig): boolean {
    return cfg.config.cutValueAxis !== true;
  }

  /** Pads the categorical value range, using symmetric padding when the axis isn't zero-anchored. */
  private getCategoricalValuePadding(minValue: number, maxValue: number, isPercent: boolean): [number, number] {
    if (isPercent) return [minValue, maxValue];
    return this.isCategoricalValueAxisZeroForced()
      ? this.padValueRange(minValue, maxValue)
      : this.padNumericRange(minValue, maxValue);
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
    const domainMin = tickValues && tickValues.length >= 2 ? tickValues[0] : minValue;
    const domainMax = tickValues && tickValues.length >= 2 ? tickValues.at(-1) as number : maxValue;

    if (isHorizontal) {
      return {
        xScale: scaleLinear()
          .domain([domainMin, domainMax])
          .range([0, plotAreaRect.width]),
        yScale: scaleBand<string>()
          .domain(categories)
          .range([0, plotAreaRect.height])
          .padding(0.2)
          .paddingOuter(0.5),
      };
    }
    if (scaleType === 'point') {
      return {
        xScale: scalePoint<string>()
          .domain(categories)
          .range([0, plotAreaRect.width])
          .padding(0),
        yScale: scaleLinear()
          .domain([domainMin, domainMax])
          .range([plotAreaRect.height, 0]),
      };
    }
    return {
      xScale: scaleBand<string>()
        .domain(categories)
        .range([0, plotAreaRect.width])
        .padding(0.2)
        .paddingOuter(0.5),
      yScale: scaleLinear()
        .domain([domainMin, domainMax])
        .range([plotAreaRect.height, 0]),
    };
  }

  private renderHeader(layout: LayoutResult): void {
    const headerRect = layout.zones.get(ZoneType.Header);
    if (!headerRect) return;

    const { title, subtitle } = this.scaffoldConfig.config;
    const headerGroup = this.svg.append('g').attr('class', 'jsc-header').attr('aria-hidden', 'true');

    const CHAR_WIDTH = 8;
    const LINE_HEIGHT = 1.25; // em
    const PADDING = 20; // px per side
    const maxWidth = headerRect.width - PADDING * 2;

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
        .call(axisLeft(yScale).tickValues(yTickValues) as never)
        .call(styleAxis);
    }

    if (layout.zones.has(ZoneType.XAxisLabels)) {
      const xAxisGroup = this.svg
        .append('g')
        .attr('class', 'jsc-axis-x')
        .attr('aria-hidden', 'true')
        .attr('transform', `translate(${plotAreaRect.x},${plotAreaRect.y + plotAreaRect.height})`);
      xAxisGroup
        .call(axisBottom(xScale).tickValues(xTickValues) as never)
        .call(styleAxis);
    }
  }

  private renderAxes(
    isHorizontal: boolean,
    xScale: XScale,
    yScale: YScale,
    layout: LayoutResult,
    plotAreaRect: ZoneRect,
    tickValues: number[],
    fittedLabels: LabelFitResult
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

      if (isHorizontal) {
        yAxisGroup.call(axisLeft(yScale as ScaleBand<string>) as never).call(styleAxis);
        // Replace D3's default tick text with fitted labels for horizontal band (Y) axis
        yAxisGroup.selectAll('.tick text').remove();
        yAxisGroup.selectAll<SVGGElement, unknown>('.tick').each(function(_d, i) {
          const fitted = fittedLabels.labels[i];
          if (!fitted || fitted.skip) {
            select(this).style('display', 'none');
            return;
          }
          const text = select(this).append('text')
            .attr('dx', '-9')
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '')
            .attr('font-family', '')
            .attr('fill', '');
          const totalLines = fitted.lines.length;
          for (let lineIdx = 0; lineIdx < totalLines; lineIdx++) {
            const lineOffset = (lineIdx - (totalLines - 1) / 2) * 1.1;
            text.append('tspan')
              .attr('x', -9)
              .attr('dy', lineIdx === 0 ? `${lineOffset}em` : '1.1em')
              .text(fitted.lines[lineIdx]);
          }
        });
        // Re-apply axis styles after custom text injection
        yAxisGroup.call(styleAxis);
      } else {
        yAxisGroup
          .call(axisLeft(yScale as ScaleLinear<number, number>).tickValues(tickValues) as never)
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
        const axis = axisBottom(xScale as ScaleLinear<number, number>).tickValues(tickValues);
        if (this.scaffoldConfig.chartType === 'pyramid') {
          const fmt = (xScale as ScaleLinear<number, number>).tickFormat(tickValues.length);
          axis.tickFormat((d) => fmt(Math.abs(d as number)));
        }
        xAxisGroup
          .call(axis as never)
          .call(styleAxis);
      } else {
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
            text.append('tspan')
              .attr('x', 0)
              .attr('dy', lineIdx === 0 ? '0' : '1.1em')
              .text(fitted.lines[lineIdx]);
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
      const xAxisTitle = isHorizontal
        ? this.scaffoldConfig.yLabel
        : this.scaffoldConfig.xLabel;

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

    const tickFontSize = Number.parseFloat(this.theme.fontSizeTick) || 12;
    const lineHeight = Math.ceil(tickFontSize * 1.4);

    const plotAreaRect = layout.zones.get(ZoneType.PlotArea);
    const footerX = plotAreaRect ? plotAreaRect.x : footerRect.x;

    renderSvgFooter({
      parent: this.svg,
      footerItems,
      sourceLink: this.scaffoldConfig.config.sourceLink,
      theme: this.theme,
      x: footerX,
      y: footerRect.y,
      lineHeight,
    });
  }

  private renderLegend(layout: LayoutResult): void {
    this.legend?.destroy();
    this.legend = null;

    const legendRect = layout.zones.get(ZoneType.Legend);
    if (!legendRect) return;

    const { seriesCount, seriesNames } = this.scaffoldConfig;
    const names: string[] = seriesNames && seriesNames.length > 0
      ? seriesNames
      : Array.from({ length: seriesCount }, (_, i) => `Series ${i + 1}`);

    this.legend = new Legend(this.container, names, this.theme, {
      accessibilityMode: this.config.accessibilityMode,
      chartType: this.scaffoldConfig.chartType,
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
    const CHAR_WIDTH = 8;
    const { config } = this.scaffoldConfig;
    const titleFontSize = Number.parseFloat(this.theme.fontSizeTitle) || 16;
    const subtitleFontSize = Number.parseFloat(this.theme.fontSizeLabel) || 14;
    const TITLE_LINE_HEIGHT = titleFontSize * 1.25;
    const SUBTITLE_LINE_HEIGHT = subtitleFontSize * 1.25;
    const HEADER_PADDING = 12;
    if (config.title) {
      const titleMaxWidth = containerWidth - 40; // 20px padding each side

      // Create temp text for measurement
      const tempText = this.svg.append('text')
        .attr('font-size', this.theme.fontSizeTitle)
        .attr('font-family', this.theme.fontFamily)
        .attr('font-weight', this.theme.fontWeightBold)
        .attr('visibility', 'hidden');
      const textNode = tempText.node()!;
      textNode.textContent = config.title;
      let titleWidth: number;
      try {
        const computed = textNode.getComputedTextLength();
        titleWidth = computed > 0 ? computed : config.title.length * CHAR_WIDTH;
      } catch {
        titleWidth = config.title.length * CHAR_WIDTH;
      }
      tempText.remove();
      const titleLineCount = titleMaxWidth > 0
        ? Math.max(1, Math.ceil(titleWidth / titleMaxWidth))
        : 1;
      let headerHeight = titleLineCount * TITLE_LINE_HEIGHT + HEADER_PADDING;
      if (config.subtitle) {
        headerHeight += SUBTITLE_LINE_HEIGHT;
      }
      return headerHeight;
    } else if (config.subtitle) {
      return SUBTITLE_LINE_HEIGHT + HEADER_PADDING;
    } else {
      return config.burgerMenuVisible ? 48 : 0;
    }
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
  private measureFooterZone(): number {
    const { config } = this.scaffoldConfig;
    // Footer zone — always stacked
    if (config.footerItems && config.footerItems.length > 0) {
      const footerTickFontSize = Number.parseFloat(this.theme.fontSizeTick) || 12;
      const FOOTER_LINE_HEIGHT = Math.ceil(footerTickFontSize * 1.4); // ~17px at default 12px tick font
      return config.footerItems.length * FOOTER_LINE_HEIGHT + 4;
    }
    return 0;
  }

  /** Measures the Y-axis label zone width for categorical charts. */
  private measureCategoricalYAxisLabels(
    isHorizontal: boolean,
    containerWidth: number,
    containerHeight: number,
    paddedMin: number,
    paddedMax: number,
    labelTexts: string[]
  ): number {
    const CHAR_WIDTH = 8;
    if (isHorizontal) {
      // Band axis on Y — fit labels against available width (capped at 40% container)
      const maxWidth = containerWidth * 0.4;
      const fitResult = fitLabels(labelTexts, maxWidth, maxWidth, CHAR_WIDTH);
      let maxLineWidth = 0;
      for (const label of fitResult.labels) {
        for (const line of label.lines) {
          maxLineWidth = Math.max(maxLineWidth, line.length * CHAR_WIDTH);
        }
      }
      return maxLineWidth + 16; // +16 for tick mark + margin
    } else {
      // Linear axis on Y — estimate tick label width from a rough axis height pass
      const estimatedAxisHeight = containerHeight * 0.6;
      const ticks = getTickPositions(paddedMin, paddedMax, estimatedAxisHeight, undefined, this.theme.fontSizeTick, this.isCategoricalValueAxisZeroForced());
      const fmt = scaleLinear().domain([paddedMin, paddedMax]).tickFormat();
      const maxTickLen = ticks.reduce((max, t) => Math.max(max, fmt(t).length), 0);
      return maxTickLen * CHAR_WIDTH + 16;
    }
  }

  /** Measures the right-margin zone width for categorical charts. */
  private measureCategoricalRightMargin(
    categories: string[],
    containerWidth: number,
    yAxisWidth: number,
    paddedMin: number,
    paddedMax: number
  ): number {
    const CHAR_WIDTH = 8;
    // RightMargin zone — for line charts and horizontal bar charts, reserves space so edge labels don't clip
    if (this.scaffoldConfig.chartType === 'line') {
      const n = categories.length;
      const preMarginPlotWidth = containerWidth - yAxisWidth;
      if (n > 1 && preMarginPlotWidth > 0) {
        const slotWidth = preMarginPlotWidth / (n - 1);
        return Math.max(0, Math.min(Math.ceil(slotWidth / 2), 40));
      } else {
        return 0;
      }
    } else if (HORIZONTAL_CHART_TYPES.has(this.scaffoldConfig.chartType)) {
      const estimatedPlotWidth = containerWidth - yAxisWidth;
      const ticks = getTickPositions(paddedMin, paddedMax, estimatedPlotWidth, undefined, this.theme.fontSizeTick);
      if (ticks.length > 0) {
        const lastTick = ticks.at(-1)!;
        const hFmt = scaleLinear().domain([paddedMin, paddedMax]).tickFormat();
        return Math.min(Math.ceil(hFmt(lastTick).length * CHAR_WIDTH / 2), 40);
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  }

  /** Measures the X-axis label zone height for categorical charts. */
  private measureCategoricalXAxisLabels(
    isHorizontal: boolean,
    categories: string[],
    labelTexts: string[],
    containerWidth: number,
    yAxisWidthEstimate: number,
    rightMarginEstimate: number,
    timeSeriesLabels?: NiceSkipOptions
  ): number {
    const CHAR_WIDTH = 8;
    if (isHorizontal) {
      // Linear axis on X — single line of numbers
      return 24;
    } else {
      // Band/point axis on X — use fitLabels to estimate
      const isLine = this.scaffoldConfig.chartType === 'line';
      const slotDivisor = isLine
        ? Math.max(categories.length - 1, 1)
        : Math.max(categories.length, 1);
      // For line charts, estimate the actual plot width (after YAxis and RightMargin deductions)
      const estimatedPlotWidth = Math.max(PLOT_AREA_MIN_SIZE, containerWidth - yAxisWidthEstimate - rightMarginEstimate);
      const availableWidth = isLine ? estimatedPlotWidth : containerWidth;
      const slotWidth = availableWidth / slotDivisor;
      const fitResult = fitLabels(labelTexts, availableWidth, slotWidth, CHAR_WIDTH, timeSeriesLabels);
      return fitResult.zoneSizeNeeded + X_AXIS_TICK_SIZE + X_AXIS_TICK_LABEL_GAP;
    }
  }

  private measureNumericZoneSizes(
    containerWidth: number,
    containerHeight: number
  ): Partial<Record<ZoneType, number>> {
    const cfg = this.scaffoldConfig as NumericScaffoldConfig;
    const CHAR_WIDTH = 8;
    const measurements: Partial<Record<ZoneType, number>> = {};

    // Header zone — same logic as categorical
    measurements[ZoneType.Header] = this.measureHeaderZone(containerWidth);

    // Y-axis labels — estimated from numeric tick labels
    const [xMin, xMax] = cfg.xValueRange;
    const [yMin, yMax] = cfg.yValueRange;

    const xPadded = this.padNumericRange(xMin, xMax);
    const yPadded = this.padNumericRange(yMin, yMax);
    const yForceZeroBaseline = this.isNumericValueAxisZeroForced(cfg);

    const estimatedAxisHeight = containerHeight * 0.6;
    const yTicks = getTickPositions(yPadded[0], yPadded[1], estimatedAxisHeight, undefined, this.theme.fontSizeTick, yForceZeroBaseline);
    const yFmt = scaleLinear().domain(yPadded).tickFormat();
    const maxYTickLen = yTicks.reduce((max, t) => Math.max(max, yFmt(t).length), 0);
    measurements[ZoneType.YAxisLabels] = maxYTickLen * CHAR_WIDTH + 16;

    // X-axis labels — single line of numeric ticks
    measurements[ZoneType.XAxisLabels] = 24;

    // Right margin — from last X tick label
    const yAxisWidth = measurements[ZoneType.YAxisLabels] ?? 60;
    const estimatedPlotWidth = Math.max(100, containerWidth - yAxisWidth);
    const xTicks = getTickPositions(xPadded[0], xPadded[1], estimatedPlotWidth, undefined, this.theme.fontSizeTick, false);
    if (xTicks.length > 0) {
      const xFmt = scaleLinear().domain(xPadded).tickFormat();
      const lastTickStr = xFmt(xTicks.at(-1)!);
      measurements[ZoneType.RightMargin] = Math.min(Math.ceil(lastTickStr.length * CHAR_WIDTH / 2), 40);
    } else {
      measurements[ZoneType.RightMargin] = 0;
    }

    // Axis title zones
    measurements[ZoneType.YAxisTitle] = cfg.yLabel ? 25 : 0;
    measurements[ZoneType.XAxisTitle] = cfg.xLabel ? 25 : 0;

    // Legend zone — scatter can have multiple series
    const legendHeight = this.measureLegendZone(containerWidth);
    if (legendHeight !== undefined) {
      measurements[ZoneType.Legend] = legendHeight;
    }

    // Footer zone
    measurements[ZoneType.FooterText] = this.measureFooterZone();

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
    const [paddedMin, paddedMax] = this.getCategoricalValuePadding(minValue, maxValue, isPercent);

    const measurements: Partial<Record<ZoneType, number>> = {};

    const labelTexts = this.scaffoldConfig.categoryLabels ?? categories;

    // Header zone — estimate lines for title wrapping
    measurements[ZoneType.Header] = this.measureHeaderZone(containerWidth);

    // Y-axis labels zone
    measurements[ZoneType.YAxisLabels] = this.measureCategoricalYAxisLabels(
      isHorizontal, containerWidth, containerHeight, paddedMin, paddedMax, labelTexts
    );

    // RightMargin zone — for line charts and horizontal bar charts, reserves space so edge labels don't clip
    measurements[ZoneType.RightMargin] = this.measureCategoricalRightMargin(
      categories, containerWidth, measurements[ZoneType.YAxisLabels] ?? 60, paddedMin, paddedMax
    );

    // X-axis labels zone
    measurements[ZoneType.XAxisLabels] = this.measureCategoricalXAxisLabels(
      isHorizontal, categories, labelTexts, containerWidth,
      measurements[ZoneType.YAxisLabels] ?? 60,
      measurements[ZoneType.RightMargin] ?? 0,
      this.scaffoldConfig.timeSeriesLabels
    );

    // Axis title zones
    const yAxisTitleLabel = isHorizontal ? this.scaffoldConfig.xLabel : this.scaffoldConfig.yLabel;
    const xAxisTitleLabel = isHorizontal ? this.scaffoldConfig.yLabel : this.scaffoldConfig.xLabel;
    measurements[ZoneType.YAxisTitle] = yAxisTitleLabel ? 25 : 0;
    measurements[ZoneType.XAxisTitle] = xAxisTitleLabel ? 25 : 0;

    // Legend zone — estimate rows based on items fitting container width
    const legendHeight = this.measureLegendZone(containerWidth);
    if (legendHeight !== undefined) {
      measurements[ZoneType.Legend] = legendHeight;
    }

    // Footer zone — always stacked
    measurements[ZoneType.FooterText] = this.measureFooterZone();

    return measurements;
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
      hasBurgerMenu: this.scaffoldConfig.burgerMenuVisible,
      hasHeaderContent: Boolean(
        this.scaffoldConfig.config.title?.trim() || this.scaffoldConfig.config.subtitle?.trim(),
      ),
    });
    const measurements = this.measureZoneSizes(width, height, isHorizontal);
    const measuredZones = applyMeasuredSizes(zones, measurements);
    const layout = computeLayout(width, height, measuredZones);

    this.svg.attr('viewBox', `0 0 ${width} ${height}`);
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

    let xScale: XScale;
    let yScale: YScale;

    if (this.scaffoldConfig.mode === 'categorical') {
      const { categories, valueRange } = this.scaffoldConfig;
      const [minValue, maxValue] = valueRange;
      const isPercent = this.scaffoldConfig.chartType === 'percentVerticalBar' || this.scaffoldConfig.chartType === 'percentHorizontalBar';
      const [paddedMin, paddedMax] = this.getCategoricalValuePadding(minValue, maxValue, isPercent);
      const forceZeroBaseline = this.isCategoricalValueAxisZeroForced();

      const rawTicks = isHorizontal
        ? getTickPositions(paddedMin, paddedMax, plotAreaRect.width, undefined, this.theme.fontSizeTick, forceZeroBaseline)
        : getTickPositions(paddedMin, paddedMax, plotAreaRect.height, undefined, this.theme.fontSizeTick, forceZeroBaseline);
      const tickValues = rawTicks.length >= 2 ? rawTicks : [paddedMin, paddedMax];

      const scaleType = this.scaffoldConfig.chartType === 'line' ? 'point' : 'band';
      const result = this.buildScales(
        isHorizontal,
        categories,
        paddedMin,
        paddedMax,
        plotAreaRect,
        tickValues,
        scaleType
      );
      xScale = result.xScale;
      yScale = result.yScale;

      // Compute fitted labels using real plot-area dimensions
      const labelTexts = this.scaffoldConfig.categoryLabels ?? categories;
      let fittedLabels: LabelFitResult;
      if (isHorizontal) {
        // Horizontal chart: band axis on Y, labels are horizontal text
        // Fit labels against Y-axis label zone width
        const yLabelRect = layout.zones.get(ZoneType.YAxisLabels);
        const labelWidth = yLabelRect ? yLabelRect.width : 100;
        fittedLabels = fitLabels(labelTexts, labelWidth, labelWidth, 8);
        // Y-axis labels are vertically stacked — skip logic doesn't apply
        fittedLabels = {
          ...fittedLabels,
          skipInterval: 1,
          labels: fittedLabels.labels.map(l => ({ ...l, skip: false })),
        };
      } else {
        // Vertical chart: band/point axis on X, labels are below plot area
        const isLine = this.scaffoldConfig.chartType === 'line';
        const slotDivisor = isLine
          ? Math.max(categories.length - 1, 1)
          : Math.max(categories.length, 1);
        const slotWidth = plotAreaRect.width / slotDivisor;
        fittedLabels = fitLabels(labelTexts, plotAreaRect.width, slotWidth, 8, this.scaffoldConfig.timeSeriesLabels);
      }

      this.renderHeader(layout);
      this.renderGrid(isHorizontal, xScale, yScale, plotAreaRect, tickValues);
      this.renderAxes(isHorizontal, xScale, yScale, layout, plotAreaRect, tickValues, fittedLabels);
      this.renderAxisTitles(isHorizontal, layout);
      this.renderFooter(layout);
      this.renderLegend(layout);
    } else {
      // Numeric-numeric mode (scatter)
      const cfg = this.scaffoldConfig as NumericScaffoldConfig;
      const [xRawMin, xRawMax] = cfg.xValueRange;
      const [yRawMin, yRawMax] = cfg.yValueRange;
      const [xPadMin, xPadMax] = this.padNumericRange(xRawMin, xRawMax);
      const [yPadMin, yPadMax] = this.padNumericRange(yRawMin, yRawMax);
      const yForceZeroBaseline = this.isNumericValueAxisZeroForced(cfg);

      const xRawTicks = getTickPositions(xPadMin, xPadMax, plotAreaRect.width, undefined, this.theme.fontSizeTick, false);
      const yRawTicks = getTickPositions(yPadMin, yPadMax, plotAreaRect.height, undefined, this.theme.fontSizeTick, yForceZeroBaseline);
      const xTickValues = xRawTicks.length >= 2 ? xRawTicks : [xPadMin, xPadMax];
      const yTickValues = yRawTicks.length >= 2 ? yRawTicks : [yPadMin, yPadMax];

      // Derive scale domains from tick range
      const xDomainMin = xTickValues.length >= 2 ? xTickValues[0] : xPadMin;
      const xDomainMax = xTickValues.length >= 2 ? xTickValues.at(-1) as number : xPadMax;
      const yDomainMin = yTickValues.length >= 2 ? yTickValues[0] : yPadMin;
      const yDomainMax = yTickValues.length >= 2 ? yTickValues.at(-1) as number : yPadMax;

      xScale = scaleLinear().domain([xDomainMin, xDomainMax]).range([0, plotAreaRect.width]);
      yScale = scaleLinear().domain([yDomainMin, yDomainMax]).range([plotAreaRect.height, 0]);

      this.renderHeader(layout);
      this.renderNumericGrid(
        xScale as ScaleLinear<number, number>,
        yScale as ScaleLinear<number, number>,
        plotAreaRect,
        xTickValues,
        yTickValues
      );
      this.renderNumericAxes(
        xScale as ScaleLinear<number, number>,
        yScale as ScaleLinear<number, number>,
        layout,
        plotAreaRect,
        xTickValues,
        yTickValues
      );
      this.renderAxisTitles(false, layout);
      this.renderFooter(layout);
      this.renderLegend(layout);
    }

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
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.legend?.destroy();
    this.legend = null;
    this.svg.node()?.remove();
    this.container.style.overflow = this.originalOverflow;
  }
}
