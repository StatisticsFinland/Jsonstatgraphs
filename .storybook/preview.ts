import type { Preview } from '@storybook/html-vite';
import { destroyStoredChartInstance } from '../stories/helpers/renderChart';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        inline: false,
        height: '450px',
      },
    },
    options: {
      storySort: {
        order: ['Charts', ['Overview', '*'], 'Customization', ['Theming', 'Custom Burger Menu Items', '*'], 'Other'],
      },
    },
  },
  decorators: [
    (storyFn) => {
      // Clean up previous chart instances before rendering the next story
      document.querySelectorAll('[data-jsc-story]').forEach((el) => {
        destroyStoredChartInstance(el);
      });
      const result = storyFn();
      if (result instanceof HTMLElement) {
        result.dataset.jscStory = 'true';
      }
      return result;
    },
  ],
};

export default preview;
