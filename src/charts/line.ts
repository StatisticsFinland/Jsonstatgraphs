import { line as d3Line, curveLinear } from 'd3-shape';
import { ScaleLinear, ScalePoint } from 'd3-scale';
import { ChartData, ChartConfig } from '../types';
import { ChartScaffold, ScaffoldRenderContext } from './base';
import type { NiceSkipOptions } from '../layout/label-fitting';
import { bindInteractions, DataElementInfo, BoundInteractions } from './bindInteractions';
import { applyChartAriaAttributes, applySeriesGroupAttributes } from '../a11y/aria';
import { getSeriesColor } from '../theme/palette';
import { getMarkerPath } from '../a11y/patterns';

export interface LineChartConfig {
  container: HTMLElement;
  data: ChartData;
  config: ChartConfig;
  timeSeriesLabels?: NiceSkipOptions;
}

export interface LineChartInstance {
  update(data: ChartData, config?: ChartConfig): void;
  destroy(): void;
}

export function computeValueRange(data: ChartData, cutValueAxis?: boolean): [number, number] {
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
  if (cutValueAxis) {
    if (min === max) return [min - 1, max + 1];
    return [min, max];
  }
  // Default: always include 0 so the Y axis isn't misleadingly cut
  return [Math.min(0, min), Math.max(0, max)];
}

export function createLineChart(chartConfig: LineChartConfig): LineChartInstance {
  const { container } = chartConfig;
  let data = chartConfig.data;
  let config = chartConfig.config;

  let boundInteractions: BoundInteractions | null = null;

  // Track which series are hidden by the legend
  const hiddenSeries = new Set<number>();

  // Last rendered full element list and theme — used to rebuild interactions after legend toggle
  let lastAllElements: DataElementInfo[] = [];
  let lastTheme: import('../types').ResolvedTheme | null = null;

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
      chartData: data,
      ariaLabel: config.ariaLabel,
      caption: config.title ?? config.ariaLabel,
    });
  }

  const seriesNames = data.series.map(s => s.name);
  const valueRange = computeValueRange(data, config.cutValueAxis);

  const scaffold = new ChartScaffold({
    mode: 'categorical' as const,
    container,
    chartType: 'line',
    config,
    seriesCount: data.series.length,
    seriesNames,
    categories: data.categories,
    categoryLabels: data.categoryLabels,
    valueRange,
    xLabel: data.xLabel,
    yLabel: data.yLabel,
    timeSeriesLabels: chartConfig.timeSeriesLabels,
  });

  // Series groups keyed by series index — used for legend toggle visibility
  const seriesGroupElements = new Map<number, SVGGElement>();

  scaffold.onRender((ctx: ScaffoldRenderContext) => {
    seriesGroupElements.clear();
    hiddenSeries.clear();

    const { svg, theme } = ctx;
    const xScale = ctx.xScale as ScalePoint<string>;
    const yScale = ctx.yScale as ScaleLinear<number, number>;

    const plotAreaGroup = svg.select<SVGGElement>('.jsc-plot-area');

    const elements: DataElementInfo[] = [];

    for (let si = 0; si < data.series.length; si++) {
      const series = data.series[si];
      const color = getSeriesColor(theme, si);

      const seriesGroup = plotAreaGroup
        .append('g')
        .attr('class', `jsc-series jsc-series-${si}`) as unknown as import('d3-selection').Selection<SVGGElement, unknown, null, undefined>;

      const seriesGroupEl = seriesGroup.node() as SVGGElement;
      applySeriesGroupAttributes(seriesGroupEl, series.name, si);
      seriesGroupElements.set(si, seriesGroupEl);

      // Build line generator
      type LinePoint = { value: number | null; categoryCode: string; label: string };
      const lineGen = d3Line<LinePoint>()
        .defined(d => d.value !== null)
        .x(d => xScale(d.categoryCode)!)
        .y(d => yScale(d.value as number)!)
        .curve(curveLinear);

      // Draw line path
      seriesGroup
        .append('path')
        .datum(series.points)
        .attr('class', 'jsc-line')
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', '2')
        .attr('d', lineGen);

      // Draw markers for non-null points
      const nonNullPoints = series.points.filter(p => p.value !== null);

      if (config.accessibilityMode) {
        seriesGroup
          .selectAll<SVGPathElement, LinePoint>('path.jsc-marker')
          .data(nonNullPoints)
          .join('path')
          .attr('class', 'jsc-marker')
          .attr('d', d => getMarkerPath(si, xScale(d.categoryCode)!, yScale(d.value as number)!, 5))
          .attr('fill', color)
          .attr('stroke', theme.colorSurface)
          .attr('stroke-width', '2')
          .attr('tabindex', '0');
      } else {
        seriesGroup
          .selectAll<SVGCircleElement, LinePoint>('circle.jsc-line-hit-area')
          .data(nonNullPoints)
          .join('circle')
          .attr('class', 'jsc-line-hit-area')
          .attr('cx', d => xScale(d.categoryCode)!)
          .attr('cy', d => yScale(d.value as number)!)
          .attr('r', '8')
          .attr('fill', 'transparent')
          .attr('stroke', 'none')
          .attr('tabindex', '0');
      }

      // Collect elements for bindInteractions
      const markers = seriesGroup
        .selectAll<SVGElement, LinePoint>(config.accessibilityMode ? '.jsc-marker' : '.jsc-line-hit-area')
        .nodes();
      for (let pi = 0; pi < nonNullPoints.length; pi++) {
        const point = nonNullPoints[pi];
        const markerEl = markers[pi];
        if (!markerEl) continue;

        const formattedValue = point.value === null
          ? '–'
          : point.value.toLocaleString(config.locale);

        elements.push({
          element: markerEl,
          seriesIndex: si,
          pointIndex: pi,
          category: point.label,
          seriesName: series.name,
          value: point.value,
          formattedValue,
        });
      }
    }

    // Bind interactions (tooltip, keyboard, ARIA)
    lastAllElements = elements;
    lastTheme = theme;
    rebuildInteractions();

    // Register legend toggle callback
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

  // Apply chart-level ARIA
  const ariaLabel = config.ariaLabel ?? (config.title ?? 'Line chart');
  applyChartAriaAttributes(container, ariaLabel);

  // Trigger initial render
  scaffold.render();

  return {
    update(newData: ChartData, newConfig?: ChartConfig): void {
      data = newData;
      if (newConfig !== undefined) {
        config = newConfig;
      }
      const updatedAriaLabel = config.ariaLabel ?? (config.title ?? 'Line chart');
      applyChartAriaAttributes(container, updatedAriaLabel);
      const updatedValueRange = computeValueRange(data, config.cutValueAxis);
      scaffold.update({
        mode: 'categorical' as const,
        container,
        chartType: 'line',
        config,
        seriesCount: data.series.length,
        seriesNames: data.series.map(s => s.name),
        categories: data.categories,
        categoryLabels: data.categoryLabels,
        valueRange: updatedValueRange,
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
