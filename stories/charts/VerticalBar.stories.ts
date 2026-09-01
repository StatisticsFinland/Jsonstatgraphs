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
import withNullsData from '../fixtures/with-nulls.json';
import timeSeriesData from '../fixtures/time-series.json';

const meta: Meta = {
  title: 'Charts/Vertical Bar',
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
      config: buildConfig(args, { chartType: 'verticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const SelectableYear: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: selectableCategoricalData,
      config: buildConfig(args, { chartType: 'verticalBar' }),
      selectableSelections: { vuosi: ['2023'] },
      width: args.width as string,
      height: args.height as string | undefined,
      ...getSelectableStoryInputs(args),
    }),
};

export const FewCategories: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: sliceDataset(categoricalData, 'ika', 2),
      config: buildConfig(args, { chartType: 'verticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const ManyCategories: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: manyCategoriesData,
      config: buildConfig(args, { chartType: 'verticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const NegativeValues: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: negativeValuesData,
      config: buildConfig(args, { chartType: 'verticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const WithNulls: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: sliceDataset(withNullsData, 'energialahde', 1),
      config: buildConfig(args, { chartType: 'verticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const TimeSeries: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: timeSeriesData,
      config: buildConfig(args, { chartType: 'verticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
