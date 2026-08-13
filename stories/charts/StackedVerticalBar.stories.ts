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

