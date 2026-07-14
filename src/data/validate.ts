export interface ValidationError {
  code: string;
  message: string;
}

export function validateDataset(dataset: unknown): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  // Rule 1: dataset must be a non-null object
  if (typeof dataset !== 'object' || dataset === null || Array.isArray(dataset)) {
    errors.push({ code: 'INVALID_DATASET', message: 'Dataset must be a non-null object.' });
    return { valid: false, errors };
  }

  const ds = dataset as Record<string, unknown>;

  // Rule 2: id must be an array of strings
  let idValid = false;
  if (!Array.isArray(ds['id'])) {
    errors.push({ code: 'MISSING_ID', message: 'Dataset.id must be an array of strings.' });
  } else if (!(ds['id'] as unknown[]).every((item) => typeof item === 'string')) {
    errors.push({ code: 'INVALID_ID', message: 'Dataset.id must contain only strings.' });
  } else {
    idValid = true;
  }

  // Rule 3: size must be an array of numbers with the same length as id
  let sizeValid = false;
  if (!Array.isArray(ds['size'])) {
    errors.push({ code: 'MISSING_SIZE', message: 'Dataset.size must be an array of numbers.' });
  } else if (!(ds['size'] as unknown[]).every((item) => typeof item === 'number')) {
    errors.push({ code: 'INVALID_SIZE', message: 'Dataset.size must contain only numbers.' });
  } else if (idValid && (ds['size'] as unknown[]).length !== (ds['id'] as string[]).length) {
    errors.push({
      code: 'SIZE_MISMATCH',
      message: `Dataset.size length (${(ds['size'] as unknown[]).length}) must match Dataset.id length (${(ds['id'] as string[]).length}).`,
    });
  } else {
    sizeValid = idValid;
  }

  // Rule 4: value must be an array whose length equals the product of all size elements
  if (!Array.isArray(ds['value'])) {
    errors.push({ code: 'MISSING_VALUE', message: 'Dataset.value must be an array.' });
  } else {
    const value = ds['value'] as unknown[];

    if (sizeValid) {
      const size = ds['size'] as number[];
      const expectedLength = size.length === 0 ? 0 : size.reduce((acc, n) => acc * n, 1);
      if (value.length !== expectedLength) {
        errors.push({
          code: 'VALUE_LENGTH_MISMATCH',
          message: `Dataset.value length (${value.length}) must equal the product of all size values (${expectedLength}).`,
        });
      }
    }

    // Rule 8: each value must be number, null, or string
    const hasInvalidValue = value.some((v) => typeof v !== 'number' && v !== null && typeof v !== 'string');
    if (hasInvalidValue) {
      errors.push({ code: 'INVALID_VALUE_TYPE', message: 'Dataset.value elements must be number, null, or string.' });
    }
  }

  // Rule 5: dimension must be an object with keys matching each entry in id
  if (typeof ds['dimension'] !== 'object' || ds['dimension'] === null || Array.isArray(ds['dimension'])) {
    errors.push({ code: 'MISSING_DIMENSION', message: 'Dataset.dimension must be a non-null object.' });
  } else if (idValid) {
    const dimension = ds['dimension'] as Record<string, unknown>;
    const id = ds['id'] as string[];

    const missingKeys = id.filter((key) => !(key in dimension));
    if (missingKeys.length > 0) {
      errors.push({
        code: 'MISSING_DIMENSION_KEYS',
        message: `Dataset.dimension is missing keys: ${missingKeys.join(', ')}.`,
      });
    }

    // Rules 6 & 7: each dimension must have category.index and category count must match size
    for (let i = 0; i < id.length; i++) {
      const dimKey = id[i];
      const dim = dimension[dimKey];
      if (dim === undefined) continue; // already reported as missing key

      if (typeof dim !== 'object' || dim === null) {
        errors.push({ code: 'INVALID_DIMENSION', message: `Dimension "${dimKey}" must be an object.` });
        continue;
      }

      const dimObj = dim as Record<string, unknown>;
      if (typeof dimObj['category'] !== 'object' || dimObj['category'] === null) {
        errors.push({ code: 'MISSING_CATEGORY', message: `Dimension "${dimKey}" must have a category object.` });
        continue;
      }

      const category = dimObj['category'] as Record<string, unknown>;
      if (category['index'] === undefined || category['index'] === null) {
        errors.push({
          code: 'MISSING_CATEGORY_INDEX',
          message: `Dimension "${dimKey}" category must have an index property.`,
        });
        continue;
      }

      if (!Array.isArray(category['index']) && typeof category['index'] !== 'object') {
        errors.push({
          code: 'INVALID_CATEGORY_INDEX',
          message: `Dimension "${dimKey}" category.index must be an array or object.`,
        });
        continue;
      }

      // Rule 7: category count must match size
      if (sizeValid) {
        const expectedSize = (ds['size'] as number[])[i];
        const actualSize = Array.isArray(category['index'])
          ? (category['index'] as unknown[]).length
          : Object.keys(category['index'] as object).length;

        if (actualSize !== expectedSize) {
          errors.push({
            code: 'CATEGORY_SIZE_MISMATCH',
            message: `Dimension "${dimKey}" has ${actualSize} categories but size specifies ${expectedSize}.`,
          });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
