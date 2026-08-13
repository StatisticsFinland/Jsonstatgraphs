import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { sliceDataset } from '../helpers/sliceDataset';
import { getSelectableStoryInputs } from '../helpers/selectables';
import categoricalData from '../fixtures/categorical.json';
import selectableCategoricalData from '../fixtures/categorical-selectable.json';
import manyCategoriesData from '../fixtures/many-categories.json';
import negativeValuesData from '../fixtures/negative-values.json';
import sortingDemoData from '../fixtures/sorting-demo.json';

const meta: Meta = {
  title: 'Charts/Horizontal Bar',
  argTypes: {
    ...themeArgTypes,
    // Bar charts always anchor the value axis at zero — cutValueAxis has no effect here.
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
      dataset: categoricalData,
      config: buildConfig(args, { chartType: 'horizontalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const SelectableYear: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: selectableCategoricalData,
      config: buildConfig(args, { chartType: 'horizontalBar' }),
      selectableSelections: { vuosi: ['2023'] },
      width: args.width as string,
      height: args.height as string | undefined,
      ...getSelectableStoryInputs(args),
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

// The following stories reuse `sortingDemoData` — 5 product-group categories (A-E). With
// `rows: []`, the omitted `markkina` dimension is fixed to its first category ("domestic"),
// giving a single series: A=10, B=50, C=30, D=40, E=20.
const sortingDemoConfig = { chartType: 'horizontalBar' as const, layout: { rows: [], columns: ['tuoteryhma'] } };

// Default order (no sorting): A, B, C, D, E
export const SortedNone: StoryObj = {
  args: { sorting: 'no_sorting' },
  render: (args) =>
    renderChart({
      dataset: sortingDemoData,
      config: buildConfig(args, sortingDemoConfig),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

// Sorted descending by summed value (single series, so sum == value) -> B, D, C, E, A
export const SortedBySum: StoryObj = {
  args: { sorting: 'sum' },
  render: (args) =>
    renderChart({
      dataset: sortingDemoData,
      config: buildConfig(args, sortingDemoConfig),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

