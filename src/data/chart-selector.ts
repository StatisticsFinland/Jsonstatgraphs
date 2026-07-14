import { ChartType, ChartTypeResult, DimensionMeta } from '../types';
import { ChartRejectionReason } from './chart-rejection-reason';
export { ChartRejectionReason } from './chart-rejection-reason';

export interface DataProperties {
  hasActualData: boolean;
  hasMissingData: boolean;
  hasNegativeData: boolean;
}

export interface ChartSelectorOptions {
  mapAvailable?: boolean;
}

interface DerivedProperties {
  multiselectDimensions: DimensionMeta[];
  multiselectCount: number;
  firstMultiselect: DimensionMeta | null;
  secondMultiselect: DimensionMeta | null;
  additionalDimensions: DimensionMeta[];
  timeDimension: DimensionMeta | null;
  contentDimension: DimensionMeta | null;
  productOfMultiselects: number;
  timeOrLargestOrdinal: DimensionMeta | null;
  geoDimension: DimensionMeta | null;
}

function computeDerivedProperties(dimensions: DimensionMeta[]): DerivedProperties {
  const multiselectDimensions = [...dimensions]
    .filter(d => d.size > 1)
    .sort((a, b) => b.size - a.size);

  const multiselectCount = multiselectDimensions.length;

  const firstMultiselect = multiselectDimensions[0] ?? null;
  const secondMultiselect = multiselectDimensions[1] ?? null;
  const additionalDimensions = multiselectDimensions.slice(2);

  const timeDimension = dimensions.find(d => d.type === 'Time') ?? null;
  const contentDimension = dimensions.find(d => d.type === 'Content') ?? null;

  const productOfMultiselects =
    multiselectDimensions.length === 0
      ? 1
      : multiselectDimensions.reduce((acc, d) => acc * d.size, 1);

  const timeMultiselect = multiselectDimensions.find(d => d.type === 'Time') ?? null;
  let timeOrLargestOrdinal: DimensionMeta | null = null;
  if (timeMultiselect) {
    timeOrLargestOrdinal = timeMultiselect;
  } else {
    // Already sorted descending by size — first Ordinal is the largest
    timeOrLargestOrdinal = multiselectDimensions.find(d => d.type === 'Ordinal') ?? null;
  }

  const geoDimension =
    dimensions.find(d => d.type === 'Geo' && d.size > 1) ??
    dimensions.find(d => d.type === 'Geo') ??
    null;

  return {
    multiselectDimensions,
    multiselectCount,
    firstMultiselect,
    secondMultiselect,
    additionalDimensions,
    timeDimension,
    contentDimension,
    productOfMultiselects,
    timeOrLargestOrdinal,
    geoDimension,
  };
}

// --- Per-type check functions ---

function checkLineChart(dp: DataProperties, d: DerivedProperties): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  if (!dp.hasActualData) r.push(ChartRejectionReason.NoActualData);
  if (d.multiselectCount > 999) r.push(ChartRejectionReason.TooManyMultiselectDimensions);
  if (d.multiselectCount < 1) r.push(ChartRejectionReason.TooFewMultiselectDimensions);
  const contentUnits = d.contentDimension?.numberOfUnits ?? 1;
  if (contentUnits !== 1) r.push(ChartRejectionReason.ContentHasMultipleUnits);
  if (d.timeDimension?.isIrregular === true) r.push(ChartRejectionReason.IrregularTimeNotAllowed);
  const firstSize = d.firstMultiselect?.size ?? 0;
  if (firstSize < 2 || firstSize > 999) r.push(ChartRejectionReason.FirstMultiselectSizeOutOfRange);
  if (d.additionalDimensions.length > 5) r.push(ChartRejectionReason.TooManyAdditionalDimensions);
  if (!d.timeOrLargestOrdinal) r.push(ChartRejectionReason.NoTimeOrOrdinalAxisDimension);
  const axisCode = d.timeOrLargestOrdinal?.code;
  const productExcludingAxis = d.multiselectDimensions
    .filter(dim => dim.code !== axisCode)
    .reduce((acc, dim) => acc * dim.size, 1);
  if (productExcludingAxis > 10) r.push(ChartRejectionReason.ProductOfNonAxisMultiselectsTooLarge);
  return r;
}

