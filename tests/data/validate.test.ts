import { validateDataset } from '../../src/data/validate';

// Minimal valid dataset fixture
const minimalValid = {
  id: ['geo', 'year'],
  size: [2, 3],
  value: [1, 2, 3, 4, 5, 6],
  dimension: {
    geo: {
      category: {
        index: { FI: 0, SE: 1 },
      },
    },
    year: {
      category: {
        index: ['2020', '2021', '2022'],
      },
    },
  },
};

describe('validateDataset', () => {
  describe('valid datasets', () => {
    it('passes a valid minimal dataset', () => {
      const result = validateDataset(minimalValid);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes an empty/degenerate dataset (id: [], size: [], value: [])', () => {
      const result = validateDataset({ id: [], size: [], value: [], dimension: {} });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes when value contains null (missing value)', () => {
      const result = validateDataset({
        ...minimalValid,
        value: [1, null, 3, 4, 5, 6],
      });
      expect(result.valid).toBe(true);
    });

    it('passes when value contains string codes (e.g. "..")', () => {
      const result = validateDataset({
        ...minimalValid,
        value: [1, '..', 3, 4, 5, 6],
      });
      expect(result.valid).toBe(true);
    });

    it('passes when category.index is an object', () => {
      const result = validateDataset({
        id: ['geo'],
        size: [2],
        value: [10, 20],
        dimension: {
          geo: { category: { index: { FI: 0, SE: 1 } } },
        },
      });
      expect(result.valid).toBe(true);
    });

    it('passes when category.index is an array', () => {
      const result = validateDataset({
        id: ['year'],
        size: [3],
        value: [1, 2, 3],
        dimension: {
          year: { category: { index: ['2020', '2021', '2022'] } },
        },
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('rule 1 — dataset must be a non-null object', () => {
    it('fails when dataset is null', () => {
      const result = validateDataset(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_DATASET' }));
    });

    it('fails when dataset is a string', () => {
      const result = validateDataset('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_DATASET' }));
    });

    it('fails when dataset is an array', () => {
      const result = validateDataset([1, 2, 3]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_DATASET' }));
    });

    it('returns early after INVALID_DATASET — no other errors', () => {
      const result = validateDataset(42);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_DATASET');
    });
  });

  describe('rule 2 — id must be an array of strings', () => {
    it('fails when id is missing', () => {
      const { id: _id, ...rest } = minimalValid;
      const result = validateDataset(rest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MISSING_ID' }));
    });

    it('fails when id is not an array', () => {
      const result = validateDataset({ ...minimalValid, id: 'geo' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MISSING_ID' }));
    });

    it('fails when id contains non-string elements', () => {
      const result = validateDataset({ ...minimalValid, id: [1, 2] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_ID' }));
    });
  });

  describe('rule 3 — size must match id length', () => {
    it('fails when size is missing', () => {
      const { size: _size, ...rest } = minimalValid;
      const result = validateDataset(rest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MISSING_SIZE' }));
    });

    it('fails when size is not an array', () => {
      const result = validateDataset({ ...minimalValid, size: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MISSING_SIZE' }));
    });

    it('fails when size length does not match id length', () => {
      const result = validateDataset({ ...minimalValid, size: [2] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'SIZE_MISMATCH' }));
    });

    it('fails when size contains non-number elements', () => {
      const result = validateDataset({ ...minimalValid, size: [2, '3'] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_SIZE' }));
    });
  });

  describe('rule 4 — value length must match product of sizes', () => {
    it('fails when value is missing', () => {
      const { value: _value, ...rest } = minimalValid;
      const result = validateDataset(rest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MISSING_VALUE' }));
    });

    it('fails when value length does not match product of sizes', () => {
      const result = validateDataset({ ...minimalValid, value: [1, 2, 3] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'VALUE_LENGTH_MISMATCH' }));
    });

    it('includes actual and expected lengths in the error', () => {
      const result = validateDataset({ ...minimalValid, value: [1, 2, 3] });
      const err = result.errors.find((e) => e.code === 'VALUE_LENGTH_MISMATCH');
      expect(err?.message).toContain('3');
      expect(err?.message).toContain('6');
    });

    it('fails when value contains invalid types (boolean)', () => {
      const result = validateDataset({ ...minimalValid, value: [1, 2, 3, 4, 5, true] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_VALUE_TYPE' }));
    });
  });

  describe('rule 5 — dimension must have keys matching id', () => {
    it('fails when dimension is missing', () => {
      const { dimension: _dim, ...rest } = minimalValid;
      const result = validateDataset(rest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MISSING_DIMENSION' }));
    });

    it('fails when dimension is not an object', () => {
      const result = validateDataset({ ...minimalValid, dimension: 'not-an-object' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MISSING_DIMENSION' }));
    });

    it('fails when dimension is missing a required key', () => {
      const result = validateDataset({
        ...minimalValid,
        dimension: { geo: minimalValid.dimension.geo },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MISSING_DIMENSION_KEYS' }));
    });

    it('includes the missing key name in the error message', () => {
      const result = validateDataset({
        ...minimalValid,
        dimension: { geo: minimalValid.dimension.geo },
      });
      const err = result.errors.find((e) => e.code === 'MISSING_DIMENSION_KEYS');
      expect(err?.message).toContain('year');
    });
  });

  describe('rule 6 — each dimension must have category.index', () => {
    it('fails when a dimension is missing category', () => {
      const result = validateDataset({
        ...minimalValid,
        dimension: {
          ...minimalValid.dimension,
          geo: { label: 'Geography' } as never,
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MISSING_CATEGORY' }));
    });

    it('fails when category.index is missing', () => {
      const result = validateDataset({
        ...minimalValid,
        dimension: {
          ...minimalValid.dimension,
          geo: { category: { label: { FI: 'Finland', SE: 'Sweden' } } } as never,
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MISSING_CATEGORY_INDEX' }));
    });
  });

  describe('rule 7 — category count must match size', () => {
    it('fails when category object has wrong number of entries', () => {
      const result = validateDataset({
        ...minimalValid,
        dimension: {
          ...minimalValid.dimension,
          geo: { category: { index: { FI: 0 } } }, // only 1, size says 2
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'CATEGORY_SIZE_MISMATCH' }));
    });

    it('fails when category array has wrong length', () => {
      const result = validateDataset({
        id: ['year'],
        size: [3],
        value: [1, 2, 3],
        dimension: {
          year: { category: { index: ['2020', '2021'] } }, // only 2, size says 3
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'CATEGORY_SIZE_MISMATCH' }));
    });

    it('includes dimension name in the error message', () => {
      const result = validateDataset({
        ...minimalValid,
        dimension: {
          ...minimalValid.dimension,
          geo: { category: { index: { FI: 0 } } },
        },
      });
      const err = result.errors.find((e) => e.code === 'CATEGORY_SIZE_MISMATCH');
      expect(err?.message).toContain('geo');
    });
  });

  describe('multiple errors at once', () => {
    it('reports multiple distinct errors in one pass', () => {
      const result = validateDataset({
        id: ['geo', 'year'],
        size: [2], // SIZE_MISMATCH
        value: [1, 2, 3, 4, 5, 6],
        dimension: {
          geo: { category: { index: { FI: 0, SE: 1 } } },
          // year dimension missing → MISSING_DIMENSION_KEYS
        },
      });
      expect(result.valid).toBe(false);
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('SIZE_MISMATCH');
      expect(codes).toContain('MISSING_DIMENSION_KEYS');
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('reports VALUE_LENGTH_MISMATCH and CATEGORY_SIZE_MISMATCH together', () => {
      const result = validateDataset({
        id: ['geo'],
        size: [3],
        value: [1, 2], // too short
        dimension: {
          geo: { category: { index: { FI: 0 } } }, // only 1 category
        },
      });
      expect(result.valid).toBe(false);
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('VALUE_LENGTH_MISMATCH');
      expect(codes).toContain('CATEGORY_SIZE_MISMATCH');
    });
  });
});
