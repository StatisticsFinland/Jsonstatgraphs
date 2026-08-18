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

export const MIN_SCATTER_POINT_RADIUS_RATIO = 0.0075;
export const MAX_SCATTER_POINT_RADIUS_RATIO = 0.015;

export interface ScatterPointPosition {
  x: number;
  y: number;
}

/**
 * Computes one visual radius for a scatter plot from its screen-space density.
 * The local search is bucketed so charts near the supported 999-point limit do
 * not need to compare every point with every other point.
 */
export function computeScatterPointRadius(
  points: ScatterPointPosition[],
  plotWidth: number,
  plotHeight: number,
): number {
  if (plotWidth <= 0 || plotHeight <= 0) {
    return 1;
  }

  const plotSize = Math.min(plotWidth, plotHeight);
  const baseMinimumRadius = Math.max(1, plotSize * MIN_SCATTER_POINT_RADIUS_RATIO);
  const maximumRadius = Math.max(baseMinimumRadius, plotSize * MAX_SCATTER_POINT_RADIUS_RATIO);
  if (points.length <= 8) return maximumRadius;

  const globalSpacing = Math.sqrt((plotWidth * plotHeight) / points.length);
  const buckets = new Map<string, ScatterPointPosition[]>();

  const getCellKey = (point: ScatterPointPosition): [number, number] => [
    Math.floor(point.x / globalSpacing),
    Math.floor(point.y / globalSpacing),
  ];

  for (const point of points) {
    const [cellX, cellY] = getCellKey(point);
    const key = `${cellX}:${cellY}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(point);
    } else {
      buckets.set(key, [point]);
    }
  }

  const nearestDistances = points.map((point) => {
    const [cellX, cellY] = getCellKey(point);
    let nearestDistance = globalSpacing;

    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        const bucket = buckets.get(`${cellX + offsetX}:${cellY + offsetY}`);
        if (!bucket) continue;

        for (const candidate of bucket) {
          if (candidate === point) continue;
          const distanceX = candidate.x - point.x;
          const distanceY = candidate.y - point.y;
          const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
          nearestDistance = Math.min(nearestDistance, distance);
        }
      }
    }

    return nearestDistance;
  }).sort((a, b) => a - b);

  const lowerQuartile = nearestDistances[Math.floor(0.25 * (points.length - 1))];
  const usableSpacing = Math.min(globalSpacing, lowerQuartile);
  const densityWeight = 0.25 - 0.1 * Math.min(1, points.length / 100);
  return Math.max(
    baseMinimumRadius,
    Math.min(maximumRadius, usableSpacing * 0.2 * densityWeight),
  );
}

export function computeValueRanges(data: ScatterChartData, cutValueAxis?: boolean): { xRange: [number, number]; yRange: [number, number] } {
  let validPointCount = 0;
  let xRawMin = Infinity;
  let xRawMax = -Infinity;
  let yRawMin = Infinity;
  let yRawMax = -Infinity;

  for (const point of data.points) {
    if (point.x === null || point.y === null) continue;

    validPointCount++;
    xRawMin = Math.min(xRawMin, point.x);
    xRawMax = Math.max(xRawMax, point.x);
    yRawMin = Math.min(yRawMin, point.y);
    yRawMax = Math.max(yRawMax, point.y);
  }

  if (validPointCount === 0) {
    return { xRange: [0, 1], yRange: [0, 1] };
  }

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
    const projectedPoints = validPoints.map(point => ({
      x: xScale(point.x as number),
      y: yScale(point.y as number),
    }));
    const pointRadius = computeScatterPointRadius(
      projectedPoints,
      ctx.plotArea.width,
      ctx.plotArea.height,
    );

    const listGroup = plotAreaGroup.append('g')
      .attr('role', 'list')
      .attr('aria-label', `${data.yLabel} vs ${data.xLabel}`);

    validPoints.forEach((point, i) => {
      const projectedPoint = projectedPoints[i];
      const circle = listGroup.append('circle')
        .attr('class', 'jsc-scatter-point')
        .attr('cx', projectedPoint.x)
        .attr('cy', projectedPoint.y)
        .attr('r', pointRadius)
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
