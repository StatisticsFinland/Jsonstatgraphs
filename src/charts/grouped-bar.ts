import { scaleBand, ScaleBand, ScaleLinear } from 'd3-scale';
import { ChartData, ChartConfig } from '../types';
import { ChartScaffold, ScaffoldRenderContext } from './base';
import type { NiceSkipOptions } from '../layout/label-fitting';
import { bindInteractions, DataElementInfo, BoundInteractions } from './bindInteractions';
import { applyChartAriaAttributes, applySeriesGroupAttributes } from '../a11y/aria';
import { getSeriesColor } from '../theme/palette';
import { ensureDefs, getPatternFillUrl, injectPatternDefs } from '../a11y/patterns';
import { captureChartFocusBeforeRedraw } from '../interaction/keyboard';

export interface GroupedBarChartConfig {
  container: HTMLElement;
  data: ChartData;
  config: ChartConfig;
  chartType?: 'groupedVerticalBar' | 'groupedHorizontalBar';
  timeSeriesLabels?: NiceSkipOptions;
}

export interface GroupedBarChartInstance {
  update(data: ChartData, config?: ChartConfig): void;
  destroy(): void;
}

function computeValueRange(data: ChartData): [number, number] {
  const values: number[] = [];
  for (const series of data.series) {
    for (const point of series.points) {
      if (point.value !== null) {
        values.push(point.value);
      }
    }
  }
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Always include 0 — bars start from zero
  return [Math.min(0, min), Math.max(0, max)];
}

