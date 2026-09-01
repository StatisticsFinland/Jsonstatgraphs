import type { Meta, StoryObj } from '@storybook/html-vite';
import { createChart } from '../src';
import { renderChart, storeChartInstance } from './helpers/renderChart';
import type { ChartInstance } from '../src/types';

import timeSeriesData from './fixtures/time-series.json';
import multiSeriesData from './fixtures/multi-series.json';

const meta: Meta = {
  title: 'Customization/Burger Menu',
};
export default meta;

export const CustomButton: StoryObj = {
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

export const CustomLink: StoryObj = {
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
            isExternal: true,
          },
        ],
      },
      width: '800px',
    }),
};

export const WithoutBurgerMenu: StoryObj = {
  render: () =>
    renderChart({
      dataset: timeSeriesData,
      config: {
        chartType: 'line',
        showBurgerMenu: false,
      },
      width: '800px',
    }),
};

  export const TitlelessWithHeaderDisabled: StoryObj = {
    render: () =>
      renderChart({
        dataset: timeSeriesData,
        config: {
          chartType: 'line',
          showHeader: false,
          autoTitle: false,
        },
        width: '800px',
      }),
  };

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
              burgerMenuBackground: '#16213e',
              burgerMenuBorderColor: '#3a3a5c',
              burgerMenuBorderRadius: '18px',
              burgerMenuShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
              burgerMenuItemHoverBackground: '#1f2b52',
              burgerMenuItemActiveBackground: '#2b3a6b',
              burgerMenuItemSeparatorColor: '#3a3a5c',
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
    wrapper.style.setProperty('--jsc-burger-menu-background', '#ffffff');
    wrapper.style.setProperty('--jsc-burger-menu-border-color', '#999999');
    wrapper.style.setProperty('--jsc-burger-menu-border-radius', '12px');
    wrapper.style.setProperty('--jsc-burger-menu-shadow', '0 8px 24px rgba(0, 0, 0, 0.2)');
    wrapper.style.setProperty('--jsc-burger-menu-item-hover-background', '#f0f4ff');
    wrapper.style.setProperty('--jsc-burger-menu-item-active-background', '#dce7ff');
    wrapper.style.setProperty('--jsc-burger-menu-item-separator-color', '#d0d0d0');

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
