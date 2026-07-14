import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { sliceDataset } from '../helpers/sliceDataset';
import pyramidData from '../fixtures/pyramid.json';

const meta: Meta = {
  title: 'Charts/Pyramid',
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
      dataset: pyramidData,
      config: buildConfig(args, { chartType: 'pyramid' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const FewAgeGroups: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: sliceDataset(pyramidData, 'ika-vaalipaivana', 4),
      config: buildConfig(args, { chartType: 'pyramid' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
