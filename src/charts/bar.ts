import { ScaleBand, ScaleLinear } from 'd3-scale';
import { ChartData, ChartConfig } from '../types';
import { ChartScaffold, ScaffoldRenderContext } from './base';
import type { NiceSkipOptions } from '../layout/label-fitting';
import { bindInteractions, DataElementInfo, BoundInteractions } from './bindInteractions';
import { applyChartAriaAttributes, applySeriesGroupAttributes } from '../a11y/aria';
import { getSeriesColor } from '../theme/palette';

export interface BarChartConfig {
  container: HTMLElement;
  data: ChartData;
  config: ChartConfig;
  chartType?: 'verticalBar' | 'horizontalBar';
  timeSeriesLabels?: NiceSkipOptions;
}

export interface BarChartInstance {
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

export function createBarChart(chartConfig: BarChartConfig): BarChartInstance {
  const { container } = chartConfig;
  let data = chartConfig.data;
  let config = chartConfig.config;
  const resolvedChartType = chartConfig.chartType ?? 'verticalBar';

  let boundInteractions: BoundInteractions | null = null;

  const hiddenSeries = new Set<number>();
  let lastAllElements: DataElementInfo[] = [];
  let lastTheme: import('../types').ResolvedTheme | null = null;

  // Bar chart renders only the first series; build a single-series view for scaffold/interactions
  function buildRenderData(): import('../types').ChartData {
    return {
      ...data,
      series: data.series.length > 0 ? [data.series[0]] : [],
    };
  }

  let renderData = buildRenderData();

  function rebuildInteractions(): void {
    if (boundInteractions !== null) {
      boundInteractions.destroy();
      boundInteractions = null;
    }
    const visibleElements = lastAllElements.filter(info => !hiddenSeries.has(info.seriesIndex));
    boundInteractions = bindInteractions({
      container,
      elements: visibleElements,
      theme: lastTheme!,
      locale: config.locale,
      chartData: renderData,
      ariaLabel: config.ariaLabel,
      caption: config.title ?? config.ariaLabel,
    });
  }

  const scaffold = new ChartScaffold({
    mode: 'categorical' as const,
    container,
    chartType: resolvedChartType,
    config,
    seriesCount: renderData.series.length,
    seriesNames: renderData.series.map(s => s.name),
    categories: renderData.categories,
    categoryLabels: renderData.categoryLabels,
    valueRange: computeValueRange(renderData),
    xLabel: data.xLabel,
    yLabel: data.yLabel,
    timeSeriesLabels: chartConfig.timeSeriesLabels,
  });

  const seriesGroupElements = new Map<number, SVGGElement>();

  scaffold.onRender((ctx: ScaffoldRenderContext) => {
    seriesGroupElements.clear();
    hiddenSeries.clear();

    const { svg, theme } = ctx;
    const plotAreaGroup = svg.select<SVGGElement>('.jsc-plot-area');
    const elements: DataElementInfo[] = [];

    if (data.series.length === 0) {
      lastAllElements = elements;
      lastTheme = theme;
      rebuildInteractions();
      return;
    }

    // Bar chart renders only the first series
    const si = 0;
    const series = data.series[si];
    const color = getSeriesColor(theme, si);

    const seriesGroup = plotAreaGroup
      .append('g')
      .attr('class', `jsc-series jsc-series-${si}`) as unknown as import('d3-selection').Selection<SVGGElement, unknown, null, undefined>;

    const seriesGroupEl = seriesGroup.node() as SVGGElement;
    applySeriesGroupAttributes(seriesGroupEl, series.name, si);
    seriesGroupElements.set(si, seriesGroupEl);

    type BarPoint = { value: number; categoryCode: string; label: string };
    const nonNullPoints = series.points.filter(
      (p): p is BarPoint => p.value !== null
    );

    if (resolvedChartType === 'horizontalBar') {
      const xScale = ctx.xScale as ScaleLinear<number, number>;
      const yScale = ctx.yScale as ScaleBand<string>;

      seriesGroup
        .selectAll<SVGRectElement, BarPoint>('rect')
        .data(nonNullPoints)
        .join('rect')
        .attr('class', 'jsc-bar')
        .attr('x', d => d.value >= 0 ? xScale(0) : xScale(d.value))
        .attr('y', d => yScale(d.categoryCode)!)
        .attr('width', d => Math.abs(xScale(d.value) - xScale(0)))
        .attr('height', yScale.bandwidth())
        .attr('fill', color)
        .attr('stroke', theme.colorBorder)
        .attr('stroke-width', '1')
        .attr('tabindex', '0');
    } else {
      const xScale = ctx.xScale as ScaleBand<string>;
      const yScale = ctx.yScale as ScaleLinear<number, number>;

      seriesGroup
        .selectAll<SVGRectElement, BarPoint>('rect')
        .data(nonNullPoints)
        .join('rect')
        .attr('class', 'jsc-bar')
        .attr('x', d => xScale(d.categoryCode)!)
        .attr('y', d => d.value >= 0 ? yScale(d.value) : yScale(0))
        .attr('width', xScale.bandwidth())
        .attr('height', d => Math.abs(yScale(0) - yScale(d.value)))
        .attr('fill', color)
        .attr('stroke', theme.colorBorder)
        .attr('stroke-width', '1')
        .attr('tabindex', '0');
    }

    // Collect elements for interactions
    const rects = seriesGroup.selectAll<SVGRectElement, BarPoint>('rect').nodes();
    for (let pi = 0; pi < nonNullPoints.length; pi++) {
      const point = nonNullPoints[pi];
      const rectEl = rects[pi];
      if (!rectEl) continue;

      elements.push({
        element: rectEl,
        seriesIndex: si,
        pointIndex: pi,
        category: point.label,
        seriesName: series.name,
        value: point.value,
        formattedValue: point.value.toLocaleString(config.locale),
      });
    }

    lastAllElements = elements;
    lastTheme = theme;
    rebuildInteractions();

    if (ctx.setSeriesToggle) {
      ctx.setSeriesToggle((index: number, active: boolean) => {
        const groupEl = seriesGroupElements.get(index);
        if (groupEl) {
          groupEl.style.display = active ? '' : 'none';
        }
        if (active) {
          hiddenSeries.delete(index);
        } else {
          hiddenSeries.add(index);
        }
        rebuildInteractions();
      });
    }
  });

  const ariaLabel = config.ariaLabel ?? (config.title ?? 'Bar chart');
  applyChartAriaAttributes(container, ariaLabel);

  scaffold.render();

  return {
    update(newData: ChartData, newConfig?: ChartConfig): void {
      data = newData;
      if (newConfig !== undefined) {
        config = newConfig;
      }
      renderData = buildRenderData();
      const updatedAriaLabel = config.ariaLabel ?? (config.title ?? 'Bar chart');
      applyChartAriaAttributes(container, updatedAriaLabel);
      scaffold.update({
        mode: 'categorical' as const,
        container,
        chartType: resolvedChartType,
        config,
        seriesCount: renderData.series.length,
        seriesNames: renderData.series.map(s => s.name),
        categories: renderData.categories,
        categoryLabels: renderData.categoryLabels,
        valueRange: computeValueRange(renderData),
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
    },
  };
}
