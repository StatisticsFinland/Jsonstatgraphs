import { ScaleBand, ScaleLinear } from 'd3-scale';
import { PyramidChartData, ChartConfig } from '../types';
import { ChartScaffold, ScaffoldRenderContext } from './base';
import { bindInteractions, DataElementInfo, BoundInteractions } from './bindInteractions';
import { applyChartAriaAttributes, applySeriesGroupAttributes } from '../a11y/aria';
import { getSeriesColor } from '../theme/palette';
import { ensureDefs, getPatternFillUrl, injectPatternDefs } from '../a11y/patterns';

export interface PyramidChartConfig {
  container: HTMLElement;
  data: PyramidChartData;
  config: ChartConfig;
}

export interface PyramidChartInstance {
  update(data: PyramidChartData, config?: ChartConfig): void;
  destroy(): void;
}

function computeValueRange(data: PyramidChartData): [number, number] {
  const allValues = [...data.leftSeries.points, ...data.rightSeries.points]
    .map(p => p.value)
    .filter((v): v is number => v !== null);
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1;
  return [-maxVal, maxVal];
}

export function createPyramidChart(chartConfig: PyramidChartConfig): PyramidChartInstance {
  const { container } = chartConfig;
  let data = chartConfig.data;
  let config = chartConfig.config;

  let boundInteractions: BoundInteractions | null = null;

  const hiddenSeries = new Set<number>();
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
      chartData: {
        series: [data.leftSeries, data.rightSeries],
        categories: data.categories,
        categoryLabels: data.categoryLabels,
        xLabel: data.categoryDimensionLabel,
        seriesLabel: data.splitDimensionLabel,
        yLabel: data.yLabel,
      },
      ariaLabel: config.ariaLabel,
      caption: config.title ?? config.ariaLabel,
    });
  }

  const seriesGroupElements = new Map<number, SVGGElement>();

  const scaffold = new ChartScaffold({
    mode: 'categorical' as const,
    container,
    chartType: 'pyramid',
    config,
    seriesCount: 2,
    seriesNames: [data.leftSeries.name, data.rightSeries.name],
    categories: data.categories,
    categoryLabels: data.categoryLabels,
    valueRange: computeValueRange(data),
  });

  scaffold.onRender((ctx: ScaffoldRenderContext) => {
    seriesGroupElements.clear();
    hiddenSeries.clear();

    const { svg, theme } = ctx;
    const xScale = ctx.xScale as ScaleLinear<number, number>;
    const yScale = ctx.yScale as ScaleBand<string>;

    const plotAreaGroup = svg.select<SVGGElement>('.jsc-plot-area');
    const elements: DataElementInfo[] = [];

    if (config.accessibilityMode) {
      const defs = ensureDefs(svg);
      injectPatternDefs(defs, theme, 2);
    }

    const seriesList = [
      { series: data.leftSeries, index: 0, isLeft: true },
      { series: data.rightSeries, index: 1, isLeft: false },
    ];

    for (const { series, index: si, isLeft } of seriesList) {
      const color = getSeriesColor(theme, si);

      const seriesGroup = plotAreaGroup
        .append('g')
        .attr('class', `jsc-series jsc-series-${si}`) as unknown as import('d3-selection').Selection<SVGGElement, unknown, null, undefined>;

      const seriesGroupEl = seriesGroup.node() as SVGGElement;
      applySeriesGroupAttributes(seriesGroupEl, series.name, si, config.locale);
      seriesGroupElements.set(si, seriesGroupEl);

      type BarPoint = { value: number; label: string; categoryCode: string };
      const nonNullPoints = series.points.filter(
        (p): p is BarPoint => p.value !== null
      );

      if (isLeft) {
        // Left series: bars extend from -value to 0 (leftward from center)
        seriesGroup
          .selectAll<SVGRectElement, BarPoint>('rect')
          .data(nonNullPoints)
          .join('rect')
          .attr('class', 'jsc-bar jsc-bar-left')
          .attr('x', d => xScale(-d.value))
          .attr('y', d => yScale(d.categoryCode)!)
          .attr('width', d => xScale(0) - xScale(-d.value))
          .attr('height', yScale.bandwidth())
          .attr('fill', config.accessibilityMode ? getPatternFillUrl(si) : color)
          .attr('stroke', theme.colorBorder)
          .attr('stroke-width', '1')
          .attr('tabindex', '0');
      } else {
        // Right series: bars extend from 0 to value (rightward from center)
        seriesGroup
          .selectAll<SVGRectElement, BarPoint>('rect')
          .data(nonNullPoints)
          .join('rect')
          .attr('class', 'jsc-bar jsc-bar-right')
          .attr('x', xScale(0))
          .attr('y', d => yScale(d.categoryCode)!)
          .attr('width', d => xScale(d.value) - xScale(0))
          .attr('height', yScale.bandwidth())
          .attr('fill', config.accessibilityMode ? getPatternFillUrl(si) : color)
          .attr('stroke', theme.colorBorder)
          .attr('stroke-width', '1')
          .attr('tabindex', '0');
      }

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

  const ariaLabel = config.ariaLabel ?? (config.title ?? 'Pyramid chart');
  applyChartAriaAttributes(container, ariaLabel, 'pyramid', config.locale);

  scaffold.render();

  return {
    update(newData: PyramidChartData, newConfig?: ChartConfig): void {
      data = newData;
      if (newConfig !== undefined) {
        config = newConfig;
      }
      const updatedAriaLabel = config.ariaLabel ?? (config.title ?? 'Pyramid chart');
      applyChartAriaAttributes(container, updatedAriaLabel, 'pyramid', config.locale);
      scaffold.update({
        mode: 'categorical' as const,
        container,
        chartType: 'pyramid',
        config,
        seriesCount: 2,
        seriesNames: [data.leftSeries.name, data.rightSeries.name],
        categories: data.categories,
        categoryLabels: data.categoryLabels,
        valueRange: computeValueRange(data),
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
