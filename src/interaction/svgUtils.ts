import { ChartType, JsonStatDataset } from '../types';
import { buildExportFilename, downloadBlob } from './exportUtils';

export function supportsSvgExport(chartType?: ChartType): boolean {
  return chartType !== 'table' && chartType !== 'keyFigure';
}

export function findExportableSvg(container: HTMLElement): SVGSVGElement | null {
  return container.querySelector('svg');
}

export function serializeSvg(svg: SVGSVGElement): string {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}

export function exportSvg(
  container: HTMLElement,
  dataset: JsonStatDataset,
  chartType?: ChartType,
): boolean {
  if (!supportsSvgExport(chartType)) {
    return false;
  }

  const svg = findExportableSvg(container);
  if (!svg) {
    return false;
  }

  const serializedSvg = serializeSvg(svg);
  const blob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, buildExportFilename(dataset, 'svg'));
  return true;
}
