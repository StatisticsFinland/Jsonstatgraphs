/** Returns category codes in their declared JSON-stat order. */
export function getOrderedCodes(index: Record<string, number> | string[]): string[] {
  if (Array.isArray(index)) return index;
  return Object.keys(index).sort((a, b) => index[a] - index[b]);
}

/** Computes row-major strides for a JSON-stat size vector. */
export function computeStrides(size: number[]): number[] {
  const strides = new Array<number>(size.length).fill(1);
  for (let index = size.length - 2; index >= 0; index--) {
    strides[index] = strides[index + 1] * size[index + 1];
  }
  return strides;
}

/** Computes a flat row-major index from per-dimension coordinates. */
export function computeFlatIndex(indices: number[], strides: number[]): number {
  return indices.reduce((offset, index, dimensionIndex) => offset + index * strides[dimensionIndex], 0);
}