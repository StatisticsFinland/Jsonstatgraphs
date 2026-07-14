/**
 * Identifies why a chart type was rejected for a given dataset.
 *
 * Each member represents a constraint category. The exact bounds
 * (min/max values, counts, etc.) vary per chart type and should be
 * provided as parameters when formatting a localized message.
 */
export enum ChartRejectionReason {
  // --- Data constraints ---
  /** Dataset contains no actual (non-missing) values. */
  NoActualData = 'NoActualData',
  /** Dataset contains negative values, which this chart type cannot represent. */
  NegativeDataNotAllowed = 'NegativeDataNotAllowed',

  // --- Multiselect dimension count ---
  /** The number of multiselect dimensions exceeds the chart type's maximum. */
  TooManyMultiselectDimensions = 'TooManyMultiselectDimensions',
  /** The number of multiselect dimensions is below the chart type's minimum. */
  TooFewMultiselectDimensions = 'TooFewMultiselectDimensions',
  /** All dimensions must have exactly one selected value (key figure). */
  AllDimensionsMustHaveSingleValue = 'AllDimensionsMustHaveSingleValue',

  // --- Content dimension ---
  /** The content dimension has more than one unit of measure. */
  ContentHasMultipleUnits = 'ContentHasMultipleUnits',
  /** The content dimension does not have the required number of values (e.g. exactly 2 for scatter). */
  ContentDimensionSizeInvalid = 'ContentDimensionSizeInvalid',

  // --- Time dimension ---
  /** An irregular time series is not supported by this chart type. */
  IrregularTimeNotAllowed = 'IrregularTimeNotAllowed',
  /** The irregular time dimension has too many values for this chart type. */
  IrregularTimeSizeTooLarge = 'IrregularTimeSizeTooLarge',
  /** The time dimension has the wrong number of values for this chart type. */
  TimeDimensionSizeInvalid = 'TimeDimensionSizeInvalid',

  // --- Multiselect dimension sizes ---
  /** The first (largest) multiselect dimension has fewer or more values than allowed. */
  FirstMultiselectSizeOutOfRange = 'FirstMultiselectSizeOutOfRange',
  /** The second multiselect dimension has fewer or more values than allowed. */
  SecondMultiselectSizeOutOfRange = 'SecondMultiselectSizeOutOfRange',
  /** A second multiselect dimension is present but this chart type only supports one. */
  SecondMultiselectNotAllowed = 'SecondMultiselectNotAllowed',

  // --- Additional dimensions ---
  /** More additional (third+) multiselect dimensions are present than the chart type allows. */
  TooManyAdditionalDimensions = 'TooManyAdditionalDimensions',
  /** An additional dimension has more values than the chart type allows (table). */
  AdditionalDimensionSizeTooLarge = 'AdditionalDimensionSizeTooLarge',

  // --- Product of multiselects ---
  /** The product of all non-axis multiselect sizes exceeds the chart type's limit. */
  ProductOfNonAxisMultiselectsTooLarge = 'ProductOfNonAxisMultiselectsTooLarge',
  /** The product of all multiselect sizes is outside the chart type's allowed range. */
  ProductOfMultiselectsOutOfRange = 'ProductOfMultiselectsOutOfRange',

  // --- Axis / ordinal constraints ---
  /** No time or ordinal dimension is available to use as the chart axis. */
  NoTimeOrOrdinalAxisDimension = 'NoTimeOrOrdinalAxisDimension',
  /** The first multiselect dimension is ordinal, which is not allowed for this chart type. */
  OrdinalFirstMultiselectNotAllowed = 'OrdinalFirstMultiselectNotAllowed',
  /** One or more multiselect dimensions are ordinal, which is not allowed for this chart type. */
  OrdinalMultiselectNotAllowed = 'OrdinalMultiselectNotAllowed',
  /** At least one ordinal multiselect dimension is required (pyramid). */
  OrdinalMultiselectRequired = 'OrdinalMultiselectRequired',

  // --- Elimination values ---
  /** The (only) multiselect dimension has an elimination value selected. */
  MultiselectHasEliminationValues = 'MultiselectHasEliminationValues',
  /** The first multiselect dimension has an elimination value selected. */
  FirstMultiselectHasEliminationValues = 'FirstMultiselectHasEliminationValues',
  /** The second multiselect dimension has an elimination value selected. */
  SecondMultiselectHasEliminationValues = 'SecondMultiselectHasEliminationValues',

  // --- Map-specific ---
  /** The dataset has no geographic dimension. */
  NoGeoDimension = 'NoGeoDimension',
  /** No map geometry (GeoJSON) is available for the geographic dimension. */
  NoMapGeometryAvailable = 'NoMapGeometryAvailable',
  /** The map requires exactly one multiselect dimension and it must be geographic. */
  MapRequiresExactlyOneGeoMultiselect = 'MapRequiresExactlyOneGeoMultiselect',

  // --- Dataset-level errors ---
  /** The JSON-stat dataset failed structural validation before chart-type checks could run. */
  InvalidDataset = 'InvalidDataset',
}
