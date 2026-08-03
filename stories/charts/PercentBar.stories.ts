import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import multiSeriesData from '../fixtures/multi-series.json';
import percentBarSelectableData from '../fixtures/percent-bar-selectable.json';
import tableWideData from '../fixtures/table-wide.json';
import sortingDemoData from '../fixtures/sorting-demo.json';
import { getSelectableStoryInputs } from '../helpers/selectables';

const meta: Meta = {
  title: 'Charts/Percent Bar',
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

export const SelectableYear: StoryObj = {
  args: {
    selectableSelections: {
      year: ['2024'],
    },
  },
  render: (args) =>
    renderChart({
      dataset: percentBarSelectableData,
      config: buildConfig(args, {
        chartType: 'percentVerticalBar',
        layout: { rows: ['sex'], columns: ['age'] },
      }),
      ...getSelectableStoryInputs(args),
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

// Shares `sortingDemoData` — 5 product-group categories (A-E) with "domestic"/"export" series:
//   domestic: A=10, B=50, C=30, D=40, E=20   export: A=15, B=5, C=45, D=25, E=30
// Percent-of-category-total for 'export' (of domestic+export): A=60%, B≈09.1%, C=60%, D≈38.5%, E=60%.
// Descending sort ties (A, C, E all 60%) preserve original relative order (stable sort) -> A, C, E, D, B
export const SortedByReferenceSeries: StoryObj = {
  args: { sorting: 'export' },
  render: (args) =>
    renderChart({
      dataset: sortingDemoData,
      config: buildConfig(args, { chartType: 'percentVerticalBar', layout: { rows: ['markkina'], columns: ['tuoteryhma'] } }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
