import type { JsonStatDataset } from '../../src/types';

type ScatterPattern = 'spread' | 'clustered' | 'overlapping';

export interface ScatterDatasetOptions {
  count: number;
  pattern: ScatterPattern;
  seed?: number;
}

/** Creates deterministic scatter data for comparing point-density behavior in Storybook. */
export function createScatterDataset({ count, pattern, seed = 0 }: ScatterDatasetOptions): JsonStatDataset {
  const labels: Record<string, string> = {};
  const values: number[] = [];

  for (let index = 0; index < count; index++) {
    const code = `point-${index + 1}`;
    labels[code] = `Point ${index + 1}`;

    const fraction = count === 1 ? 0 : index / (count - 1);
    const alternate = (index * 37 + seed * 11) % 101 / 100;
    let x: number;
    let y: number;

    if (pattern === 'clustered') {
      x = 42 + (index % 10) * 1.8 + alternate * 0.6;
      y = 44 + Math.floor(index / 10) * 1.8 + alternate * 0.6;
    } else if (pattern === 'overlapping') {
      x = 50 + (index % 4 === 0 ? 0 : (index % 3) * 0.18);
      y = 50 + (index % 5 === 0 ? 0 : (index % 4) * 0.18);
    } else {
      x = 5 + fraction * 90;
      y = 8 + ((index * 47 + seed * 13) % 89);
    }

    values.push(Math.round(x * 100) / 100, Math.round(y * 100) / 100);
  }

  const codes = Array.from({ length: count }, (_, index) => `point-${index + 1}`);
  return {
    version: '2.0',
    class: 'dataset',
    label: `${pattern} scatter plot (${count} points)`,
    id: ['observation', 'metric'],
    size: [count, 2],
    dimension: {
      observation: {
        label: 'Observation',
        category: { index: codes, label: labels },
      },
      metric: {
        label: 'Metric',
        category: {
          index: ['x', 'y'],
          label: { x: 'X value', y: 'Y value' },
        },
      },
    },
    value: values,
    role: { metric: ['metric'] },
  };
}
