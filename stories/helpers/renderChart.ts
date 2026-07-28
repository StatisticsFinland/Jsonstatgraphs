import { createChart } from '../../src';
import type { JsonStatDataset, ChartConfig, ChartInstance, SelectableConfig, SelectableSelections } from '../../src/types';

export interface RenderChartArgs {
  dataset: JsonStatDataset;
  config?: ChartConfig;
  selectableSelections?: SelectableSelections;
  width?: string;
  height?: string;
  selectableConfig?: SelectableConfig;
}

function withSelectableConfig(dataset: JsonStatDataset, selectableConfig: SelectableConfig | undefined): JsonStatDataset {
  if (!selectableConfig) return dataset;
  return {
    ...dataset,
    extension: {
      ...dataset.extension,
      selectableConfig: {
        ...(dataset.extension?.selectableConfig as SelectableConfig | undefined),
        ...selectableConfig,
      },
    },
  };
}

export function renderChart(args: RenderChartArgs): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.width = '100%';
  wrapper.style.maxWidth = args.width ?? '800px';
  wrapper.style.height = args.height ?? 'calc(100vh - 40px)';
  wrapper.style.minHeight = '200px';
  wrapper.style.boxSizing = 'border-box';
  wrapper.style.margin = '20px auto';

  wrapper.setAttribute('role', 'figure');
  wrapper.setAttribute('aria-label', 'Chart loading');

  // Defer chart creation until element is in DOM
  requestAnimationFrame(() => {
    if (wrapper.isConnected) {
      const instance: ChartInstance = createChart(
        wrapper,
        withSelectableConfig(args.dataset, args.selectableConfig),
        { locale: 'en', ...args.config },
        args.selectableSelections,
      );
      // Store instance for cleanup in preview decorator
      (wrapper as any).__jscInstance = instance;
    }
  });

  return wrapper;
}
