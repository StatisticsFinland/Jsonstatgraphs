import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { sliceDataset } from '../helpers/sliceDataset';
import multiSeriesData from '../fixtures/multi-series.json';
import tableWideData from '../fixtures/table-wide.json';
import withNullsData from '../fixtures/with-nulls.json';

const meta: Meta = {
  title: 'Charts/Stacked Vertical Bar',
  argTypes: {
    ...themeArgTypes,
  },
  args: {
    ...themeArgs,
  },
};
export default meta;

export const Default: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: multiSeriesData,
      config: buildConfig(args, { chartType: 'stackedVerticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const TwoSeries: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: sliceDataset(multiSeriesData, 'alue', 2),
      config: buildConfig(args, { chartType: 'stackedVerticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const ManySeries: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: tableWideData,
      config: buildConfig(args, { chartType: 'stackedVerticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const WithNulls: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: withNullsData,
      config: buildConfig(args, { chartType: 'stackedVerticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
