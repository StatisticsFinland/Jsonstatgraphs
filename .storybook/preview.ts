import type { Preview } from '@storybook/html-vite';

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
        order: ['Charts', ['Overview', '*'], 'Customization', ['Theming', '*'], 'Other'],
      },
    },
  },
  decorators: [
    (storyFn) => {
      // Clean up previous chart instances before rendering the next story
      document.querySelectorAll('[data-jsc-story]').forEach((el) => {
        (el as any).__jscInstance?.destroy();
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