function checkVerticalBar(dp: DataProperties, d: DerivedProperties): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  if (!dp.hasActualData) r.push(ChartRejectionReason.NoActualData);
  if (d.multiselectCount > 1) r.push(ChartRejectionReason.TooManyMultiselectDimensions);
  if (d.multiselectCount < 1) r.push(ChartRejectionReason.TooFewMultiselectDimensions);
  const contentUnits = d.contentDimension?.numberOfUnits ?? 1;
  if (contentUnits !== 1) r.push(ChartRejectionReason.ContentHasMultipleUnits);
  if (d.timeDimension?.isIrregular === true && d.timeDimension.size > 10)
    r.push(ChartRejectionReason.IrregularTimeSizeTooLarge);
  const firstSize = d.firstMultiselect?.size ?? 0;
  if (firstSize < 2 || firstSize > 999) r.push(ChartRejectionReason.FirstMultiselectSizeOutOfRange);
  if (d.secondMultiselect !== null) r.push(ChartRejectionReason.SecondMultiselectNotAllowed);
  if (d.additionalDimensions.length > 1) r.push(ChartRejectionReason.TooManyAdditionalDimensions);
  if (!d.timeOrLargestOrdinal) r.push(ChartRejectionReason.NoTimeOrOrdinalAxisDimension);
  return r;
}

function checkGroupedVerticalBar(dp: DataProperties, d: DerivedProperties): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  if (!dp.hasActualData) r.push(ChartRejectionReason.NoActualData);
  if (d.multiselectCount > 2) r.push(ChartRejectionReason.TooManyMultiselectDimensions);
  if (d.multiselectCount < 2) r.push(ChartRejectionReason.TooFewMultiselectDimensions);
  const contentUnits = d.contentDimension?.numberOfUnits ?? 1;
  if (contentUnits !== 1) r.push(ChartRejectionReason.ContentHasMultipleUnits);
  if (d.timeDimension?.isIrregular === true && d.timeDimension.size > 10)
    r.push(ChartRejectionReason.IrregularTimeSizeTooLarge);
  const firstSize = d.firstMultiselect?.size ?? 0;
  if (firstSize < 1 || firstSize > 20) r.push(ChartRejectionReason.FirstMultiselectSizeOutOfRange);
  const secondSize = d.secondMultiselect?.size ?? 0;
  if (secondSize < 2 || secondSize > 4) r.push(ChartRejectionReason.SecondMultiselectSizeOutOfRange);
  if (d.additionalDimensions.length > 1) r.push(ChartRejectionReason.TooManyAdditionalDimensions);
  const product = d.productOfMultiselects;
  if (product < 1 || product > 40) r.push(ChartRejectionReason.ProductOfMultiselectsOutOfRange);
  if (!d.timeOrLargestOrdinal) r.push(ChartRejectionReason.NoTimeOrOrdinalAxisDimension);
  if (d.firstMultiselect?.eliminationValueCode != null)
    r.push(ChartRejectionReason.FirstMultiselectHasEliminationValues);
  if (d.secondMultiselect?.eliminationValueCode != null)
    r.push(ChartRejectionReason.SecondMultiselectHasEliminationValues);
  return r;
}

