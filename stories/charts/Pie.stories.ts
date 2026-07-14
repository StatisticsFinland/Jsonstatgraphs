import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { sliceDataset } from '../helpers/sliceDataset';
import proportionalData from '../fixtures/proportional.json';
import manyCategoriesData from '../fixtures/many-categories.json';
import categoricalData from '../fixtures/categorical.json';

const meta: Meta = {
  title: 'Charts/Pie',
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
      dataset: proportionalData,
      config: buildConfig(args, { chartType: 'pie' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const FewSlices: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: sliceDataset(proportionalData, 'energian-loppukayton-sektori', 2),
      config: buildConfig(args, { chartType: 'pie' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const ManySlices: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: sliceDataset(manyCategoriesData, 'toimiala', 10),
      config: buildConfig(args, { chartType: 'pie' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const FiveCategories: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: categoricalData,
      config: buildConfig(args, { chartType: 'pie' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
