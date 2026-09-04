import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from './helpers/renderChart';
import { buildConfig } from './helpers/buildConfig';
import { themeArgTypes, themeArgs } from './helpers/sharedArgs';
import timeSeriesData from './fixtures/time-series.json';
import multiSeriesData from './fixtures/multi-series.json';
import categoricalData from './fixtures/categorical.json';

const meta: Meta = {
  title: 'Customization/Header & Footer',
  argTypes: { ...themeArgTypes },
  args: { ...themeArgs },
};
export default meta;

export const WithTitleSubtitle: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: timeSeriesData,
      config: buildConfig(args, {
        chartType: 'line',
        showHeader: true,
        title: 'Adoptions in Finland',
        subtitle: 'Total adoptions 2015–2024',
      }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const WithFooter: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: categoricalData,
      config: buildConfig(args, {
        chartType: 'verticalBar',
        footerItems: [
          { label: 'Source:', value: 'Example Institute', type: 'source' as const },
          { label: 'Updated:', value: '2023-10-06', type: 'updated' as const },
        ],
      }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const WithUnitFooter: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: categoricalData,
      config: buildConfig(args, {
        chartType: 'verticalBar',
        showUnit: true,
      }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const FullConfiguration: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: multiSeriesData,
      config: buildConfig(args, {
        chartType: 'groupedVerticalBar',
        showHeader: true,
        title: 'Gross domestic product per capita by area',
        subtitle: '5 regions · 2019–2023',
        showLegend: true,
        footerItems: [
          { label: 'Source:', value: 'Example Institute, regional accounts', type: 'source' as const },
          { label: 'Last updated:', value: '2025-11-28', type: 'updated' as const },
        ],
      }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const AutoTitle: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: timeSeriesData,
      config: buildConfig(args, {
        chartType: 'line',
        showHeader: true,
        // No title specified — uses buildHeader() algorithm
      }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const SourceAsLink: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: categoricalData,
      config: buildConfig(args, {
        chartType: 'verticalBar',
        footerItems: [
          { label: 'Source:', value: 'Statistics Finland', type: 'source' as const },
          { label: 'Updated:', value: '2025-03-15', type: 'updated' as const },
        ],
        sourceLink: 'https://stat.fi',
      }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const DatasetLabel: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: timeSeriesData,
      config: buildConfig(args, {
        chartType: 'line',
        showHeader: true,
        autoTitle: false,
        // Uses dataset.label directly instead of buildHeader()
      }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