function checkStackedVerticalBar(dp: DataProperties, d: DerivedProperties): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  if (!dp.hasActualData) r.push(ChartRejectionReason.NoActualData);
  if (d.multiselectCount > 2) r.push(ChartRejectionReason.TooManyMultiselectDimensions);
  if (d.multiselectCount < 2) r.push(ChartRejectionReason.TooFewMultiselectDimensions);
  const contentUnits = d.contentDimension?.numberOfUnits ?? 1;
  if (contentUnits !== 1) r.push(ChartRejectionReason.ContentHasMultipleUnits);
  if (d.timeDimension?.isIrregular === true && d.timeDimension.size > 10)
    r.push(ChartRejectionReason.IrregularTimeSizeTooLarge);
  const firstSize = d.firstMultiselect?.size ?? 0;
  if (firstSize < 2 || firstSize > 40) r.push(ChartRejectionReason.FirstMultiselectSizeOutOfRange);
  const secondSize = d.secondMultiselect?.size ?? 0;
  if (secondSize < 2 || secondSize > 10) r.push(ChartRejectionReason.SecondMultiselectSizeOutOfRange);
  if (d.additionalDimensions.length > 1) r.push(ChartRejectionReason.TooManyAdditionalDimensions);
  if (!d.timeOrLargestOrdinal) r.push(ChartRejectionReason.NoTimeOrOrdinalAxisDimension);
  if (dp.hasNegativeData) r.push(ChartRejectionReason.NegativeDataNotAllowed);
  if (d.firstMultiselect?.eliminationValueCode != null)
    r.push(ChartRejectionReason.FirstMultiselectHasEliminationValues);
  if (d.secondMultiselect?.eliminationValueCode != null)
    r.push(ChartRejectionReason.SecondMultiselectHasEliminationValues);
  return r;
}

function checkHorizontalBar(dp: DataProperties, d: DerivedProperties): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  if (!dp.hasActualData) r.push(ChartRejectionReason.NoActualData);
  if (d.multiselectCount > 1) r.push(ChartRejectionReason.TooManyMultiselectDimensions);
  if (d.multiselectCount < 1) r.push(ChartRejectionReason.TooFewMultiselectDimensions);
  const contentUnits = d.contentDimension?.numberOfUnits ?? 1;
  if (contentUnits !== 1) r.push(ChartRejectionReason.ContentHasMultipleUnits);
  const timeSize = d.timeDimension?.size ?? 0;
  if (timeSize !== 1) r.push(ChartRejectionReason.TimeDimensionSizeInvalid);
  const firstSize = d.firstMultiselect?.size ?? 0;
  if (firstSize < 2 || firstSize > 30) r.push(ChartRejectionReason.FirstMultiselectSizeOutOfRange);
  if (d.secondMultiselect !== null) r.push(ChartRejectionReason.SecondMultiselectNotAllowed);
  if (d.additionalDimensions.length > 1) r.push(ChartRejectionReason.TooManyAdditionalDimensions);
  if (d.firstMultiselect?.type === 'Ordinal') r.push(ChartRejectionReason.OrdinalFirstMultiselectNotAllowed);
  return r;
}

function checkGroupedHorizontalBar(dp: DataProperties, d: DerivedProperties): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  if (!dp.hasActualData) r.push(ChartRejectionReason.NoActualData);
  if (d.multiselectCount > 2) r.push(ChartRejectionReason.TooManyMultiselectDimensions);
  if (d.multiselectCount < 2) r.push(ChartRejectionReason.TooFewMultiselectDimensions);
  const contentUnits = d.contentDimension?.numberOfUnits ?? 1;
  if (contentUnits !== 1) r.push(ChartRejectionReason.ContentHasMultipleUnits);
  const timeSize = d.timeDimension?.size ?? 0;
  if (timeSize > 2) r.push(ChartRejectionReason.TimeDimensionSizeInvalid);
  const firstSize = d.firstMultiselect?.size ?? 0;
  if (firstSize < 2 || firstSize > 20) r.push(ChartRejectionReason.FirstMultiselectSizeOutOfRange);
  const secondSize = d.secondMultiselect?.size ?? 0;
  if (secondSize < 2 || secondSize > 4) r.push(ChartRejectionReason.SecondMultiselectSizeOutOfRange);
  if (d.additionalDimensions.length > 1) r.push(ChartRejectionReason.TooManyAdditionalDimensions);
  const product = d.productOfMultiselects;
  if (product < 1 || product > 40) r.push(ChartRejectionReason.ProductOfMultiselectsOutOfRange);
  if (d.multiselectDimensions.some(dim => dim.type === 'Ordinal'))
    r.push(ChartRejectionReason.OrdinalMultiselectNotAllowed);
  if (d.firstMultiselect?.eliminationValueCode != null)
    r.push(ChartRejectionReason.FirstMultiselectHasEliminationValues);
  if (d.secondMultiselect?.eliminationValueCode != null)
    r.push(ChartRejectionReason.SecondMultiselectHasEliminationValues);
  return r;
}

