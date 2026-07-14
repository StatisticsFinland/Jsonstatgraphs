import type { StorybookConfig } from '@storybook/html-vite';
import { readFileSync } from 'node:fs';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)', '../stories/**/*.mdx'],
  addons: [
    {
      name: '@storybook/addon-docs',
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            providerImportSource: '@storybook/addon-docs/mdx-react-shim',
          },
        },
      },
    },
  ],
  framework: '@storybook/html-vite',
  core: {
    disableTelemetry: true,
  },
  viteFinal: (config) => {
    config.plugins = config.plugins || [];
    config.plugins.push({
      name: 'geojson-loader',
      enforce: 'pre',
      load(id) {
        const cleanId = id.replace(/\?.*$/, '');
        if (cleanId.endsWith('.geojson')) {
          const content = readFileSync(cleanId, 'utf-8');
          return `export default ${content}`;
        }
      },
    });
    return config;
  },
};

export default config;
