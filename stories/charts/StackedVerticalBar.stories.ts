import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { sliceDataset } from '../helpers/sliceDataset';
import { getSelectableStoryInputs } from '../helpers/selectables';
import multiSeriesData from '../fixtures/multi-series.json';
import selectableMultiSeriesData from '../fixtures/multi-series-selectable.json';
import tableWideData from '../fixtures/table-wide.json';
import withNullsData from '../fixtures/with-nulls.json';
import sortingDemoData from '../fixtures/sorting-demo.json';

const meta: Meta = {
  title: 'Charts/Stacked Vertical Bar',
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
      config: buildConfig(args, { chartType: 'stackedVerticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const SelectableScenario: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: selectableMultiSeriesData,
      config: buildConfig(args, {
        chartType: 'stackedVerticalBar',
        layout: { rows: ['alue'], columns: ['vuosi'] },
      }),
      selectableSelections: { scenario: ['current'] },
      width: args.width as string,
      height: args.height as string | undefined,
      ...getSelectableStoryInputs(args),
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

// The following stories share `sortingDemoData` — 5 product-group categories (A-E) with
// deliberately non-monotonic "domestic"/"export" series values:
//   domestic: A=10, B=50, C=30, D=40, E=20   export: A=15, B=5, C=45, D=25, E=30
const sortingDemoConfig = { chartType: 'stackedVerticalBar' as const, layout: { rows: ['markkina'], columns: ['tuoteryhma'] } };

// Default order (no sorting): A, B, C, D, E
export const SortedNone: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: sortingDemoData,
      config: buildConfig(args, sortingDemoConfig),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

// 'export' is a value code of the market dimension — sorts categories descending by that
// specific series' absolute values (export: A=15, B=5, C=45, D=25, E=30) -> C, E, D, A, B
export const SortedByReferenceSeries: StoryObj = {
  args: { sorting: 'export' },
  render: (args) =>
    renderChart({
      dataset: sortingDemoData,
      config: buildConfig(args, sortingDemoConfig),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
