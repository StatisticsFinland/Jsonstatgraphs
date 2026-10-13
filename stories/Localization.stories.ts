import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from './helpers/renderChart';
import { buildConfig } from './helpers/buildConfig';
import { themeArgTypes, themeArgs } from './helpers/sharedArgs';
import adultEducationFiData from './fixtures/adult-education-fi.json';
import adultEducationSvData from './fixtures/adult-education-sv.json';
import adultEducationMultidimensionalFiData from './fixtures/adult-education-multidimensional-fi.json';
import adultEducationMultidimensionalSvData from './fixtures/adult-education-multidimensional-sv.json';

const meta: Meta = {
  title: 'Localization/Localized Datasets',
  argTypes: {
    ...themeArgTypes,
  },
  args: {
    ...themeArgs,
  },
};

export default meta;

export const FinnishDataset: StoryObj = {
  args: { locale: 'fi' },
  render: (args) =>
    renderChart({
      dataset: adultEducationFiData,
      config: buildConfig(args, { chartType: 'verticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const SwedishDataset: StoryObj = {
  args: { locale: 'sv' },
  render: (args) =>
    renderChart({
      dataset: adultEducationSvData,
      config: buildConfig(args, { chartType: 'verticalBar' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const FinnishMultidimensionalDataset: StoryObj = {
  args: { locale: 'fi' },
  render: (args) =>
    renderChart({
      dataset: adultEducationMultidimensionalFiData,
      config: buildConfig(args, {
        chartType: 'line',
        layout: { rows: ['ikaryhma_10_20180101'], columns: ['timeperiod_y'] },
      }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const SwedishMultidimensionalDataset: StoryObj = {
  args: { locale: 'sv' },
  render: (args) =>
    renderChart({
      dataset: adultEducationMultidimensionalSvData,
      config: buildConfig(args, {
        chartType: 'line',
        layout: { rows: ['ikaryhma_10_20180101'], columns: ['timeperiod_y'] },
      }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};