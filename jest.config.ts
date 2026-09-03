import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  maxWorkers: 4,
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tests/tsconfig.json' }],
    '^.+\\.js$': ['ts-jest', { useESM: true, tsconfig: { allowJs: true } }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: [
    '/node_modules/(?!(d3-array|d3-axis|d3-color|d3-format|d3-geo|d3-interpolate|d3-path|d3-scale|d3-selection|d3-shape|d3-time|d3-time-format|internmap|robust-predicates|delaunator)/)',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};

export default config;
