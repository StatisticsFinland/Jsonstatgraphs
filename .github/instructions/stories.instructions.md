---
applyTo: "stories/**/*.stories.ts"
---

# Storybook guidance

- Follow the existing story organization: one file per chart type under `stories/charts/`, with a `Charts/<Type>` title. Put accessibility demonstrations under `stories/accessibility/`; keep shared documentation in the existing MDX files.
- Use representative local JSON-stat fixtures from `stories/fixtures/`. Use `renderChart`, `buildConfig`, `sharedArgs`, `sliceDataset`, and selectable helpers from `stories/helpers/` rather than duplicating setup. Do not fetch live data or add a new dependency for a story.
- Include a clear default story and add focused variants for the changed behavior and relevant data shapes (for example, many categories, negative values, nulls, or selectable dimensions). Keep story data and configuration small enough to understand.
- Stories are rendered asynchronously through the existing `renderChart` helper. Return its wrapper and let the Storybook preview cleanup destroy stored chart instances; do not create unmanaged chart instances or mutate shared fixture objects.
- Keep interactive controls aligned with actual `ChartConfig` behavior and hide controls that do not apply to a chart type. Verify changed or layout-sensitive stories with the `visual-check` skill.
- Stories demonstrate appearance and interaction, but are not proof of keyboard, ARIA, or screen-reader correctness. Use the `a11y-check` skill for accessibility changes and retain focused tests.
