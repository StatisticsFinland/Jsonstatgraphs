import { ScaleLinear } from 'd3-scale';
import { ScatterChartData, ChartConfig, ChartData } from '../types';
import { ChartScaffold, ScaffoldRenderContext } from './base';
import { bindInteractions, DataElementInfo, BoundInteractions } from './bindInteractions';
import { applyChartAriaAttributes } from '../a11y/aria';
import { getSeriesColor } from '../theme/palette';

export interface ScatterChartConfig {
  container: HTMLElement;
  data: ScatterChartData;
  config: ChartConfig;
}

export interface ScatterChartInstance {
  update(data: ScatterChartData, config?: ChartConfig): void;
  destroy(): void;
}

export function computeValueRanges(data: ScatterChartData, cutValueAxis?: boolean): { xRange: [number, number]; yRange: [number, number] } {
  const validPoints = data.points.filter(p => p.x !== null && p.y !== null);
  if (validPoints.length === 0) {
    return { xRange: [0, 1], yRange: [0, 1] };
  }

  const xValues = validPoints.map(p => p.x as number);
  const yValues = validPoints.map(p => p.y as number);

  const xRawMin = Math.min(...xValues);
  const xRawMax = Math.max(...xValues);
  const yRawMin = Math.min(...yValues);
  const yRawMax = Math.max(...yValues);

  // Default: always include 0 on the Y axis so it isn't misleadingly cut
  const yRange: [number, number] = cutValueAxis
    ? [yRawMin, yRawMax]
    : [Math.min(0, yRawMin), Math.max(0, yRawMax)];

  return {
    xRange: [xRawMin, xRawMax],
    yRange,
  };
}

export function createScatterChart(chartConfig: ScatterChartConfig): ScatterChartInstance {
  const { container } = chartConfig;
  let data = chartConfig.data;
  let config = chartConfig.config;

  let boundInteractions: BoundInteractions | null = null;

  const { xRange, yRange } = computeValueRanges(data, config.cutValueAxis);

  const scaffold = new ChartScaffold({
    mode: 'numeric',
    container,
    chartType: 'scatterPlot',
    config,
    seriesCount: 1,
    xValueRange: xRange,
    yValueRange: yRange,
    xLabel: data.xUnit ?? data.xLabel,
    yLabel: data.yUnit ?? data.yLabel,
    paddingMode: 'symmetric',
  });

  scaffold.onRender((ctx: ScaffoldRenderContext) => {
    if (boundInteractions) {
      boundInteractions.destroy();
      boundInteractions = null;
    }

    const { svg, theme } = ctx;
    const xScale = ctx.xScale as ScaleLinear<number, number>;
    const yScale = ctx.yScale as ScaleLinear<number, number>;
    const locale = config.locale;

    const plotAreaGroup = svg.select<SVGGElement>('.jsc-plot-area');

    const validPoints = data.points.filter(p => p.x !== null && p.y !== null);
    const elements: DataElementInfo[] = [];
    const color = getSeriesColor(theme, 0);

    const listGroup = plotAreaGroup.append('g')
      .attr('role', 'list')
      .attr('aria-label', `${data.yLabel} vs ${data.xLabel}`);

    validPoints.forEach((point, i) => {
      const circle = listGroup.append('circle')
        .attr('class', 'jsc-scatter-point')
        .attr('cx', xScale(point.x as number))
        .attr('cy', yScale(point.y as number))
        .attr('r', 5)
        .attr('fill', color)
        .attr('stroke', theme.colorBorder)
        .attr('stroke-width', 1)
        .attr('tabindex', '0')
        .node() as SVGCircleElement;

      const xFormatted = (point.x as number).toLocaleString(locale);
      const yFormatted = (point.y as number).toLocaleString(locale);
      const formattedValue = `${data.xLabel}: ${xFormatted}, ${data.yLabel}: ${yFormatted}`;

      const dimensionLabels: { label: string; value: string }[] = [
        { label: data.xLabel, value: xFormatted },
        { label: data.yLabel, value: yFormatted },
      ];
      if (data.observationLabel) {
        dimensionLabels.push({ label: data.observationLabel, value: point.label });
      }

      elements.push({
        element: circle,
        seriesIndex: 0,
        pointIndex: i,
        category: point.label,
        seriesName: config.title ?? config.ariaLabel ?? 'Data',
        value: null,
        formattedValue,
        dimensionLabels,
        hideValueLine: true,
      });
    });

    // ARIA
    applyChartAriaAttributes(
      container,
      config.ariaLabel ?? config.title ?? `${data.yLabel} vs ${data.xLabel}`
    );

    // Bind interactions
    if (elements.length > 0) {
      const chartDataForSR: ChartData = {
        series: [
          { name: data.xLabel, code: 'x', points: validPoints.map(p => ({ value: p.x as number, label: p.label, categoryCode: p.code })) },
          { name: data.yLabel, code: 'y', points: validPoints.map(p => ({ value: p.y as number, label: p.label, categoryCode: p.code })) },
        ],
        categories: validPoints.map(p => p.code),
        categoryLabels: validPoints.map(p => p.label),
      };
      boundInteractions = bindInteractions({
        container,
        elements,
        theme,
        locale,
        chartData: chartDataForSR,
        caption: config.title ?? config.ariaLabel,
      });
    }
  });

  scaffold.render();

  return {
    update(newData: ScatterChartData, cfg?: ChartConfig): void {
      data = newData;
      if (cfg) config = cfg;

      const { xRange: newXRange, yRange: newYRange } = computeValueRanges(data, config.cutValueAxis);
      scaffold.update({
        mode: 'numeric',
        container,
        chartType: 'scatterPlot',
        config,
        seriesCount: 1,
        xValueRange: newXRange,
        yValueRange: newYRange,
        xLabel: data.xUnit ?? data.xLabel,
        yLabel: data.yUnit ?? data.yLabel,
        paddingMode: 'symmetric',
      });
    },
    destroy(): void {
      if (boundInteractions) {
        boundInteractions.destroy();
        boundInteractions = null;
      }
      scaffold.destroy();
      container.removeAttribute('role');
      container.removeAttribute('aria-label');
    },
  };
}
