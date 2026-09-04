import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { sliceDataset } from '../helpers/sliceDataset';
import { getSelectableStoryInputs } from '../helpers/selectables';
import { createScatterDataset } from '../helpers/createScatterDataset';
import scatterData from '../fixtures/scatter.json';
import selectableScatterData from '../fixtures/scatter-selectable.json';
import scatterLargeData from '../fixtures/scatter-large.json';

const fewSpreadData = createScatterDataset({ count: 8, pattern: 'spread', seed: 1 });
const mediumSpreadData = createScatterDataset({ count: 40, pattern: 'spread', seed: 2 });
const manySpreadData = createScatterDataset({ count: 180, pattern: 'spread', seed: 3 });
const mediumClusteredData = createScatterDataset({ count: 40, pattern: 'clustered', seed: 4 });
const manyOverlappingData = createScatterDataset({ count: 180, pattern: 'overlapping', seed: 5 });
const manyPointsData = createScatterDataset({ count: 999, pattern: 'spread', seed: 6 });

const meta: Meta = {
  title: 'Charts/Scatter Plot',
  argTypes: {
    ...themeArgTypes,
    // Sorting only applies to bar and pie charts.
    sorting: { table: { disable: true } },
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

export const ZeroBaseline: StoryObj = {
  args: { cutValueAxis: false },
  render: (args) =>
    renderChart({
      dataset: scatterData,
      config: buildConfig(args, { chartType: 'scatterPlot' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const CutValueAxis: StoryObj = {
  args: { cutValueAxis: true },
  render: (args) =>
    renderChart({
      dataset: scatterData,
      config: buildConfig(args, { chartType: 'scatterPlot' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

  export const AutoSizeFewSpreadPoints: StoryObj = {
    render: (args) =>
      renderChart({
        dataset: fewSpreadData,
        config: buildConfig(args, { chartType: 'scatterPlot' }),
        width: args.width as string,
        height: args.height as string | undefined,
      }),
  };

  export const AutoSizeMediumSpreadPoints: StoryObj = {
    render: (args) =>
      renderChart({
        dataset: mediumSpreadData,
        config: buildConfig(args, { chartType: 'scatterPlot' }),
        width: args.width as string,
        height: args.height as string | undefined,
      }),
  };

  export const AutoSizeManySpreadPoints: StoryObj = {
    render: (args) =>
      renderChart({
        dataset: manySpreadData,
        config: buildConfig(args, { chartType: 'scatterPlot' }),
        width: args.width as string,
        height: args.height as string | undefined,
      }),
  };

  export const AutoSizeMediumClusteredPoints: StoryObj = {
    render: (args) =>
      renderChart({
        dataset: mediumClusteredData,
        config: buildConfig(args, { chartType: 'scatterPlot' }),
        width: args.width as string,
        height: args.height as string | undefined,
      }),
  };

  export const AutoSizeManyOverlappingPoints: StoryObj = {
    render: (args) =>
      renderChart({
        dataset: manyOverlappingData,
        config: buildConfig(args, { chartType: 'scatterPlot' }),
        width: args.width as string,
        height: args.height as string | undefined,
      }),
  };

  export const AutoSizeManyPointsNarrow: StoryObj = {
    args: { width: '360px', height: '420px' },
    render: (args) =>
      renderChart({
        dataset: manySpreadData,
        config: buildConfig(args, { chartType: 'scatterPlot' }),
        width: args.width as string,
        height: args.height as string | undefined,
      }),
  };

export const LargeDataSet: StoryObj = {
  args: { width: '1600px', height: '900px' },
  render: (args) =>
    renderChart({
      dataset: manyPointsData,
      config: buildConfig(args, { chartType: 'scatterPlot' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
