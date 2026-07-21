import { ChartType, JsonStatDataset } from '../types';
import { buildExportFilename, downloadBlob } from './exportUtils';
import { findExportableSvg, supportsSvgExport } from './svgUtils';

function createSvgBlobUrl(svg: SVGSVGElement): string {
  const serializer = new XMLSerializer();
  const serializedSvg = serializer.serializeToString(svg);
  const svgBlob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' });
  return URL.createObjectURL(svgBlob);
}

export function exportPng(
  container: HTMLElement,
  dataset: JsonStatDataset,
  chartType?: ChartType,
): Promise<boolean> {
  if (!supportsSvgExport(chartType)) {
    return Promise.resolve(false);
  }

  const svg = findExportableSvg(container);
  if (!svg) {
    return Promise.resolve(false);
  }

  const width = svg.clientWidth || svg.getBoundingClientRect().width || Number(svg.getAttribute('width')) || 0;
  const height = svg.clientHeight || svg.getBoundingClientRect().height || Number(svg.getAttribute('height')) || 0;
  if (width <= 0 || height <= 0) {
    return Promise.resolve(false);
  }

  const svgUrl = createSvgBlobUrl(svg);

  return new Promise<boolean>((resolve) => {
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(svgUrl);

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);

      const context = canvas.getContext('2d');
      if (!context) {
        resolve(false);
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) {
          resolve(false);
          return;
        }

        downloadBlob(blob, buildExportFilename(dataset, 'png'));
        resolve(true);
      }, 'image/png');
    };

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      resolve(false);
    };

    image.src = svgUrl;
  });
}
