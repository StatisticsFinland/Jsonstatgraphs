import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { sliceDataset } from '../helpers/sliceDataset';
import { getSelectableStoryInputs } from '../helpers/selectables';
import proportionalData from '../fixtures/proportional.json';
import selectableProportionalData from '../fixtures/proportional-selectable.json';
import manyCategoriesData from '../fixtures/many-categories.json';
import categoricalData from '../fixtures/categorical.json';

const meta: Meta = {
  title: 'Charts/Pie',
  argTypes: {
    ...themeArgTypes,
    // Pie has no line/scatter value axis — cutValueAxis has no effect here.
    cutValueAxis: { table: { disable: true } },
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

export const SelectableScenario: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: selectableProportionalData,
      config: buildConfig(args, { chartType: 'pie' }),
      selectableSelections: { scenario: ['current'] },
      width: args.width as string,
      height: args.height as string | undefined,
      ...getSelectableStoryInputs(args),
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

export const SortedBySum: StoryObj = {
  args: { sorting: 'sum' },
  render: (args) =>
    renderChart({
      dataset: proportionalData,
      config: buildConfig(args, { chartType: 'pie' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const SortedAscending: StoryObj = {
  args: { sorting: 'ascending' },
  render: (args) =>
    renderChart({
      dataset: proportionalData,
      config: buildConfig(args, { chartType: 'pie' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const Reversed: StoryObj = {
  args: { sorting: 'reversed' },
  render: (args) =>
    renderChart({
      dataset: proportionalData,
      config: buildConfig(args, { chartType: 'pie' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
