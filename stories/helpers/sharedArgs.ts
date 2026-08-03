import type { ArgTypes } from '@storybook/html';

export const themeArgTypes: ArgTypes = {
  // Text controls
  fontFamily: { control: 'text', description: 'Font family', table: { category: 'Theme' } },
  fontSizeTick: { control: 'text', description: 'Tick font size', table: { category: 'Theme' } },
  fontSizeLabel: { control: 'text', description: 'Label font size', table: { category: 'Theme' } },
  fontSizeTitle: { control: 'text', description: 'Title font size', table: { category: 'Theme' } },

  // Color controls
  colorBackground: { control: 'color', description: 'Background color', table: { category: 'Theme' } },
  colorText: { control: 'color', description: 'Text color', table: { category: 'Theme' } },
  colorTextSecondary: { control: 'color', description: 'Secondary text color', table: { category: 'Theme' } },
  colorBorder: { control: 'color', description: 'Border color', table: { category: 'Theme' } },
  colorTick: { control: 'color', description: 'Tick color', table: { category: 'Theme' } },

  // Object control for series colors
  seriesColors: { control: 'object', description: 'Series color palette. Ensure sufficient contrast between colors.', table: { category: 'Theme' } },

  // Map color controls
  mapColors: { control: 'object', description: 'Map choropleth color palette (light→dark). Classification settings are in the Map category.', table: { category: 'Theme' } },
  classificationMethod: { control: 'select', options: ['jenks', 'jenks-nice', 'even-ranges', 'linear'], description: 'Classification method for map coloring', table: { category: 'Map' } },
  classCount: { control: 'number', description: 'Number of classification classes', table: { category: 'Map' } },

  // Container controls
  width: { control: 'text', description: 'Container width', table: { category: 'Layout' } },
  height: { control: 'text', description: 'Container height', table: { category: 'Layout' } },

  // Boolean controls
  showHeader: { control: 'boolean', description: 'Show header', table: { category: 'Config' } },
  showLegend: { control: 'boolean', description: 'Show legend', table: { category: 'Config' } },
  autoTitle: { control: 'boolean', description: 'Auto-generate title from dataset', table: { category: 'Config' } },
  defaultSelectableSelections: { control: 'object', description: 'Fallback dimension/category selections supplied through ChartConfig.', table: { category: 'Selectables' } },
  multiSelectableDimensionCode: { control: 'text', description: 'Line-chart multi-select dimension supplied through ChartConfig.', table: { category: 'Selectables' } },
  selectableSelections: { control: 'object', description: 'Current selections supplied to the chart renderer. Overrides dataset extension selections.', table: { category: 'Selectables' } },
  extensionSelectableSelections: { control: 'object', description: 'Current selections supplied through dataset.extension.selectableConfig.', table: { category: 'Selectables' } },
  extensionDefaultSelectableSelections: { control: 'object', description: 'Fallback selections supplied through dataset.extension.selectableConfig.', table: { category: 'Selectables' } },
  extensionMultiSelectableDimensionCode: { control: 'text', description: 'Line-chart multi-select dimension supplied through dataset.extension.selectableConfig.', table: { category: 'Selectables' } },

  // Select control
  locale: { control: 'select', options: ['en', 'fi', 'sv'], description: 'Locale', table: { category: 'Config' } },

  // Visualization settings
  sorting: {
    control: 'select',
    options: ['no_sorting', 'reversed', 'sum', 'ascending', 'descending'],
    description: 'Category sort order. Bar/pie charts only. Any other string is treated as a series code to sort against.',
    table: { category: 'Config' },
  },
  cutValueAxis: {
    control: 'boolean',
    description: 'Allow the value axis to not start at 0 (line & scatter plot only).',
    table: { category: 'Config' },
  },
};

export const themeArgs = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSizeTick: '0.75rem',
  fontSizeLabel: '0.875rem',
  fontSizeTitle: '1rem',
  colorBackground: '#ffffff',
  colorText: '#333333',
  colorTextSecondary: '#666666',
  colorBorder: '#cccccc',
  colorTick: '#767676',
  seriesColors: ['#4e79a7', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f'],
  mapColors: ['#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'],
  classificationMethod: 'jenks-nice',
  classCount: 5,
  width: '800px',
  height: undefined,
  showHeader: undefined,
  showLegend: undefined,
  autoTitle: undefined,
  defaultSelectableSelections: undefined,
  multiSelectableDimensionCode: undefined,
  selectableSelections: undefined,
  extensionSelectableSelections: undefined,
  extensionDefaultSelectableSelections: undefined,
  extensionMultiSelectableDimensionCode: undefined,
  locale: 'en',
  sorting: undefined,
  cutValueAxis: undefined,
};
