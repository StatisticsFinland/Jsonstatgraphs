import type { ChartConfig, ThemeConfig } from '../../src/types';

interface StoryArgs {
  [key: string]: unknown;
}

const themeKeys = [
  'fontFamily',
  'fontSizeTick',
  'fontSizeLabel',
  'fontSizeTitle',
  'colorBackground',
  'colorText',
  'colorTextSecondary',
  'colorBorder',
  'colorTick',
  'seriesColors',
  'mapColors',
] as const;

export function buildConfig(args: StoryArgs, baseConfig?: ChartConfig): ChartConfig {
  const theme: ThemeConfig = {};

  for (const key of themeKeys) {
    if (args[key] !== undefined) {
      (theme as Record<string, unknown>)[key] = args[key];
    }
  }

  const config: ChartConfig = { ...baseConfig };

  if (Object.keys(theme).length > 0) {
    config.theme = { ...baseConfig?.theme, ...theme };
  }

  if (args.showHeader !== undefined) config.showHeader = args.showHeader as boolean;
  if (args.showLegend !== undefined) config.showLegend = args.showLegend as boolean;
  if (args.autoTitle !== undefined) config.autoTitle = args.autoTitle as boolean;
  if (args.locale !== undefined) config.locale = args.locale as string;

  // Map config
  if (args.classificationMethod !== undefined || args.classCount !== undefined) {
    config.map = { ...baseConfig?.map };
    if (args.classificationMethod !== undefined) {
      config.map.classificationMethod = args.classificationMethod as 'jenks' | 'jenks-nice' | 'even-ranges' | 'linear';
    }
    if (args.classCount !== undefined) {
      config.map.classCount = args.classCount as number;
    }
  }

  return config;
}
