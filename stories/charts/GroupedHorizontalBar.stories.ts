import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { sliceDataset } from '../helpers/sliceDataset';
import { getSelectableStoryInputs } from '../helpers/selectables';
import multiSeriesData from '../fixtures/multi-series.json';
import selectableMultiSeriesData from '../fixtures/multi-series-selectable.json';
import tableWideData from '../fixtures/table-wide.json';

const meta: Meta = {
  title: 'Charts/Grouped Horizontal Bar',
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
      config: buildConfig(args, { chartType: 'groupedHorizontalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const SelectableScenario: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: selectableMultiSeriesData,
      config: buildConfig(args, {
        chartType: 'groupedHorizontalBar',
        layout: { rows: ['alue'], columns: ['vuosi'] },
      }),
      selectableSelections: { scenario: ['current'] },
      width: args.width as string,
      height: args.height as string | undefined,
      ...getSelectableStoryInputs(args),
    }),
};

export const TwoGroups: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: sliceDataset(multiSeriesData, 'alue', 2),
      config: buildConfig(args, { chartType: 'groupedHorizontalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const ManyGroups: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: tableWideData,
      config: buildConfig(args, { chartType: 'groupedHorizontalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
