import { ChartType, JsonStatDataset } from '../types';
import { buildExportFilename, downloadBlob } from './exportUtils';

export function supportsSvgExport(chartType?: ChartType): boolean {
  return chartType !== 'table' && chartType !== 'keyFigure';
}

export function findExportableSvg(container: HTMLElement): SVGSVGElement | null {
  return container.querySelector('svg');
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tagName: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}

function appendLegendToSvg(
  exportSvg: SVGSVGElement,
  legend: HTMLElement,
  containerRect: DOMRect,
): void {
  const legendItems = Array.from(legend.querySelectorAll('.jsc-legend-item')) as HTMLButtonElement[];
  if (!legendItems.length) {
    return;
  }

  const legendGroup = createSvgElement('g');
  legendGroup.setAttribute('data-jsc-export-legend', 'true');

  for (const item of legendItems) {
    const itemRect = item.getBoundingClientRect();
    const itemX = itemRect.left - containerRect.left;
    const itemY = itemRect.top - containerRect.top;

    const itemGroup = createSvgElement('g');
    itemGroup.setAttribute('transform', `translate(${itemX} ${itemY})`);
    const itemOpacity = Number(getComputedStyle(item).opacity);
    if (!Number.isNaN(itemOpacity) && itemOpacity < 1) {
      itemGroup.setAttribute('opacity', String(itemOpacity));
    }

    const swatch = item.querySelector('.jsc-legend-swatch') as HTMLElement | null;
    if (swatch) {
      const swatchRect = swatch.getBoundingClientRect();
      const swatchX = swatchRect.left - itemRect.left;
      const swatchY = swatchRect.top - itemRect.top;
      const swatchWidth = swatchRect.width;
      const swatchHeight = swatchRect.height;

      const swatchSvg = swatch.querySelector('svg');
      if (swatchSvg) {
        const swatchSvgClone = swatchSvg.cloneNode(true) as SVGSVGElement;
        swatchSvgClone.setAttribute('x', String(swatchX));
        swatchSvgClone.setAttribute('y', String(swatchY));
        swatchSvgClone.setAttribute('width', String(swatchWidth));
        swatchSvgClone.setAttribute('height', String(swatchHeight));
        itemGroup.appendChild(swatchSvgClone);
      } else {
        const swatchBox = createSvgElement('rect');
        swatchBox.setAttribute('x', String(swatchX));
        swatchBox.setAttribute('y', String(swatchY));
        swatchBox.setAttribute('width', String(swatchWidth));
        swatchBox.setAttribute('height', String(swatchHeight));
        swatchBox.setAttribute('rx', '2');
        swatchBox.setAttribute('ry', '2');

        const swatchStyles = getComputedStyle(swatch);
        swatchBox.setAttribute('fill', swatchStyles.backgroundColor || '#000000');
        itemGroup.appendChild(swatchBox);
      }
    }

    const label = item.querySelector('span:last-child') as HTMLElement | null;
    if (label) {
      const labelRect = label.getBoundingClientRect();
      const text = createSvgElement('text');
      text.textContent = label.textContent ?? '';
      text.setAttribute('x', String(labelRect.left - itemRect.left));
      text.setAttribute('y', String(labelRect.top - itemRect.top + labelRect.height * 0.78));

      const labelStyle = getComputedStyle(label);
      const itemStyle = getComputedStyle(item);
      text.setAttribute('fill', itemStyle.color || '#000000');
      text.setAttribute('font-family', labelStyle.fontFamily);
      text.setAttribute('font-size', String(parseFloat(labelStyle.fontSize) || 12));
      itemGroup.appendChild(text);

      if (labelStyle.textDecorationLine.includes('line-through') && labelRect.width > 0) {
        const strike = createSvgElement('line');
        const lineY = labelRect.top - itemRect.top + (labelRect.height * 0.52);
        strike.setAttribute('x1', String(labelRect.left - itemRect.left));
        strike.setAttribute('y1', String(lineY));
        strike.setAttribute('x2', String(labelRect.left - itemRect.left + labelRect.width));
        strike.setAttribute('y2', String(lineY));
        strike.setAttribute('stroke', itemStyle.color || '#000000');
        strike.setAttribute('stroke-width', '1');
        itemGroup.appendChild(strike);
      }
    }

    legendGroup.appendChild(itemGroup);
  }

  exportSvg.appendChild(legendGroup);
}

export function buildExportableSvg(container: HTMLElement): SVGSVGElement | null {
  const sourceSvg = findExportableSvg(container);
  if (!sourceSvg) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  const sourceRect = sourceSvg.getBoundingClientRect();

  const exportWidth = containerRect.width
    || sourceRect.width
    || sourceSvg.clientWidth
    || Number(sourceSvg.getAttribute('width'))
    || 0;
  const exportHeight = containerRect.height
    || sourceRect.height
    || sourceSvg.clientHeight
    || Number(sourceSvg.getAttribute('height'))
    || 0;

  if (exportWidth <= 0 || exportHeight <= 0) {
    return sourceSvg;
  }

  const exportSvg = createSvgElement('svg');
  exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  exportSvg.setAttribute('width', String(exportWidth));
  exportSvg.setAttribute('height', String(exportHeight));
  exportSvg.setAttribute('viewBox', `0 0 ${exportWidth} ${exportHeight}`);

  const chartGroup = createSvgElement('g');
  const chartOffsetX = sourceRect.left - containerRect.left;
  const chartOffsetY = sourceRect.top - containerRect.top;
  chartGroup.setAttribute('transform', `translate(${chartOffsetX} ${chartOffsetY})`);

  const clonedSourceSvg = sourceSvg.cloneNode(true) as SVGSVGElement;
  if (sourceRect.width > 0) {
    clonedSourceSvg.setAttribute('width', String(sourceRect.width));
  }
  if (sourceRect.height > 0) {
    clonedSourceSvg.setAttribute('height', String(sourceRect.height));
  }
  chartGroup.appendChild(clonedSourceSvg);
  exportSvg.appendChild(chartGroup);

  const legend = container.querySelector('.jsc-legend') as HTMLElement | null;
  if (legend) {
    appendLegendToSvg(exportSvg, legend, containerRect);
  }

  return exportSvg;
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

  const svg = buildExportableSvg(container);
  if (!svg) {
    return false;
  }

  const serializedSvg = serializeSvg(svg);
  const blob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, buildExportFilename(dataset, 'svg'));
  return true;
}
