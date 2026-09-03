import type { Meta, StoryObj } from '@storybook/html-vite';
import { createChart } from '../src';
import type { ChartInstance } from '../src/types';
import { storeChartInstance } from './helpers/renderChart';

const meta: Meta = {
  title: 'Other/Edge Cases',
};
export default meta;

export const AllNulls: StoryObj = {
  render: () => {
    const allNullsData = {
      id: ['year'],
      size: [3],
      dimension: {
        year: {
          label: 'Year',
          category: {
            index: ['2022', '2023', '2024'],
            label: { '2022': '2022', '2023': '2023', '2024': '2024' },
          },
        },
      },
      value: [null, null, null],
      label: 'All null values',
    };

    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.maxWidth = '800px';
    wrapper.style.height = 'calc(100vh - 40px)';
    wrapper.style.minHeight = '200px';
    wrapper.style.margin = '20px auto';

    requestAnimationFrame(() => {
      if (wrapper.isConnected) {
        const instance: ChartInstance = createChart(
          wrapper,
          allNullsData,
          { chartType: 'table', locale: 'en' },
        );
        storeChartInstance(wrapper, instance);
      }
    });

    return wrapper;
  },
};

export const InvalidDataset: StoryObj = {
  render: () => {
    const invalidData = { foo: 'bar' };

    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.maxWidth = '800px';
    wrapper.style.height = 'calc(100vh - 40px)';
    wrapper.style.minHeight = '200px';
    wrapper.style.margin = '20px auto';

    requestAnimationFrame(() => {
      if (wrapper.isConnected) {
        const instance: ChartInstance = createChart(
          wrapper,
          invalidData as unknown as import('../src/types').JsonStatDataset,
          { chartType: 'verticalBar', locale: 'en' },
        );
        storeChartInstance(wrapper, instance);
      }
    });

    return wrapper;
  },
};
