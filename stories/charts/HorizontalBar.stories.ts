import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { sliceDataset } from '../helpers/sliceDataset';
import categoricalData from '../fixtures/categorical.json';
import manyCategoriesData from '../fixtures/many-categories.json';
import negativeValuesData from '../fixtures/negative-values.json';

const meta: Meta = {
  title: 'Charts/Horizontal Bar',
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
      dataset: categoricalData,
      config: buildConfig(args, { chartType: 'horizontalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const FewBarsLongLabels: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: sliceDataset(manyCategoriesData, 'toimiala', 5),
      config: buildConfig(args, { chartType: 'horizontalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const ManyBars: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: manyCategoriesData,
      config: buildConfig(args, { chartType: 'horizontalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const NegativeValues: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: negativeValuesData,
      config: buildConfig(args, { chartType: 'horizontalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
