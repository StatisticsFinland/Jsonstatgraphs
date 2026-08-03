import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from '../helpers/renderChart';
import { buildConfig } from '../helpers/buildConfig';
import { themeArgTypes, themeArgs } from '../helpers/sharedArgs';
import { getSelectableStoryInputs } from '../helpers/selectables';
import keyFigureData from '../fixtures/key-figure.json';
import selectableKeyFigureData from '../fixtures/key-figure-selectable.json';
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

export const SelectableYear: StoryObj = {
  render: (args) =>
    renderChart({
      dataset: selectableKeyFigureData,
      config: buildConfig(args, { chartType: 'keyFigure' }),
      selectableSelections: { vuosi: ['2025'] },
      width: args.width as string,
      height: args.height as string | undefined,
      ...getSelectableStoryInputs(args),
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
