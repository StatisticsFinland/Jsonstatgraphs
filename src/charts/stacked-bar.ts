import { stack as d3Stack, stackOrderNone, stackOffsetNone } from 'd3-shape';
import { ScaleBand, ScaleLinear } from 'd3-scale';
import { ChartData, ChartConfig } from '../types';
import { ChartScaffold, ScaffoldRenderContext } from './base';
import type { NiceSkipOptions } from '../layout/label-fitting';
import { bindInteractions, DataElementInfo, BoundInteractions } from './bindInteractions';
import { applyChartAriaAttributes, applySeriesGroupAttributes } from '../a11y/aria';
import { getSeriesColor } from '../theme/palette';
import { resolveTheme } from '../theme/theme';
import { getPatternFillUrl, injectPatternDefs } from '../a11y/patterns';

export interface StackedBarChartConfig {
  container: HTMLElement;
  data: ChartData;
  config: ChartConfig;
  chartType?: 'stackedVerticalBar' | 'stackedHorizontalBar' | 'percentVerticalBar' | 'percentHorizontalBar';
  timeSeriesLabels?: NiceSkipOptions;
}

export interface StackedBarChartInstance {
  update(data: ChartData, config?: ChartConfig): void;
  destroy(): void;
}

type WideRow = Record<string, number | string>;

function buildWideData(data: ChartData, isPercent: boolean): WideRow[] {
  return data.categories.map((cat, catIdx) => {
    const row: Record<string, number | string> = Object.create(null) as Record<string, number | string>;
    row.category = cat;

    const rawValues: (number | null)[] = data.series.map(s => s.points[catIdx]?.value ?? null);

    if (isPercent) {
      const total = rawValues.reduce<number>((sum, v) => sum + (v ?? 0), 0);
      for (let si = 0; si < data.series.length; si++) {
        const val = rawValues[si];
        row[data.series[si].name] = total === 0 ? 0 : ((val ?? 0) / total) * 100;
      }
    } else {
      for (let si = 0; si < data.series.length; si++) {
        row[data.series[si].name] = rawValues[si] ?? 0;
      }
    }

    return row;
  });
}

function computeValueRange(data: ChartData, isPercent: boolean): [number, number] {
  if (isPercent) return [0, 100];

  if (data.series.length === 0 || data.categories.length === 0) return [0, 1];

  const wideData = buildWideData(data, false);
  const seriesNames = data.series.map(s => s.name);

  let maxStackTop = 0;
  for (const row of wideData) {
    let rowTotal = 0;
    for (const name of seriesNames) {
      rowTotal += (row[name] as number) || 0;
    }
    if (rowTotal > maxStackTop) maxStackTop = rowTotal;
  }

  return [0, maxStackTop === 0 ? 1 : maxStackTop];
}

function hasNegativeValues(data: ChartData): boolean {
  return data.series.some(s => s.points.some(p => p.value !== null && p.value < 0));
}

function renderNegativeError(container: HTMLElement, config: ChartConfig): void {
  container.innerHTML = '';
  const resolvedTheme = resolveTheme(container, config.theme);
  const errDiv = document.createElement('div');
  errDiv.className = 'jsc-error';
  errDiv.setAttribute('role', 'alert');
  errDiv.style.color = resolvedTheme.colorError ?? '#dc3545';
  errDiv.style.padding = '16px';
  errDiv.style.fontFamily = resolvedTheme.fontFamily;
  errDiv.textContent = 'Stacked/percent charts cannot display negative values.';
  container.appendChild(errDiv);
}

