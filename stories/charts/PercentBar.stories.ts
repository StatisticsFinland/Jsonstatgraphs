import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import multiSeriesData from '../fixtures/multi-series.json';
import tableWideData from '../fixtures/table-wide.json';

const meta: Meta = {
  title: 'Charts/Percent Bar',
  argTypes: {
    ...themeArgTypes,
  },
  args: {
    ...themeArgs,
  },
};
export default meta;

export const Vertical: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: multiSeriesData,
      config: buildConfig(args, { chartType: 'percentVerticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const Horizontal: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: multiSeriesData,
      config: buildConfig(args, { chartType: 'percentHorizontalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const VerticalManySeries: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: tableWideData,
      config: buildConfig(args, { chartType: 'percentVerticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const HorizontalManySeries: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: tableWideData,
      config: buildConfig(args, { chartType: 'percentHorizontalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