function checkStackedHorizontalBar(dp: DataProperties, d: DerivedProperties): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  if (!dp.hasActualData) r.push(ChartRejectionReason.NoActualData);
  if (d.multiselectCount > 2) r.push(ChartRejectionReason.TooManyMultiselectDimensions);
  if (d.multiselectCount < 2) r.push(ChartRejectionReason.TooFewMultiselectDimensions);
  const contentUnits = d.contentDimension?.numberOfUnits ?? 1;
  if (contentUnits !== 1) r.push(ChartRejectionReason.ContentHasMultipleUnits);
  const timeSize = d.timeDimension?.size ?? 0;
  if (timeSize > 1) r.push(ChartRejectionReason.TimeDimensionSizeInvalid);
  const firstSize = d.firstMultiselect?.size ?? 0;
  if (firstSize < 2 || firstSize > 30) r.push(ChartRejectionReason.FirstMultiselectSizeOutOfRange);
  const secondSize = d.secondMultiselect?.size ?? 0;
  if (secondSize < 2 || secondSize > 10) r.push(ChartRejectionReason.SecondMultiselectSizeOutOfRange);
  if (d.additionalDimensions.length > 1) r.push(ChartRejectionReason.TooManyAdditionalDimensions);
  if (d.multiselectDimensions.some(dim => dim.type === 'Ordinal'))
    r.push(ChartRejectionReason.OrdinalMultiselectNotAllowed);
  if (dp.hasNegativeData) r.push(ChartRejectionReason.NegativeDataNotAllowed);
  if (d.firstMultiselect?.eliminationValueCode != null)
    r.push(ChartRejectionReason.FirstMultiselectHasEliminationValues);
  if (d.secondMultiselect?.eliminationValueCode != null)
    r.push(ChartRejectionReason.SecondMultiselectHasEliminationValues);
  return r;
}

function checkPie(dp: DataProperties, d: DerivedProperties): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  if (!dp.hasActualData) r.push(ChartRejectionReason.NoActualData);
  if (d.multiselectCount > 1) r.push(ChartRejectionReason.TooManyMultiselectDimensions);
  if (d.multiselectCount < 1) r.push(ChartRejectionReason.TooFewMultiselectDimensions);
  const contentUnits = d.contentDimension?.numberOfUnits ?? 1;
  if (contentUnits !== 1) r.push(ChartRejectionReason.ContentHasMultipleUnits);
  const timeSize = d.timeDimension?.size ?? 0;
  if (timeSize !== 1) r.push(ChartRejectionReason.TimeDimensionSizeInvalid);
  const firstSize = d.firstMultiselect?.size ?? 0;
  if (firstSize < 2 || firstSize > 10) r.push(ChartRejectionReason.FirstMultiselectSizeOutOfRange);
  if (d.secondMultiselect !== null) r.push(ChartRejectionReason.SecondMultiselectNotAllowed);
  if (d.additionalDimensions.length > 1) r.push(ChartRejectionReason.TooManyAdditionalDimensions);
  if (dp.hasNegativeData) r.push(ChartRejectionReason.NegativeDataNotAllowed);
  if (d.firstMultiselect?.eliminationValueCode != null)
    r.push(ChartRejectionReason.MultiselectHasEliminationValues);
  return r;
}

