import type { Meta, StoryObj } from '@storybook/html-vite';
import { createChart } from '../src';
import { renderChart, storeChartInstance } from './helpers/renderChart';
import type { ChartInstance } from '../src/types';

import timeSeriesData from './fixtures/time-series.json';
import multiSeriesData from './fixtures/multi-series.json';

const meta: Meta = {
  title: 'Customization/Theming',
};
export default meta;

export const DarkTheme: StoryObj = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.maxWidth = '800px';
    wrapper.style.height = 'calc(100vh - 40px)';
    wrapper.style.minHeight = '200px';
    wrapper.style.margin = '20px auto';
    wrapper.style.background = '#1a1a2e';

    requestAnimationFrame(() => {
      if (wrapper.isConnected) {
        const instance: ChartInstance = createChart(
          wrapper,
          timeSeriesData,
          {
            chartType: 'line',
            locale: 'en',
            theme: {
              colorBackground: '#1a1a2e',
              colorSurface: '#16213e',
              colorText: '#e0e0e0',
              colorTextSecondary: '#a0a0a0',
              colorBorder: '#444444',
              seriesColors: ['#00d2ff', '#ff6b6b', '#ffd93d', '#6bcb77'],
            },
          },
        );
        storeChartInstance(wrapper, instance);
      }
    });

    return wrapper;
  },
};

export const CustomColors: StoryObj = {
  render: () =>
    renderChart({
      dataset: multiSeriesData,
      config: {
        chartType: 'groupedVerticalBar',
        theme: {
          seriesColors: ['#2ca6a4', '#7c4dff'],
        },
      },
      width: '800px',
    }),
};

export const CSSCustomProperties: StoryObj = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.maxWidth = '800px';
    wrapper.style.height = 'calc(100vh - 40px)';
    wrapper.style.minHeight = '200px';
    wrapper.style.margin = '20px auto';

    wrapper.style.setProperty('--jsc-font-family', 'Georgia, serif');
    wrapper.style.setProperty('--jsc-series-1', '#e63946');
    wrapper.style.setProperty('--jsc-series-2', '#457b9d');
    wrapper.style.setProperty('--jsc-border-radius', '0');

    requestAnimationFrame(() => {
      if (wrapper.isConnected) {
        const instance: ChartInstance = createChart(
          wrapper,
          multiSeriesData,
          { chartType: 'groupedVerticalBar', locale: 'en' },
        );
        storeChartInstance(wrapper, instance);
      }
    });

    return wrapper;
  },
};
