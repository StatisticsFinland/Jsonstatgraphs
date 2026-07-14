import { ResolvedTheme } from '../types';

export function getSeriesColor(theme: ResolvedTheme, index: number): string {
  const colors = theme.seriesColors;
  if (colors.length === 0) return '#4e79a7';
  return colors[index % colors.length];
}
