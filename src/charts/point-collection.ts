export interface IndexedNonNullPoint<T extends { value: number | null }> {
  point: T & { value: number };
  pointIndex: number;
}

export function collectIndexedNonNullPoints<T extends { value: number | null }>(
  points: readonly T[],
): IndexedNonNullPoint<T>[] {
  const indexedPoints: IndexedNonNullPoint<T>[] = [];
  points.forEach((point, pointIndex) => {
    if (point.value !== null) {
      indexedPoints.push({ point: point as T & { value: number }, pointIndex });
    }
  });
  return indexedPoints;
}