export function createGroupedBarChart(chartConfig: GroupedBarChartConfig): GroupedBarChartInstance {
  const { container } = chartConfig;
  let data = chartConfig.data;
  let config = chartConfig.config;
  const resolvedChartType = chartConfig.chartType ?? 'groupedVerticalBar';

  let boundInteractions: BoundInteractions | null = null;

  const hiddenSeries = new Set<number>();
  let lastAllElements: DataElementInfo[] = [];
  let lastTheme: import('../types').ResolvedTheme | null = null;
  let lastCtx: ScaffoldRenderContext | null = null;

  function rebuildInteractions(): void {
    if (boundInteractions !== null) {
      boundInteractions.destroy();
      boundInteractions = null;
    }
    const visibleElements = lastAllElements.filter(info => !hiddenSeries.has(info.seriesIndex));
    const visibleData: ChartData = {
      ...data,
      series: data.series.filter((_, i) => !hiddenSeries.has(i)),
    };
    boundInteractions = bindInteractions({
      container,
      elements: visibleElements,
      theme: lastTheme!,
      locale: config.locale,
      chartData: visibleData,
      ariaLabel: config.ariaLabel,
      caption: config.title ?? config.ariaLabel,
    });
  }

  const scaffold = new ChartScaffold({
    mode: 'categorical' as const,
    container,
    chartType: resolvedChartType,
    config,
    seriesCount: data.series.length,
    seriesNames: data.series.map(s => s.name),
    categories: data.categories,
    categoryLabels: data.categoryLabels,
    valueRange: computeValueRange(data),
    xLabel: data.xLabel,
    yLabel: data.yLabel,
    timeSeriesLabels: chartConfig.timeSeriesLabels,
  });

  function drawBars(ctx: ScaffoldRenderContext): void {
    captureChartFocusBeforeRedraw(container);
    ctx.svg.select('.jsc-plot-area').selectAll('*').remove();

    const { svg, theme } = ctx;
    const plotAreaGroup = svg.select<SVGGElement>('.jsc-plot-area');
    const interactionGroup = plotAreaGroup.append('g');
    const elements: DataElementInfo[] = [];

    if (config.accessibilityMode) {
      const defs = ensureDefs(svg);
      injectPatternDefs(defs, theme, data.series.length);
    }

    const visibleSeriesNames = data.series
      .map((s, i) => ({ name: s.name, index: i }))
      .filter(s => !hiddenSeries.has(s.index))
      .map(s => s.name);

    type BarPoint = { value: number; categoryCode: string; label: string };

    if (resolvedChartType === 'groupedHorizontalBar') {
      const xScale = ctx.xScale as ScaleLinear<number, number>;
      const yScale = ctx.yScale as ScaleBand<string>;

      const innerScale = scaleBand<string>()
        .domain(visibleSeriesNames)
        .range([0, yScale.bandwidth()])
        .padding(0.05);

      for (let si = 0; si < data.series.length; si++) {
        if (hiddenSeries.has(si)) continue;
        const series = data.series[si];
        const color = getSeriesColor(theme, si);

        const seriesGroup = interactionGroup
          .append('g')
          .attr('class', `jsc-series jsc-series-${si}`) as unknown as import('d3-selection').Selection<SVGGElement, unknown, null, undefined>;

        const seriesGroupEl = seriesGroup.node() as SVGGElement;
        applySeriesGroupAttributes(seriesGroupEl, series.name, si, config.locale);

        const nonNullPoints = series.points.filter(
          (p): p is BarPoint => p.value !== null
        );

        seriesGroup
          .selectAll<SVGRectElement, BarPoint>('rect')
          .data(nonNullPoints)
          .join('rect')
          .attr('class', 'jsc-bar')
          .attr('x', d => d.value >= 0 ? xScale(0) : xScale(d.value))
          .attr('y', d => yScale(d.categoryCode)! + innerScale(series.name)!)
          .attr('width', d => Math.abs(xScale(d.value) - xScale(0)))
          .attr('height', innerScale.bandwidth())
          .attr('fill', config.accessibilityMode ? getPatternFillUrl(si) : color)
          .attr('stroke', theme.colorBorder)
          .attr('stroke-width', '1')
          .attr('tabindex', '0');

        const rects = seriesGroup.selectAll<SVGRectElement, BarPoint>('rect').nodes();
        for (let pi = 0; pi < nonNullPoints.length; pi++) {
          const point = nonNullPoints[pi];
          const rectEl = rects[pi];
          if (!rectEl) continue;

          elements.push({
            element: rectEl,
            seriesIndex: si,
            pointIndex: series.points.indexOf(point),
            pointKey: point.categoryCode,
            category: point.label,
            seriesName: series.name,
            value: point.value,
            formattedValue: point.value.toLocaleString(config.locale),
          });
        }
      }
    } else {
      // groupedVerticalBar
      const xScale = ctx.xScale as ScaleBand<string>;
      const yScale = ctx.yScale as ScaleLinear<number, number>;

      const innerScale = scaleBand<string>()
        .domain(visibleSeriesNames)
        .range([0, xScale.bandwidth()])
        .padding(0.05);

      for (let si = 0; si < data.series.length; si++) {
        if (hiddenSeries.has(si)) continue;
        const series = data.series[si];
        const color = getSeriesColor(theme, si);

        const seriesGroup = interactionGroup
          .append('g')
          .attr('class', `jsc-series jsc-series-${si}`) as unknown as import('d3-selection').Selection<SVGGElement, unknown, null, undefined>;

        const seriesGroupEl = seriesGroup.node() as SVGGElement;
        applySeriesGroupAttributes(seriesGroupEl, series.name, si, config.locale);

        const nonNullPoints = series.points.filter(
          (p): p is BarPoint => p.value !== null
        );

        seriesGroup
          .selectAll<SVGRectElement, BarPoint>('rect')
          .data(nonNullPoints)
          .join('rect')
          .attr('class', 'jsc-bar')
          .attr('x', d => xScale(d.categoryCode)! + innerScale(series.name)!)
          .attr('y', d => d.value >= 0 ? yScale(d.value) : yScale(0))
          .attr('width', innerScale.bandwidth())
          .attr('height', d => Math.abs(yScale(0) - yScale(d.value)))
          .attr('fill', config.accessibilityMode ? getPatternFillUrl(si) : color)
          .attr('stroke', theme.colorBorder)
          .attr('stroke-width', '1')
          .attr('tabindex', '0');

        const rects = seriesGroup.selectAll<SVGRectElement, BarPoint>('rect').nodes();
        for (let pi = 0; pi < nonNullPoints.length; pi++) {
          const point = nonNullPoints[pi];
          const rectEl = rects[pi];
          if (!rectEl) continue;

          elements.push({
            element: rectEl,
            seriesIndex: si,
            pointIndex: series.points.indexOf(point),
            pointKey: point.categoryCode,
            category: point.label,
            seriesName: series.name,
            value: point.value,
            formattedValue: point.value.toLocaleString(config.locale),
          });
        }
      }
    }

    lastAllElements = elements;
    lastTheme = theme;
    rebuildInteractions();
  }

  scaffold.onRender((ctx: ScaffoldRenderContext) => {
    lastCtx = ctx;
    drawBars(ctx);

    if (ctx.setSeriesToggle) {
      ctx.setSeriesToggle((index: number, active: boolean) => {
        if (active) {
          hiddenSeries.delete(index);
        } else {
          hiddenSeries.add(index);
        }
        drawBars(lastCtx!);
      });
    }

    if (ctx.setLegendItemStates) {
      const states = data.series.map((_, i) => !hiddenSeries.has(i));
      ctx.setLegendItemStates(states);
    }
  });

  const ariaLabel = config.ariaLabel ?? (config.title ?? 'Grouped bar chart');
  applyChartAriaAttributes(container, ariaLabel, resolvedChartType, config.locale);

  scaffold.render();

  return {
    update(newData: ChartData, newConfig?: ChartConfig): void {
      hiddenSeries.clear();
      data = newData;
      if (newConfig !== undefined) {
        config = newConfig;
      }
      const updatedAriaLabel = config.ariaLabel ?? (config.title ?? 'Grouped bar chart');
      applyChartAriaAttributes(container, updatedAriaLabel, resolvedChartType, config.locale);
      scaffold.update({
        mode: 'categorical' as const,
        container,
        chartType: resolvedChartType,
        config,
        seriesCount: data.series.length,
        seriesNames: data.series.map(s => s.name),
        categories: data.categories,
        categoryLabels: data.categoryLabels,
        valueRange: computeValueRange(data),
        xLabel: data.xLabel,
        yLabel: data.yLabel,
        timeSeriesLabels: chartConfig.timeSeriesLabels,
      });
    },

    destroy(): void {
      if (boundInteractions !== null) {
        boundInteractions.destroy();
        boundInteractions = null;
      }
      scaffold.destroy();
      container.removeAttribute('role');
      container.removeAttribute('aria-label');
      container.removeAttribute('aria-roledescription');
    },
  };
}
