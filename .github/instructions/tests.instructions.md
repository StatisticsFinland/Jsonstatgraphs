---
applyTo: "tests/**/*.ts"
---

# Test guidance

- Use the existing Jest ESM setup, `tests/setup.ts`, and nearby test patterns. Run `npm run test:ci` for the full CI-mode suite; run `npm run lint` for changed tests.
- Jest uses jsdom, not a browser layout engine. `clientWidth` and `clientHeight` are zero unless a test defines them; set deterministic container dimensions as nearby chart tests do. Do not treat jsdom SVG geometry as visual evidence.
- Text measurement is deterministic only when an explicit measurement function or the existing text-measurement path is used. Assert text/layout algorithms with controlled measurements, and use the `visual-check` skill for real-browser layout checks.
- Prefer observable outputs and public contracts over implementation details. For each behavior test, include an assertion that would fail for a plausible incorrect implementation. Cover relevant empty, null/missing, boundary, locale, immutability, accessibility, and async cancellation cases without adding unrelated cases.
- Reuse valid JSON-stat fixtures from `stories/fixtures/` or a small local fixture that states the required dimensions and values. Keep fixtures and expected results comprehensible; do not fetch test data from a live service.
- Clean up DOM nodes, spies, fake timers, and global state in the test or its hooks. Restore fake timers before returning. Follow repository ESM conventions for `jest` imports and mocks.
- Tests establish only their asserted behavior. In particular, DOM-tree assertions do not prove screen-reader behavior; the manual NVDA follow-up in ADR-040 remains necessary for relevant accessibility changes.