function checkScatterPlot(dp: DataProperties, d: DerivedProperties): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  if (!dp.hasActualData) r.push(ChartRejectionReason.NoActualData);
  if (d.multiselectCount > 2) r.push(ChartRejectionReason.TooManyMultiselectDimensions);
  if (d.multiselectCount < 2) r.push(ChartRejectionReason.TooFewMultiselectDimensions);
  const contentSize = d.contentDimension?.size ?? 0;
  if (contentSize !== 2) r.push(ChartRejectionReason.ContentDimensionSizeInvalid);
  const firstSize = d.firstMultiselect?.size ?? 0;
  if (firstSize < 2 || firstSize > 999) r.push(ChartRejectionReason.FirstMultiselectSizeOutOfRange);
  const secondSize = d.secondMultiselect?.size ?? 0;
  if (secondSize < 2 || secondSize > 999) r.push(ChartRejectionReason.SecondMultiselectSizeOutOfRange);
  if (d.additionalDimensions.length > 1) r.push(ChartRejectionReason.TooManyAdditionalDimensions);
  return r;
}

function checkPyramid(dp: DataProperties, d: DerivedProperties): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  if (!dp.hasActualData) r.push(ChartRejectionReason.NoActualData);
  if (d.multiselectCount > 2) r.push(ChartRejectionReason.TooManyMultiselectDimensions);
  if (d.multiselectCount < 2) r.push(ChartRejectionReason.TooFewMultiselectDimensions);
  const contentUnits = d.contentDimension?.numberOfUnits ?? 1;
  if (contentUnits !== 1) r.push(ChartRejectionReason.ContentHasMultipleUnits);
  const timeSize = d.timeDimension?.size ?? 0;
  if (timeSize !== 1) r.push(ChartRejectionReason.TimeDimensionSizeInvalid);
  const firstSize = d.firstMultiselect?.size ?? 0;
  if (firstSize < 3 || firstSize > 999) r.push(ChartRejectionReason.FirstMultiselectSizeOutOfRange);
  const secondSize = d.secondMultiselect?.size ?? 0;
  if (secondSize !== 2) r.push(ChartRejectionReason.SecondMultiselectSizeOutOfRange);
  if (d.additionalDimensions.length > 1) r.push(ChartRejectionReason.TooManyAdditionalDimensions);
  if (!d.multiselectDimensions.some(dim => dim.type === 'Ordinal'))
    r.push(ChartRejectionReason.OrdinalMultiselectRequired);
  if (dp.hasNegativeData) r.push(ChartRejectionReason.NegativeDataNotAllowed);
  if (d.firstMultiselect?.eliminationValueCode != null)
    r.push(ChartRejectionReason.FirstMultiselectHasEliminationValues);
  if (d.secondMultiselect?.eliminationValueCode != null)
    r.push(ChartRejectionReason.SecondMultiselectHasEliminationValues);
  return r;
}

function checkTable(_dp: DataProperties, d: DerivedProperties): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  // Table does not require actual data — it can display empty/missing datasets
  if (d.multiselectCount > 20) r.push(ChartRejectionReason.TooManyMultiselectDimensions);
  const firstSize = d.firstMultiselect?.size ?? 0;
  if (firstSize > 10000) r.push(ChartRejectionReason.FirstMultiselectSizeOutOfRange);
  const secondSize = d.secondMultiselect?.size ?? 0;
  if (secondSize > 10000) r.push(ChartRejectionReason.SecondMultiselectSizeOutOfRange);
  if (d.additionalDimensions.some(dim => dim.size > 10000))
    r.push(ChartRejectionReason.AdditionalDimensionSizeTooLarge);
  const product = d.productOfMultiselects;
  if (product < 1 || product > 100000) r.push(ChartRejectionReason.ProductOfMultiselectsOutOfRange);
  return r;
}

