import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import type { ChartConfig, ChartType, GeoJsonFeatureCollection, JsonStatDataset } from '../../src/types';
import categoricalData from '../fixtures/categorical.json';
import multiSeriesData from '../fixtures/multi-series.json';
import timeSeriesData from '../fixtures/time-series.json';
import proportionalData from '../fixtures/proportional.json';
import pyramidData from '../fixtures/pyramid.json';
import scatterData from '../fixtures/scatter.json';
import keyFigureData from '../fixtures/key-figure.json';
import maakuntaData from '../fixtures/map-maakunta-establishments.json';
import maakuntaGeo from '../fixtures/geo-maakunta4500k.geojson';

const accessibilityArgs = {
  ...themeArgs,
  fontSizeTick: '24px',
  fontSizeLabel: '28px',
  fontSizeTitle: '32px',
  letterSpacing: '0.12em',
  width: '1200px',
  height: '900px',
};

const meta: Meta = {
  title: 'Accessibility/Increased Text Size and Character Spacing',
  argTypes: themeArgTypes,
  args: accessibilityArgs,
};
export default meta;

function renderAccessibilityChart(
  args: Record<string, unknown>,
  dataset: JsonStatDataset,
  chartType: ChartType,
  config: ChartConfig = {},
): HTMLElement {
  return renderChart({
    dataset,
    config: buildConfig(args, { ...config, chartType }),
    width: args.width as string,
    height: args.height as string | undefined,
  });
}

export const VerticalBar: StoryObj = {
  render: args => renderAccessibilityChart(args, categoricalData, 'verticalBar'),
};

export const HorizontalBar: StoryObj = {
  render: args => renderAccessibilityChart(args, categoricalData, 'horizontalBar'),
};

export const GroupedVerticalBar: StoryObj = {
  render: args => renderAccessibilityChart(args, multiSeriesData, 'groupedVerticalBar'),
};

export const GroupedHorizontalBar: StoryObj = {
  render: args => renderAccessibilityChart(args, multiSeriesData, 'groupedHorizontalBar'),
};

export const StackedVerticalBar: StoryObj = {
  render: args => renderAccessibilityChart(args, multiSeriesData, 'stackedVerticalBar'),
};

export const StackedHorizontalBar: StoryObj = {
  render: args => renderAccessibilityChart(args, multiSeriesData, 'stackedHorizontalBar'),
};

export const PercentVerticalBar: StoryObj = {
  render: args => renderAccessibilityChart(args, multiSeriesData, 'percentVerticalBar'),
};

export const PercentHorizontalBar: StoryObj = {
  render: args => renderAccessibilityChart(args, multiSeriesData, 'percentHorizontalBar'),
};

export const Line: StoryObj = {
  render: args => renderAccessibilityChart(args, timeSeriesData, 'line'),
};

export const ScatterPlot: StoryObj = {
  render: args => renderAccessibilityChart(args, scatterData, 'scatterPlot'),
};

export const Pie: StoryObj = {
  render: args => renderAccessibilityChart(args, proportionalData, 'pie'),
};

export const Pyramid: StoryObj = {
  render: args => renderAccessibilityChart(args, pyramidData, 'pyramid'),
};

export const KeyFigure: StoryObj = {
  render: args => renderAccessibilityChart(args, keyFigureData, 'keyFigure'),
};

export const Table: StoryObj = {
  render: args => renderAccessibilityChart(args, multiSeriesData, 'table'),
};

function instantProvider(geo: GeoJsonFeatureCollection) {
  return async (): Promise<GeoJsonFeatureCollection> => geo;
}

export const Map: StoryObj = {
  render: args => renderAccessibilityChart(args, maakuntaData, 'map', {
    mapProvider: instantProvider(maakuntaGeo),
    map: {
      geoIdProperty: 'maakunta',
      geoCodeMapper: (code: string) => code.replace(/^MK/, ''),
    },
  }),
};