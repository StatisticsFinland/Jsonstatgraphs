import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart } from './helpers/renderChart';
import timeSeriesData from './fixtures/time-series.json';

const meta: Meta = {
  title: 'Customization/Custom Burger Menu Items',
};

export default meta;

export const CustomFunctionButton: StoryObj = {
  render: () =>
    renderChart({
      dataset: timeSeriesData,
      config: {
        chartType: 'line',
        menuItemDefinitions: [
          {
            text: 'Show alert',
            onClick: () => {
              window.alert('Custom burger menu action triggered');
            },
          },
        ],
      },
      width: '800px',
    }),
};

export const CustomExternalLink: StoryObj = {
  render: () =>
    renderChart({
      dataset: timeSeriesData,
      config: {
        chartType: 'line',
        menuItemDefinitions: [
          {
            text: 'Open example.com',
            url: 'https://example.com',
            openNewTab: true,
            isExternal: true
          },
        ],
      },
      width: '800px',
    }),
};