export function createStackedBarChart(chartConfig: StackedBarChartConfig): StackedBarChartInstance {
  const { container } = chartConfig;
  let data = chartConfig.data;
  let config = chartConfig.config;
  const resolvedChartType = chartConfig.chartType ?? 'stackedVerticalBar';

  if (hasNegativeValues(data)) {
    renderNegativeError(container, config);
    return {
      update(_newData: ChartData, _newConfig?: ChartConfig): void { /* no-op for error state */ },
      destroy(): void { container.innerHTML = ''; },
    };
  }

  let boundInteractions: BoundInteractions | null = null;

  const hiddenSeries = new Set<number>();
  let lastAllElements: DataElementInfo[] = [];
  let lastTheme: import('../types').ResolvedTheme | null = null;
  let lastCtx: ScaffoldRenderContext | null = null;

  function getVisibleData(): ChartData {
    return {
      ...data,
      series: data.series.filter((_, i) => !hiddenSeries.has(i)),
    };
  }

  function rebuildInteractions(): void {
    if (boundInteractions !== null) {
      boundInteractions.destroy();
      boundInteractions = null;
    }
    const visibleElements = lastAllElements.filter(info => !hiddenSeries.has(info.seriesIndex));
    const visibleData = getVisibleData();
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

  const isPercent =
    resolvedChartType === 'percentVerticalBar' || resolvedChartType === 'percentHorizontalBar';

  const scaffold = new ChartScaffold({
    mode: 'categorical' as const,
    container,
    chartType: resolvedChartType,
    config,
    seriesCount: data.series.length,
    seriesNames: data.series.map(s => s.name),
    categories: data.categories,
    categoryLabels: data.categoryLabels,
    valueRange: computeValueRange(data, isPercent),
    xLabel: data.xLabel,
    yLabel: data.yLabel,
    timeSeriesLabels: chartConfig.timeSeriesLabels,
  });

  function drawBars(ctx: ScaffoldRenderContext): void {
    ctx.svg.select('.jsc-plot-area').selectAll('*').remove();

    const { svg, theme } = ctx;
    const plotAreaGroup = svg.select<SVGGElement>('.jsc-plot-area');
    const elements: DataElementInfo[] = [];

    if (config.accessibilityMode) {
      const defs = svg.select<SVGDefsElement>('defs');
      const defsSelection = (defs.empty() ? svg.append('defs') : defs) as import('d3-selection').Selection<SVGDefsElement, unknown, null, undefined>;
      injectPatternDefs(defsSelection, theme, data.series.length);
    }

    const visibleData = getVisibleData();
    const visibleIndices = data.series
      .map((_, i) => i)
      .filter(i => !hiddenSeries.has(i));

    if (visibleData.series.length === 0) {
      lastAllElements = elements;
      lastTheme = theme;
      rebuildInteractions();
      return;
    }

    const seriesNames = visibleData.series.map(s => s.name);
    const wideData = buildWideData(visibleData, isPercent);

    const stackGen = d3Stack<WideRow>()
      .keys(seriesNames)
      .order(stackOrderNone)
      .offset(stackOffsetNone);

    const stackedData = stackGen(wideData);

    const isHorizontal =
      resolvedChartType === 'stackedHorizontalBar' || resolvedChartType === 'percentHorizontalBar';

    if (isHorizontal) {
      const xScale = ctx.xScale as ScaleLinear<number, number>;
      const yScale = ctx.yScale as ScaleBand<string>;

      for (let si = 0; si < stackedData.length; si++) {
        const layer = stackedData[si];
        const series = visibleData.series[si];
        const origIdx = visibleIndices[si];
        const color = getSeriesColor(theme, origIdx);

        const seriesGroup = plotAreaGroup
          .append('g')
          .attr('class', `jsc-series jsc-series-${origIdx}`) as unknown as import('d3-selection').Selection<SVGGElement, unknown, null, undefined>;

        const seriesGroupEl = seriesGroup.node() as SVGGElement;
        applySeriesGroupAttributes(seriesGroupEl, series.name, origIdx);

        for (let catIdx = 0; catIdx < layer.length; catIdx++) {
          const [y0, y1] = layer[catIdx];
          const cat = data.categories[catIdx];
          const originalPoint = series.points[catIdx];

          // Skip if original value was null
          if (originalPoint?.value == null) continue;

          const rect = seriesGroup
            .append('rect')
            .attr('class', 'jsc-bar')
            .attr('x', xScale(y0))
            .attr('y', yScale(cat)!)
            .attr('width', xScale(y1) - xScale(y0))
            .attr('height', yScale.bandwidth())
            .attr('fill', config.accessibilityMode ? getPatternFillUrl(origIdx) : color)
            .attr('stroke', theme.colorBorder)
            .attr('stroke-width', '1')
            .attr('tabindex', '0');

          const rectEl = rect.node() as SVGRectElement;
          const rawValue = originalPoint.value;
          const formattedValue = isPercent
            ? (() => {
                const rowTotal = visibleData.series.reduce((sum, s) => sum + (s.points[catIdx]?.value ?? 0), 0);
                const pct = rowTotal === 0 ? 0 : (rawValue / rowTotal) * 100;
                return `${pct.toLocaleString(config.locale, { maximumFractionDigits: 1 })}% (${rawValue.toLocaleString(config.locale)})`;
              })()
            : rawValue.toLocaleString(config.locale);
          elements.push({
            element: rectEl,
            seriesIndex: origIdx,
            pointIndex: catIdx,
            category: originalPoint.label,
            seriesName: series.name,
            value: rawValue,
            formattedValue,
          });
        }
      }
    } else {
      // stackedVerticalBar / percentVerticalBar
      const xScale = ctx.xScale as ScaleBand<string>;
      const yScale = ctx.yScale as ScaleLinear<number, number>;

      for (let si = 0; si < stackedData.length; si++) {
        const layer = stackedData[si];
        const series = visibleData.series[si];
        const origIdx = visibleIndices[si];
        const color = getSeriesColor(theme, origIdx);

        const seriesGroup = plotAreaGroup
          .append('g')
          .attr('class', `jsc-series jsc-series-${origIdx}`) as unknown as import('d3-selection').Selection<SVGGElement, unknown, null, undefined>;

        const seriesGroupEl = seriesGroup.node() as SVGGElement;
        applySeriesGroupAttributes(seriesGroupEl, series.name, origIdx);

        for (let catIdx = 0; catIdx < layer.length; catIdx++) {
          const [y0, y1] = layer[catIdx];
          const cat = data.categories[catIdx];
          const originalPoint = series.points[catIdx];

          // Skip if original value was null
          if (originalPoint?.value == null) continue;

          const rect = seriesGroup
            .append('rect')
            .attr('class', 'jsc-bar')
            .attr('x', xScale(cat)!)
            .attr('y', yScale(y1))
            .attr('width', xScale.bandwidth())
            .attr('height', yScale(y0) - yScale(y1))
            .attr('fill', config.accessibilityMode ? getPatternFillUrl(origIdx) : color)
            .attr('stroke', theme.colorBorder)
            .attr('stroke-width', '1')
            .attr('tabindex', '0');

          const rectEl = rect.node() as SVGRectElement;
          const rawValue = originalPoint.value;
          const formattedValue = isPercent
            ? (() => {
                const rowTotal = visibleData.series.reduce((sum, s) => sum + (s.points[catIdx]?.value ?? 0), 0);
                const pct = rowTotal === 0 ? 0 : (rawValue / rowTotal) * 100;
                return `${pct.toLocaleString(config.locale, { maximumFractionDigits: 1 })}% (${rawValue.toLocaleString(config.locale)})`;
              })()
            : rawValue.toLocaleString(config.locale);
          elements.push({
            element: rectEl,
            seriesIndex: origIdx,
            pointIndex: catIdx,
            category: originalPoint.label,
            seriesName: series.name,
            value: rawValue,
            formattedValue,
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

  const ariaLabel = config.ariaLabel ?? (config.title ?? 'Stacked bar chart');
  applyChartAriaAttributes(container, ariaLabel);

  scaffold.render();

  return {
    update(newData: ChartData, newConfig?: ChartConfig): void {
      hiddenSeries.clear();
      data = newData;
      if (newConfig !== undefined) {
        config = newConfig;
      }
      const updatedAriaLabel = config.ariaLabel ?? (config.title ?? 'Stacked bar chart');
      applyChartAriaAttributes(container, updatedAriaLabel);
      scaffold.update({
        mode: 'categorical' as const,
        container,
        chartType: resolvedChartType,
        config,
        seriesCount: data.series.length,
        seriesNames: data.series.map(s => s.name),
        categories: data.categories,
        categoryLabels: data.categoryLabels,
        valueRange: computeValueRange(data, isPercent),
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
