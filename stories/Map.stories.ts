import type { Meta, StoryObj } from '@storybook/html-vite';
import { renderChart, storeChartInstance } from './helpers/renderChart';
import { buildConfig } from './helpers/buildConfig';
import { themeArgTypes, themeArgs } from './helpers/sharedArgs';
import { getSelectableStoryInputs } from './helpers/selectables';
import { createChart } from '../src';
import type { GeoJsonFeatureCollection, ChartInstance, ClassificationMethod } from '../src/types';

// Import fixture data
import maakuntaData from './fixtures/map-maakunta-establishments.json';
import selectableMaakuntaData from './fixtures/map-maakunta-establishments-selectable.json';
import maakuntaGeo from './fixtures/geo-maakunta4500k.geojson';
import kuntaData from './fixtures/map-kunta-population.json';
import kuntaGeo from './fixtures/geo-kunta4500k.geojson';
import hvaData from './fixtures/map-hyvinvointialue-deaths.json';
import hvaGeo from './fixtures/geo-hyvinvointialue4500k.geojson';

/** Creates a mapProvider that returns the given geometry instantly (simulates cache hit). */
function instantProvider(geo: GeoJsonFeatureCollection) {
  return async (_dimId: string, _codes: string[], _signal: AbortSignal, _timeCode?: string) => geo;
}

const meta: Meta = {
  title: 'Charts/Map',
  argTypes: {
    ...themeArgTypes,
    // Map has no chart value axis or category ordering — sorting/cutValueAxis have no effect here.
    sorting: { table: { disable: true } },
    cutValueAxis: { table: { disable: true } },
  },
  args: { ...themeArgs, width: '600px' },
};
export default meta;

export const Regions: StoryObj = {
  render: (args) => renderChart({
    dataset: maakuntaData,
    config: buildConfig(args, {
      chartType: 'map' as const,
      mapProvider: instantProvider(maakuntaGeo),
      map: {
        geoIdProperty: 'maakunta',
        geoCodeMapper: (code: string) => code.replace(/^MK/, ''),
      },
    }),
    width: args.width as string,
    height: args.height as string | undefined,
  }),
};

export const TitleHiddenWhenHeaderDisabled: StoryObj = {
  render: () => renderChart({
    dataset: maakuntaData,
    config: {
      chartType: 'map',
      title: 'This title should not be rendered',
      showHeader: false,
      mapProvider: instantProvider(maakuntaGeo),
      map: {
        geoIdProperty: 'maakunta',
        geoCodeMapper: (code: string) => code.replace(/^MK/, ''),
      },
    },
    width: '600px',
  }),
};

export const SelectableYear: StoryObj = {
  render: (args) => renderChart({
    dataset: selectableMaakuntaData,
    config: buildConfig(args, {
      chartType: 'map' as const,
      mapProvider: instantProvider(maakuntaGeo),
      map: {
        geoIdProperty: 'maakunta',
        geoCodeMapper: (code: string) => code.replace(/^MK/, ''),
      },
    }),
    selectableSelections: { vuosi: ['2025'] },
    width: args.width as string,
    height: args.height as string | undefined,
    ...getSelectableStoryInputs(args),
  }),
};

export const Municipalities: StoryObj = {
  render: (args) => renderChart({
    dataset: kuntaData,
    config: buildConfig(args, {
      chartType: 'map' as const,
      mapProvider: instantProvider(kuntaGeo),
      map: {
        geoIdProperty: 'kunta',
        geoCodeMapper: (code: string) => code.replace(/^KU/, ''),
      },
    }),
    width: args.width as string,
    height: args.height as string | undefined,
  }),
};

export const WellbeingCounties: StoryObj = {
  render: (args) => renderChart({
    dataset: hvaData,
    config: buildConfig(args, {
      chartType: 'map' as const,
      mapProvider: instantProvider(hvaGeo),
      map: {
        geoIdProperty: 'hyvinvointialue',
        geoCodeMapper: (code: string) => code.replace(/^HVA/, ''),
      },
    }),
    width: args.width as string,
    height: args.height as string | undefined,
  }),
};

export const CustomColors: StoryObj = {
  args: { mapColors: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'] },
  render: (args) => renderChart({
    dataset: maakuntaData,
    config: buildConfig(args, {
      chartType: 'map' as const,
      mapProvider: instantProvider(maakuntaGeo),
      map: {
        geoIdProperty: 'maakunta',
        geoCodeMapper: (code: string) => code.replace(/^MK/, ''),
      },
    }),
    width: args.width as string,
    height: args.height as string | undefined,
  }),
};

export const DelayedLoading: StoryObj = {
  name: 'Delayed Loading',
  render: (args) => renderChart({
    dataset: maakuntaData,
    config: buildConfig(args, {
      chartType: 'map' as const,
      mapProvider: (_dimId, _codes, _signal, _timeCode) => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(maakuntaGeo), 1500);
        });
      },
      map: {
        geoIdProperty: 'maakunta',
        geoCodeMapper: (code: string) => code.replace(/^MK/, ''),
      },
    }),
    width: args.width as string,
    height: args.height as string | undefined,
  }),
};

export const ClassificationSwitcher: StoryObj = {
  name: 'Classification Switcher',
  render: () => {
    const wrapper = document.createElement('div');

    const controls = document.createElement('div');
    controls.style.padding = '12px 20px';
    controls.style.fontFamily = 'system-ui, sans-serif';

    const label = document.createElement('label');
    label.textContent = 'Classification: ';
    label.style.marginRight = '8px';
    label.htmlFor = 'jsc-classification-method';

    const select = document.createElement('select');
    select.id = 'jsc-classification-method';
    const methods: ClassificationMethod[] = ['jenks-nice', 'jenks', 'even-ranges', 'linear'];
    methods.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      select.appendChild(opt);
    });

    controls.appendChild(label);
    controls.appendChild(select);
    wrapper.appendChild(controls);

    const chartContainer = document.createElement('div');
    chartContainer.style.width = '100%';
    chartContainer.style.maxWidth = '600px';
    chartContainer.style.height = 'calc(100vh - 80px)';
    chartContainer.style.minHeight = '200px';
    chartContainer.style.boxSizing = 'border-box';
    chartContainer.style.margin = '0 auto';
    wrapper.appendChild(chartContainer);

    const provider = async () => kuntaGeo;
    const mapConfig = {
      geoIdProperty: 'kunta' as const,
      geoCodeMapper: (code: string) => code.replace(/^KU/, ''),
    };

    let instance: ChartInstance | null = null;
    requestAnimationFrame(() => {
      if (wrapper.isConnected) {
        instance = createChart(
          chartContainer,
          kuntaData,
          {
            chartType: 'map',
            locale: 'en',
            mapProvider: provider,
            map: { ...mapConfig, classificationMethod: 'jenks-nice' },
          },
        );
        storeChartInstance(wrapper, instance);

        select.addEventListener('change', () => {
          const method = select.value as ClassificationMethod;
          instance?.update(kuntaData, {
            chartType: 'map',
            locale: 'en',
            mapProvider: provider,
            map: { ...mapConfig, classificationMethod: method },
          });
        });
      }
    });

    return wrapper;
  },
};
