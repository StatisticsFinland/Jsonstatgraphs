---
applyTo: "src/charts/**/*.ts"
---

# Chart renderer guidance

- Before changing a renderer, check its relevant steps in `architecture.md`'s data flow and the related entries in the `decisions.md` index. Preserve the pipeline: validation/rebuild and chart-specific data transforms happen before rendering.
- Renderers consume prepared chart data; do not duplicate JSON-stat validation, selectable rebuilding, or chart selection in a renderer. Use the existing shared scaffold and helpers where appropriate. Map, table, and key-figure renderers have intentionally specialized structures; do not force them into a Cartesian chart scaffold.
- Keep input datasets and prepared data immutable. Put shared transformations or behavior in their existing `src/data/`, `src/layout/`, `src/theme/`, `src/locale/`, `src/a11y/`, or `src/interaction/` modules rather than duplicating them in chart files.
- Use resolved theme tokens and the existing locale-aware number/text measurement paths. Keep visible numeric labels and their measured widths consistent with the configured locale.
- Preserve the accessibility contract in `architecture.md` step 12 and ADR-038–040: visual charts have one localized named region and SVG application; interactive marks retain list/listitem semantics and roving keyboard focus; decorative SVG content is hidden from assistive technology; table and key-figure views retain native document semantics. Bind shared interactions through the existing pipeline rather than creating a parallel keyboard implementation.
- When changing observable rendering, keyboard, ARIA, or data behavior, update or add focused tests under `tests/` and an affected Storybook story under `stories/`. A passing jsdom test does not establish visual layout correctness; use the `visual-check` skill when layout is affected.
