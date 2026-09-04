import { scaleBand, scaleLinear, scalePoint, ScaleBand, ScaleLinear, ScalePoint } from 'd3-scale';
import { ChartConfig, ChartType, ResolvedTheme, ZoneRect } from '../types';

export type CategoricalXScale = ScaleBand<string> | ScalePoint<string> | ScaleLinear<number, number>;
export type CategoricalYScale = ScaleLinear<number, number> | ScaleBand<string> | ScalePoint<string>;

export interface CategoricalScales {
  xScale: CategoricalXScale;
  yScale: CategoricalYScale;
}

const DATA_RANGE_HEADROOM = 0.05;
const PYRAMID_BOUNDARY_INSET_EM = 0.7;
const BAND_PADDING = 0.2;
const BAND_OUTER_PADDING = 0.5;

export function padValueRange(min: number, max: number): [number, number] {
  const range = max - min;
  if (range <= 0) return [min, max];

  const headroom = range * DATA_RANGE_HEADROOM;
  return [
    min < 0 ? min - headroom : min,
    max > 0 ? max + headroom : max,
  ];
}

export function padNumericRange(min: number, max: number): [number, number] {
  if (min === max) return [min - 1, max + 1];
  const padding = (max - min) * DATA_RANGE_HEADROOM;
  return [min - padding, max + padding];
}

export function isCategoricalValueAxisZeroForced(chartType: ChartType, config: ChartConfig): boolean {
  return !(chartType === 'line' && config.cutValueAxis === true);
}

export function isNumericValueAxisZeroForced(config: ChartConfig): boolean {
  return config.cutValueAxis !== true;
}

export function getCategoricalValuePadding(
  chartType: ChartType,
  config: ChartConfig,
  minValue: number,
  maxValue: number,
  isPercent: boolean,
): [number, number] {
  if (isPercent) return [minValue, maxValue];
  return isCategoricalValueAxisZeroForced(chartType, config)
    ? padValueRange(minValue, maxValue)
    : padNumericRange(minValue, maxValue);
}

export function buildCategoricalScales(
  chartType: ChartType,
  theme: ResolvedTheme,
  isHorizontal: boolean,
  categories: string[],
  minValue: number,
  maxValue: number,
  plotArea: ZoneRect,
  tickValues?: number[],
  scaleType: 'band' | 'point' = 'band',
): CategoricalScales {
  const domainMin = tickValues && tickValues.length >= 2 ? tickValues[0] : minValue;
  const domainMax = tickValues && tickValues.length >= 2 ? tickValues.at(-1) as number : maxValue;

  if (isHorizontal) {
    const pyramidBoundaryInset = chartType === 'pyramid'
      ? (Number.parseFloat(theme.fontSizeTick) || 12) * PYRAMID_BOUNDARY_INSET_EM
      : 0;
    return {
      xScale: scaleLinear()
        .domain([domainMin, domainMax])
        .range([0, plotArea.width]),
      yScale: scaleBand<string>()
        .domain(categories)
        .range(chartType === 'pyramid'
          ? [plotArea.height - pyramidBoundaryInset, pyramidBoundaryInset]
          : [0, plotArea.height])
        .padding(BAND_PADDING)
        .paddingOuter(BAND_OUTER_PADDING),
    };
  }

  if (scaleType === 'point') {
    return {
      xScale: scalePoint<string>()
        .domain(categories)
        .range([0, plotArea.width])
        .padding(0),
      yScale: scaleLinear()
        .domain([domainMin, domainMax])
        .range([plotArea.height, 0]),
    };
  }

  return {
    xScale: scaleBand<string>()
      .domain(categories)
      .range([0, plotArea.width])
      .padding(BAND_PADDING)
      .paddingOuter(BAND_OUTER_PADDING),
    yScale: scaleLinear()
      .domain([domainMin, domainMax])
      .range([plotArea.height, 0]),
  };
}