import type { JsonStatDataset } from '../types';
import { getOrderedCodes } from './dataset-utils';

/** Resolves ordered, de-duplicated source text for the active dataset. */
export function resolveDatasetSource(dataset: JsonStatDataset): string | undefined {
  const sources = dataset.extension?.jsonstatChart?.sources;
  const metricDimensions = (dataset.role?.metric ?? [])
    .filter(dimensionCode => dataset.dimension[dimensionCode] !== undefined);

  if (metricDimensions.length === 0) {
    return dataset.source?.trim() ? dataset.source : undefined;
  }

  const resolvedSources: string[] = [];
  const seenSources = new Set<string>();

  for (const dimensionCode of metricDimensions) {
    const dimension = dataset.dimension[dimensionCode];
    const categorySources = sources?.category?.[dimensionCode];
    const dimensionSource = sources?.dimension?.[dimensionCode];

    for (const categoryCode of getOrderedCodes(dimension.category.index)) {
      const source = [categorySources?.[categoryCode], dimensionSource, dataset.source]
        .find(candidate => candidate?.trim());
      if (!source?.trim() || seenSources.has(source)) continue;
      seenSources.add(source);
      resolvedSources.push(source);
    }
  }

  return resolvedSources.length > 0 ? resolvedSources.join(', ') : undefined;
}