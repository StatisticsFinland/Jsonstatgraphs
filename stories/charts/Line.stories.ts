import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { sliceDataset } from '../helpers/sliceDataset';
import timeSeriesData from '../fixtures/time-series.json';
import longTimeSeriesData from '../fixtures/long-time-series.json';
import multiSeriesData from '../fixtures/multi-series.json';
import tableWideData from '../fixtures/table-wide.json';
import withNullsData from '../fixtures/with-nulls.json';
import negativeValuesData from '../fixtures/negative-values.json';
import type { JsonStatDataset } from '../../src/types';
import { getSelectableStoryInputs } from '../helpers/selectables';

const selectableBaseDataset = multiSeriesData as JsonStatDataset;

function withSelectableConfig(
  selectableConfig: NonNullable<JsonStatDataset['extension']>['selectableConfig'],
): JsonStatDataset {
  return {
    ...selectableBaseDataset,
    extension: {
      ...selectableBaseDataset.extension,
      selectableConfig,
    },
  };
}

const meta: Meta = {
  title: 'Charts/Line',
  argTypes: {
    ...themeArgTypes,
  },
  args: {
    ...themeArgs,
  },
};

export const SelectableFromRenderer: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: withSelectableConfig({
        defaultSelectableSelections: { alue: ['MK01'] },
      }),
      config: buildConfig(args, {
        chartType: 'line',
        layout: { rows: [], columns: ['vuosi'] },
      }),
      selectableSelections: { alue: ['MK02'] },
      width: args.width as string,
      height: args.height as string | undefined,
      ...getSelectableStoryInputs(args),
    }),
};

export const SelectableFromChartConfigDefault: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: selectableBaseDataset,
      config: buildConfig(args, {
        chartType: 'line',
        layout: { rows: [], columns: ['vuosi'] },
        defaultSelectableSelections: { alue: ['MK04'] },
      }),
      width: args.width as string,
      height: args.height as string | undefined,
      ...getSelectableStoryInputs(args),
    }),
};

export const SelectableFromDatasetExtension: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: withSelectableConfig({
        defaultSelectableSelections: { alue: ['MK06'] },
      }),
      config: buildConfig(args, {
        chartType: 'line',
        layout: { rows: [], columns: ['vuosi'] },
      }),
      width: args.width as string,
      height: args.height as string | undefined,
      ...getSelectableStoryInputs(args),
    }),
};

export const MultiSelectableDimension: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: withSelectableConfig({
        multiSelectableDimensionCode: 'alue',
      }),
      config: buildConfig(args, {
        chartType: 'line',
        layout: { rows: [], columns: ['vuosi'] },
      }),
      selectableSelections: { alue: ['MK01', 'MK04', 'MK17'] },
      ...getSelectableStoryInputs(args),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
export default meta;

export const Default: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: timeSeriesData,
      config: buildConfig(args, { chartType: 'line' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const LongTimeSeries: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: longTimeSeriesData,
      config: buildConfig(args, { chartType: 'line' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const MultiSeries: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: multiSeriesData,
      config: buildConfig(args, { chartType: 'line' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const ManyLines: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: tableWideData,
      config: buildConfig(args, { chartType: 'line' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const WithNulls: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: withNullsData,
      config: buildConfig(args, { chartType: 'line' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const NegativeValues: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: negativeValuesData,
      config: buildConfig(args, { chartType: 'line' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const ShortSeries: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: sliceDataset(timeSeriesData, 'vuosi', 3),
      config: buildConfig(args, { chartType: 'line' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
