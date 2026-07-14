import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import keyFigureData from '../fixtures/key-figure.json';
import keyFigureNullData from '../fixtures/key-figure-null.json';

const meta: Meta = {
  title: 'Charts/Key Figure',
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
      dataset: keyFigureData,
      config: buildConfig(args, { chartType: 'keyFigure' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const NullValue: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: keyFigureNullData,
      config: buildConfig(args, { chartType: 'keyFigure' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
