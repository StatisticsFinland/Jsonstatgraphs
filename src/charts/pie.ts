import { pie as d3Pie, arc as d3Arc, PieArcDatum } from 'd3-shape';
import { ChartData, ChartConfig, DataPoint } from '../types';
import { ChartScaffold, ScaffoldRenderContext } from './base';
import { bindInteractions, DataElementInfo, BoundInteractions } from './bindInteractions';
import { applyChartAriaAttributes, applySeriesGroupAttributes } from '../a11y/aria';
import { getSeriesColor } from '../theme/palette';
import { getPatternFillUrl, injectPatternDefs } from '../a11y/patterns';

export interface PieChartConfig {
  container: HTMLElement;
  data: ChartData;
  config: ChartConfig;
}

export interface PieChartInstance {
  update(data: ChartData, config?: ChartConfig): void;
  destroy(): void;
}

const PIE_MARGIN = 10;

export function createPieChart(chartConfig: PieChartConfig): PieChartInstance {
  const { container } = chartConfig;
  let data = chartConfig.data;
  let config = chartConfig.config;

  let boundInteractions: BoundInteractions | null = null;

  const hiddenSlices = new Set<number>();
  let lastAllElements: DataElementInfo[] = [];
  let lastTheme: import('../types').ResolvedTheme | null = null;
  let lastCtx: ScaffoldRenderContext | null = null;

  function getNonNullPoints(): DataPoint[] {
    if (data.series.length === 0) return [];
    return data.series[0].points.filter(p => p.value !== null);
  }

  function rebuildInteractions(): void {
    if (boundInteractions !== null) {
      boundInteractions.destroy();
      boundInteractions = null;
    }
    const allNonNull = getNonNullPoints();
    const visibleIndices = allNonNull.map((_, i) => i).filter(i => !hiddenSlices.has(i));
    const visiblePoints = visibleIndices.map(i => allNonNull[i]);
    const visibleData: ChartData = {
      ...data,
      series: data.series.length > 0
        ? [{ ...data.series[0], points: visiblePoints }]
        : [],
      categories: visiblePoints.map(p => p.categoryCode),
      categoryLabels: visiblePoints.map(p => p.label),
    };
    boundInteractions = bindInteractions({
      container,
      elements: lastAllElements,
      theme: lastTheme!,
      locale: config.locale,
      chartData: visibleData,
      ariaLabel: config.ariaLabel,
      caption: config.title ?? config.ariaLabel,
    });
  }

  function buildScaffoldConfig() {
    const nonNullPoints = getNonNullPoints();
    const seriesNames = nonNullPoints.map(p => p.label);
    return {
      mode: 'categorical' as const,
      container,
      chartType: 'pie' as const,
      config,
      seriesCount: nonNullPoints.length,
      seriesNames,
      categories: data.categories,
      categoryLabels: data.categoryLabels,
      valueRange: [0, 1] as [number, number],
      xLabel: data.xLabel,
      yLabel: data.yLabel,
    };
  }

  const scaffold = new ChartScaffold(buildScaffoldConfig());

  function drawSlices(ctx: ScaffoldRenderContext): void {
    ctx.svg.select('.jsc-plot-area').selectAll('*').remove();

    const { svg, plotArea, theme } = ctx;
    lastTheme = theme;

    const plotAreaGroup = svg.select<SVGGElement>('.jsc-plot-area');
    const nonNullPoints = getNonNullPoints();
    const visibleIndices = nonNullPoints.map((_, i) => i).filter(i => !hiddenSlices.has(i));
    const visiblePoints = visibleIndices.map(i => nonNullPoints[i]);
    const total = visiblePoints.reduce((sum, p) => sum + p.value!, 0);

    const cx = plotArea.width / 2;
    const cy = plotArea.height / 2;
    const radius = Math.min(plotArea.width, plotArea.height) / 2 - PIE_MARGIN;

    const pieGen = d3Pie<DataPoint>()
      .value(d => d.value!)
      .sort(null);

    const arcGen = d3Arc<PieArcDatum<DataPoint>>()
      .innerRadius(0)
      .outerRadius(radius);

    const pieData = pieGen(visiblePoints);

    if (config.accessibilityMode) {
      const defs = svg.select<SVGDefsElement>('defs');
      const defsSelection = (defs.empty() ? svg.append('defs') : defs) as import('d3-selection').Selection<SVGDefsElement, unknown, null, undefined>;
      injectPatternDefs(defsSelection, theme, nonNullPoints.length);
    }

    // Create a series group for ARIA
    const seriesGroup = plotAreaGroup
      .append('g')
      .attr('class', 'jsc-series jsc-series-0');

    const seriesGroupEl = seriesGroup.node() as SVGGElement;
    const seriesName = data.series.length > 0 ? data.series[0].name : 'Pie';
    applySeriesGroupAttributes(seriesGroupEl, seriesName, 0);

    const sliceNodes = seriesGroup
      .selectAll<SVGPathElement, PieArcDatum<DataPoint>>('.jsc-slice')
      .data(pieData)
      .join('path')
      .attr('class', 'jsc-slice')
      .attr('d', arcGen)
      .attr('fill', (_d, i) => config.accessibilityMode ? getPatternFillUrl(visibleIndices[i]) : getSeriesColor(theme, visibleIndices[i]))
      .attr('stroke', theme.colorSurface)
      .attr('stroke-width', '2')
      .attr('tabindex', '0')
      .attr('transform', `translate(${cx},${cy})`);

    const elements: DataElementInfo[] = [];

    sliceNodes.each(function(d, i) {
      const point = d.data;
      const pct = total > 0 ? ((point.value! / total) * 100).toFixed(1) : '0.0';
      const formattedValue = `${point.value!.toLocaleString(config.locale)} (${pct}%)`;

      elements.push({
        element: this,
        seriesIndex: 0,
        pointIndex: i,
        category: point.label,
        seriesName,
        value: point.value,
        formattedValue,
      });
    });

    lastAllElements = elements;
    rebuildInteractions();
  }

  scaffold.onRender((ctx: ScaffoldRenderContext) => {
    lastCtx = ctx;
    drawSlices(ctx);

    if (ctx.setSeriesToggle) {
      ctx.setSeriesToggle((index: number, active: boolean) => {
        if (active) {
          hiddenSlices.delete(index);
        } else {
          hiddenSlices.add(index);
        }
        drawSlices(lastCtx!);
      });
    }

    if (ctx.setLegendItemStates) {
      const nonNullPoints = getNonNullPoints();
      const states = nonNullPoints.map((_, i) => !hiddenSlices.has(i));
      ctx.setLegendItemStates(states);
    }
  });

  const ariaLabel = config.ariaLabel ?? (config.title ?? 'Pie chart');
  applyChartAriaAttributes(container, ariaLabel);

  scaffold.render();

  return {
    update(newData: ChartData, newConfig?: ChartConfig): void {
      hiddenSlices.clear();
      data = newData;
      if (newConfig !== undefined) {
        config = newConfig;
      }
      const updatedAriaLabel = config.ariaLabel ?? (config.title ?? 'Pie chart');
      applyChartAriaAttributes(container, updatedAriaLabel);
      scaffold.update(buildScaffoldConfig());
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
