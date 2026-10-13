import {
  ZoneMeasurementContext,
  measureCategoricalRightMargin,
  measureCategoricalYAxisLabels,
} from '../../src/layout/zone-measurement';
import { DEFAULT_THEME } from '../../src/theme/defaults';

describe('measureCategoricalYAxisLabels', () => {
  it('uses supplied text metrics for numeric tick labels', () => {
    const context = {
      config: { locale: 'en' },
      theme: { ...DEFAULT_THEME, fontSizeTick: '24px' },
      yAxisTextMetrics: {
        lineHeight: 29,
        measureText: (text: string) => text.length * 15,
      },
    } as ZoneMeasurementContext;

    const width = measureCategoricalYAxisLabels(context, {
      chartType: 'verticalBar',
      categories: ['A', 'B'],
      valueRange: [0, 60],
      isHorizontal: false,
      isPercent: false,
      paddedValueRange: [0, 60],
      zeroBaselineForced: true,
    }, 800, 400);

    // The widest tick is "60": 2 characters × 15 px, plus the 16 px tick margin.
    expect(width).toBe(46);
  });

  it('reserves room for the final line-chart category label', () => {
    const context = {
      config: { locale: 'en' },
      theme: DEFAULT_THEME,
      xAxisTextMetrics: {
        lineHeight: 29,
        measureText: (text: string) => text.length * 15,
      },
    } as ZoneMeasurementContext;

    const rightMargin = measureCategoricalRightMargin(context, {
      chartType: 'line',
      categories: ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'],
      valueRange: [0, 60],
      isHorizontal: false,
      isPercent: false,
      paddedValueRange: [0, 60],
      zeroBaselineForced: true,
    }, 415, 61);

    expect(rightMargin).toBe(30);
  });
});