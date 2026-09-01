import { pie as d3Pie, arc as d3Arc, PieArcDatum } from 'd3-shape';
import { ChartData, ChartConfig, DataPoint } from '../types';
import { ChartScaffold, ScaffoldRenderContext } from './base';
import { bindInteractions, DataElementInfo, BoundInteractions } from './bindInteractions';
import { applyChartAriaAttributes, applySeriesGroupAttributes } from '../a11y/aria';
import { getSeriesColor } from '../theme/palette';
import { ensureDefs, getPatternFillUrl, injectPatternDefs } from '../a11y/patterns';
import { formatNumber } from '../locale/number';
import { captureChartFocusBeforeRedraw } from '../interaction/keyboard';

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
const PIE_LABEL_MAX_CHARS = 20;
const PIE_LABEL_CHAR_WIDTH = 8;
const PIE_LABEL_LINE_GAP = 12;

function truncatePieLabel(label: string): string {
  if (label.length <= PIE_LABEL_MAX_CHARS) return label;
  return `${label.slice(0, PIE_LABEL_MAX_CHARS - 3)}...`;
}

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
      pointAxis: 'horizontal',
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
    captureChartFocusBeforeRedraw(container);
    ctx.svg.select('.jsc-plot-area').selectAll('*').remove();
    ctx.svg.select('.jsc-pie-callouts').remove();

    const { svg, plotArea, theme } = ctx;
    lastTheme = theme;

    const plotAreaGroup = svg.select<SVGGElement>('.jsc-plot-area');
    const nonNullPoints = getNonNullPoints();
    const visibleIndices = nonNullPoints.map((_, i) => i).filter(i => !hiddenSlices.has(i));
    const visiblePoints = visibleIndices.map(i => nonNullPoints[i]);
    const total = visiblePoints.reduce((sum, p) => sum + p.value!, 0);

    const cx = plotArea.width / 2;
    const cy = plotArea.height / 2;
    const labelWidth = Math.min(
      PIE_LABEL_MAX_CHARS * PIE_LABEL_CHAR_WIDTH,
      Math.max(0, (plotArea.width - 120) / 2),
    );
    const labelGap = 16;
    const radius = Math.max(0, Math.min(
      plotArea.height / 2 - PIE_MARGIN,
      (plotArea.width - (labelWidth * 2) - (labelGap * 2)) / 2,
    ));

    const pieGen = d3Pie<DataPoint>()
      .value(d => d.value!)
      .sort(null);

    const arcGen = d3Arc<PieArcDatum<DataPoint>>()
      .innerRadius(0)
      .outerRadius(radius);

    const pieData = pieGen(visiblePoints);

    if (config.accessibilityMode) {
      const defs = ensureDefs(svg);
      injectPatternDefs(defs, theme, nonNullPoints.length);
    }

    // Create a series group for ARIA
    const seriesGroup = plotAreaGroup
      .append('g')
      .attr('class', 'jsc-series jsc-series-0');

    const seriesGroupEl = seriesGroup.node() as SVGGElement;
    const seriesName = data.series.length > 0 ? data.series[0].name : 'Pie';
    applySeriesGroupAttributes(seriesGroupEl, seriesName, 0, config.locale);

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
      const pct = total > 0 ? (point.value! / total) * 100 : 0;
      const formattedValue = `${formatNumber(point.value!, config.locale)} (${formatNumber(pct, config.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)`;

      elements.push({
        element: this,
        seriesIndex: 0,
        pointIndex: i,
        pointKey: point.categoryCode,
        category: point.label,
        seriesName,
        value: point.value,
        formattedValue,
      });
    });

    lastAllElements = elements;
    rebuildInteractions();

    const calloutGroup = svg
      .append('g')
      .attr('class', 'jsc-pie-callouts')
      .attr('aria-hidden', 'true')
      .attr('transform', `translate(${plotArea.x},${plotArea.y})`);
    const minLabelGap = 16;
    const sideItems = [
      { side: -1, items: pieData.map(arc => ({ arc })).filter(item => Math.cos((item.arc.startAngle + item.arc.endAngle) / 2 - Math.PI / 2) < 0) },
      { side: 1, items: pieData.map(arc => ({ arc })).filter(item => Math.cos((item.arc.startAngle + item.arc.endAngle) / 2 - Math.PI / 2) >= 0) },
    ];
    for (const { side, items } of sideItems) {
      items.sort((a, b) => {
        const aY = Math.sin((a.arc.startAngle + a.arc.endAngle) / 2 - Math.PI / 2);
        const bY = Math.sin((b.arc.startAngle + b.arc.endAngle) / 2 - Math.PI / 2);
        return aY - bY;
      });
      let previousY = -Infinity;
      for (const { arc } of items) {
        const angle = (arc.startAngle + arc.endAngle) / 2 - Math.PI / 2;
        const edgeX = cx + Math.cos(angle) * radius;
        const edgeY = cy + Math.sin(angle) * radius;
        const desiredY = cy + Math.sin(angle) * (radius + labelGap);
        const y = Math.max(12, Math.min(plotArea.height - 12, Math.max(desiredY, previousY + minLabelGap)));
        previousY = y;
        const labelX = side < 0
          ? cx - radius - labelGap
          : cx + radius + labelGap;
        const lineEndX = labelX - side * PIE_LABEL_LINE_GAP;
        const elbowX = cx + side * (radius + 2);
        calloutGroup
          .append('polyline')
          .attr('class', 'jsc-pie-callout-line')
          .attr('points', `${edgeX},${edgeY} ${elbowX},${y} ${lineEndX},${y}`)
          .attr('fill', 'none')
          .attr('stroke', theme.colorText)
          .attr('stroke-width', '1');
        calloutGroup
          .append('text')
          .attr('class', 'jsc-pie-callout-label')
          .attr('x', labelX)
          .attr('y', y)
          .attr('text-anchor', side < 0 ? 'end' : 'start')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', theme.fontSizeTick)
          .attr('font-family', theme.fontFamily)
          .attr('fill', theme.colorText)
          .text(truncatePieLabel(arc.data.label));
      }
    }
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