function checkKeyFigure(_dp: DataProperties, d: DerivedProperties): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  if (d.multiselectCount !== 0) r.push(ChartRejectionReason.AllDimensionsMustHaveSingleValue);
  return r;
}

function checkMap(_dp: DataProperties, d: DerivedProperties, options?: ChartSelectorOptions): ChartRejectionReason[] {
  const r: ChartRejectionReason[] = [];
  if (!d.geoDimension) r.push(ChartRejectionReason.NoGeoDimension);
  if (options?.mapAvailable === false) r.push(ChartRejectionReason.NoMapGeometryAvailable);
  const timeSize = d.timeDimension?.size ?? 0;
  if (timeSize !== 1) r.push(ChartRejectionReason.TimeDimensionSizeInvalid);
  if (d.multiselectCount !== 1 || d.firstMultiselect?.type !== 'Geo') {
    r.push(ChartRejectionReason.MapRequiresExactlyOneGeoMultiselect);
  }
  const firstSize = d.firstMultiselect?.size ?? 0;
  if (firstSize < 2) r.push(ChartRejectionReason.FirstMultiselectSizeOutOfRange);
  return r;
}

// --- Public API ---

const CHART_CHECKS: Array<{
  type: ChartType;
  check: (dp: DataProperties, d: DerivedProperties, options?: ChartSelectorOptions) => ChartRejectionReason[];
}> = [
  { type: 'keyFigure', check: checkKeyFigure },
  { type: 'line', check: checkLineChart },
  { type: 'verticalBar', check: checkVerticalBar },
  { type: 'groupedVerticalBar', check: checkGroupedVerticalBar },
  { type: 'stackedVerticalBar', check: checkStackedVerticalBar },
  { type: 'percentVerticalBar', check: checkStackedVerticalBar },
  { type: 'horizontalBar', check: checkHorizontalBar },
  { type: 'groupedHorizontalBar', check: checkGroupedHorizontalBar },
  { type: 'stackedHorizontalBar', check: checkStackedHorizontalBar },
  { type: 'percentHorizontalBar', check: checkStackedHorizontalBar },
  { type: 'map', check: checkMap },
  { type: 'pie', check: checkPie },
  { type: 'scatterPlot', check: checkScatterPlot },
  { type: 'pyramid', check: checkPyramid },
  { type: 'table', check: checkTable },
];

const DEFAULT_PRIORITY: ChartType[] = [
  'keyFigure',
  'line',
  'verticalBar',
  'groupedVerticalBar',
  'stackedVerticalBar',
  'horizontalBar',
  'groupedHorizontalBar',
  'stackedHorizontalBar',
  'percentVerticalBar',
  'percentHorizontalBar',
  'map',
  'pie',
  'scatterPlot',
  'pyramid',
  'table',
];

export const CHART_TYPE_ORDER: readonly ChartType[] = CHART_CHECKS.map(c => c.type);

export function getApplicableChartTypes(
  dataProps: DataProperties,
  dimensions: DimensionMeta[],
  options?: ChartSelectorOptions,
): ChartTypeResult[] {
  const derived = computeDerivedProperties(dimensions);
  return CHART_CHECKS.map(({ type, check }) => {
    const rejectionReasons = check(dataProps, derived, options);
    return { type, valid: rejectionReasons.length === 0, rejectionReasons };
  });
}

export function selectDefaultChartType(
  dataProps: DataProperties,
  dimensions: DimensionMeta[],
  options?: ChartSelectorOptions,
): ChartType {
  const results = getApplicableChartTypes(dataProps, dimensions, options);
  const validTypes = new Set(results.filter(r => r.valid).map(r => r.type));
  for (const type of DEFAULT_PRIORITY) {
    if (validTypes.has(type)) return type;
  }
  return 'table';
}
