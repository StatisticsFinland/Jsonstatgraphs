import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { sliceDataset } from '../helpers/sliceDataset';
import { getSelectableStoryInputs } from '../helpers/selectables';
import multiSeriesData from '../fixtures/multi-series.json';
import selectableMultiSeriesData from '../fixtures/multi-series-selectable.json';
import tableWideData from '../fixtures/table-wide.json';
import sortingDemoData from '../fixtures/sorting-demo.json';

const meta: Meta = {
  title: 'Charts/Grouped Horizontal Bar',
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

// The following stories share `sortingDemoData` — 5 product-group categories (A-E) with
// deliberately non-monotonic "domestic"/"export" series values, so each sorting mode produces
// a distinct, easy-to-verify category order:
//   domestic: A=10, B=50, C=30, D=40, E=20   export: A=15, B=5, C=45, D=25, E=30
const sortingDemoConfig = { chartType: 'groupedHorizontalBar' as const, layout: { rows: ['markkina'], columns: ['tuoteryhma'] } };

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

// Sum of domestic+export per product group (A=25, B=55, C=75, D=65, E=50) descending: C, D, B, E, A
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

// Sorted descending by the first series (domestic: A=10, B=50, C=30, D=40, E=20) -> B, D, C, E, A
export const SortedDescending: StoryObj = {
  args: { sorting: 'descending' },
  render: (args) =>
    renderChart({
      dataset: sortingDemoData,
      config: buildConfig(args, sortingDemoConfig),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

// On grouped horizontal bars, a matching series code moves that series to the top of every group.
export const PrioritizedSeries: StoryObj = {
  args: { sorting: 'export' },
  render: (args) =>
    renderChart({
      dataset: sortingDemoData,
      config: buildConfig(args, sortingDemoConfig),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

  export const PrioritizedYear: StoryObj = {
    args: { sorting: '2023' },
    render: (args) =>
      renderChart({
        dataset: selectableMultiSeriesData,
        config: buildConfig(args, {
          chartType: 'groupedHorizontalBar',
          layout: { rows: ['vuosi'], columns: ['alue'] },
        }),
        selectableSelections: { scenario: ['current'] },
        width: args.width as string,
        height: args.height as string | undefined,
        ...getSelectableStoryInputs(args),
      }),
  };
