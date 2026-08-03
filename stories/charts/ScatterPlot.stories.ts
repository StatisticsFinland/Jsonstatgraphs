import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { sliceDataset } from '../helpers/sliceDataset';
import { getSelectableStoryInputs } from '../helpers/selectables';
import scatterData from '../fixtures/scatter.json';
import selectableScatterData from '../fixtures/scatter-selectable.json';
import scatterLargeData from '../fixtures/scatter-large.json';

const meta: Meta = {
  title: 'Charts/Scatter Plot',
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
      dataset: scatterData,
      config: buildConfig(args, { chartType: 'scatterPlot' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const SelectableYear: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: selectableScatterData,
      config: buildConfig(args, { chartType: 'scatterPlot' }),
      selectableSelections: { vuosi: ['2023'] },
      width: args.width as string,
      height: args.height as string | undefined,
      ...getSelectableStoryInputs(args),
    }),
};

export const ManyPoints: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: scatterLargeData,
      config: buildConfig(args, { chartType: 'scatterPlot' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const FewPoints: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: sliceDataset(scatterData, 'ika', 3),
      config: buildConfig(args, { chartType: 'scatterPlot' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
