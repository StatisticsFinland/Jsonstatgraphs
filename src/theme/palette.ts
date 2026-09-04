import { ResolvedTheme } from '../types';

export function getSeriesColor(theme: ResolvedTheme, index: number): string {
  const colors = theme.seriesColors;
  if (colors.length === 0) return '#1A56EC';
  return colors[index % colors.length];
}
