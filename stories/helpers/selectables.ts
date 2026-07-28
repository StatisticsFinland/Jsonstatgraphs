import type { SelectableConfig, SelectableSelections } from '../../src/types';

interface SelectableStoryArgs {
  selectableSelections?: SelectableSelections;
  extensionSelectableSelections?: SelectableSelections;
  extensionDefaultSelectableSelections?: SelectableSelections;
  extensionMultiSelectableDimensionCode?: string;
}

export function getSelectableStoryInputs(args: SelectableStoryArgs): {
  selectableSelections?: SelectableSelections;
  selectableConfig?: SelectableConfig;
} {
  const selectableConfig: SelectableConfig = {
    ...(args.extensionSelectableSelections !== undefined && {
      selectableSelections: args.extensionSelectableSelections,
    }),
    ...(args.extensionDefaultSelectableSelections !== undefined && {
      defaultSelectableSelections: args.extensionDefaultSelectableSelections,
    }),
    ...(args.extensionMultiSelectableDimensionCode !== undefined && {
      multiSelectableDimensionCode: args.extensionMultiSelectableDimensionCode,
    }),
  };

  return {
    ...(args.selectableSelections !== undefined && { selectableSelections: args.selectableSelections }),
    ...(Object.keys(selectableConfig).length > 0 && { selectableConfig }),
  };
}