import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from './helpers/renderChart';
import { buildConfig } from './helpers/buildConfig';
import { themeArgTypes, themeArgs } from './helpers/sharedArgs';
import multiSeriesData from './fixtures/multi-series.json';
import tableMultiDimData from './fixtures/table-multi-dim.json';
import tableWideData from './fixtures/table-wide.json';

const meta: Meta = {
  title: 'Charts/Table',
  argTypes: {
    ...themeArgTypes,
    // Table has no chart value axis or category ordering — sorting/cutValueAxis have no effect here.
    sorting: { table: { disable: true } },
    cutValueAxis: { table: { disable: true } },
  },
  args: { ...themeArgs },
};
export default meta;

export const Table: StoryObj = {
  args: {
    width: '800px',
  },
  render: (args) =>
    renderChart({
      dataset: multiSeriesData,
      config: buildConfig(args, { chartType: 'table' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const MultiDimensionalTable: StoryObj = {
  args: { width: '800px' },
  render: (args) =>
    renderChart({
      dataset: tableMultiDimData,
      config: buildConfig(args, { chartType: 'table' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const TableWithManualLayout: StoryObj = {
  args: { width: '800px' },
  render: (args) =>
    renderChart({
      dataset: tableMultiDimData,
      config: buildConfig(args, {
        chartType: 'table',
        subtitle: 'Example subtitle',
        layout: { rows: ['sektori', 'sukupuoli'], columns: ['vuosi', 'palkkausmuoto'] },
      }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};

export const TableWideRegional: StoryObj = {
  args: { width: '800px' },
  render: (args) =>
    renderChart({
      dataset: tableWideData,
      config: buildConfig(args, { chartType: 'table' }),
      width: args.width as string,
      height: args.height as string | undefined,
    }),
};
