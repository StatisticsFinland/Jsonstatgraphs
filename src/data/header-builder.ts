import { DimensionMeta, HeaderBuildOptions, HeaderResult } from '../types';
import { getLocaleStrings } from '../locale/strings';

export function buildHeader(dimensions: DimensionMeta[], options: HeaderBuildOptions): HeaderResult {
  const locale = getLocaleStrings(options.locale);

  const contentDim = dimensions.find(d => d.type === 'Content');
  const timeDim = dimensions.find(d => d.type === 'Time');

  let header = '';

  // Step 1: Content dimension text
  if (contentDim) {
    const values = contentDim.values ?? [];
    if (values.length === 1) {
      header += values[0].name ?? '';
    } else {
      header += contentDim.name ?? '';
    }
  }

  // Step 2: Single-value non-Content non-Time dimension texts
  for (const dim of dimensions) {
    if (dim.type === 'Content' || dim.type === 'Time') continue;
    const values = dim.values ?? [];
    if (values.length !== 1) continue;
    const value = values[0];
    if (value.code === 'SSS') continue;
    const name = value.name ?? '';
    if (header.length > 0) header += ', ';
    header += name;
  }

  // Step 3: Time string
  if (timeDim && !options.selectableTimeDimension) {
    const timeValues = timeDim.values ?? [];
    let timeStr = '';
    if (timeValues.length > 1) {
      const firstName = timeValues[0]?.name ?? '';
      const lastName = timeValues[timeValues.length - 1]?.name ?? '';
      timeStr = `${firstName}\u2013${lastName}`;
    } else if (timeValues.length === 1) {
      timeStr = timeValues[0]?.name ?? '';
    }
    if (timeStr) {
      if (header.length > 0) header += ' ';
      header += timeStr;
    }
  }

  // Step 4: Multi-value dimension labels
  const multiValueDims = dimensions.filter(d => d.type !== 'Time' && (d.values?.length ?? 0) > 1);
  // Sort: Content first, then preserve original order
  multiValueDims.sort((a, b) => {
    if (a.type === 'Content') return -1;
    if (b.type === 'Content') return 1;
    return 0;
  });

  if (multiValueDims.length === 1) {
    const dim = multiValueDims[0];
    header += ` ${locale.titleVariable} ${dim.name ?? ''}`;
  } else if (multiValueDims.length >= 2) {
    const names = multiValueDims.map(dim => dim.name ?? '');
    header += ` ${locale.titleVariablePlural} ${names.join(', ')}`;
  }

  // Step 5: Header edit override
  if (options.headerEditOverride !== undefined) {
    header = options.headerEditOverride;
  }

  return { header };
}
