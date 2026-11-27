---
name: test-coverage-analysis
description: "Measure and analyze Jsonstatgraphs Jest coverage, including line and branch coverage, uncovered production code, and test gaps in changed behavior."
user-invocable: true
---

# Jest Coverage Analysis

Use Jest's built-in coverage instrumentation to measure production TypeScript and investigate meaningful test gaps. Do not edit production code or tests unless asked. Coverage measures execution, not assertion quality.

## Rules

- Use the existing Jest setup and `npm run test:ci`; do not install coverage tools or add dependencies.
- If `package.json` or `package-lock.json` differs from the selected target, align dependencies with `npm ci` against those exact manifests before measuring; reuse the review's install when this skill is invoked from a review. If the restore is blocked or the target manifests cannot be established, mark coverage unverified. Otherwise, use existing installed dependencies unless a required package is missing.
- There is no configured coverage threshold in this repository's CI. Do not invent a project-wide pass percentage or describe a measurement as a CI gate.
- Run the full suite for full-project coverage. A filtered test run is only a focused measurement and must be labeled as such.
- Fresh reports require successful execution, at least one test, and a report that includes the intended `src/**/*.ts` scope. Failed/incomplete runs, missing reports, or unresolved source paths make the affected result **unverified**.
- Coverage runs measure the current working tree. For a committed or staged diff, establish that relevant source, tests, and configuration match the target snapshot; otherwise report changed-line results as unverified. Never claim working-tree coverage proves index or committed coverage.
- Do not inspect secret-bearing files. Keep generated reports in ignored `agent_tmp/` or `coverage/` and clean up only the exact task-owned output directory when done.

## 1. Define the measurement

State the measurement target: full working tree, focused files/tests, committed changes, or staged changes. Record the base ref, working-tree/index state, test selection, and any limitations.

For a PR into `dev`, use `origin/dev`, otherwise local `dev`, without fetching; report if neither is available. For staged changes, compare against `HEAD` using the cached diff. For committed changes, use the requested base and merge base. Report stale refs and do not silently substitute another target.

## 2. Collect fresh coverage

Run from the repository root. The command collects all production TypeScript, including source files not imported by tests:

```bash
mkdir -p agent_tmp
coverage_dir=$(mktemp -d "$PWD/agent_tmp/jest-coverage.XXXXXX")
npm run test:ci -- --coverage --collectCoverageFrom='src/**/*.ts' --coverageReporters=text --coverageReporters=lcov --coverageDirectory="$coverage_dir"
```

Record the command, working directory, exit code, Jest suite/test counts, and any warnings. Follow the dependency-alignment rule above and do not rerun tests just to produce a second report if a fresh, matching run is already available.

Require a successful run and nonempty LCOV report (`$coverage_dir/lcov.info`) for line-level analysis. The text summary reports statements, branches, functions, and lines. Report measured values and scope; do not infer missing coverage from files omitted from the report. `--collectCoverageFrom` should include unimported production files; confirm the report contains the expected source paths.

## 3. Analyze coverage and changed lines

- Report aggregate statement, branch, function, and line percentages, plus notable per-file results relevant to the task. Avoid treating type-only declarations or trivial accessors as meaningful coverage.
- For changed-line analysis, compare executable added/modified lines from the selected diff with the matching `SF` source file and `DA` line hit records in `lcov.info`. Report covered executable lines, uncovered executable lines, and changed lines absent from instrumentation separately. Do not count comments, blank lines, or type-only declarations as uncovered executable code. If paths or line mappings cannot be reconciled, mark changed-line analysis unverified rather than guessing.
- Branch percentages indicate execution of outcomes, not that assertions verify those outcomes. Inspect relevant `BRDA` records where useful, then read the production path and tests.
- For every significant gap, describe the scenario, expected observable assertion, and plausible incorrect behavior the test should reject. Prioritize changed behavior, error paths, boundary inputs, data immutability, async cancellation, accessibility, and other relevant contracts. Do not recommend tests merely to raise a percentage.
- Do not present overall coverage as proof of correctness, accessibility, or security. Do not claim a threshold passed unless the repository explicitly configures one.

## Output and cleanup

Report the measurement target, commands, working directory, exit codes, test counts, aggregate and relevant per-file metrics, changed-line method/results when applicable, test gaps, and limitations. Clearly distinguish measured gaps from suspected gaps and intentional exclusions.

Unless the user asks to keep the reports, remove only the exact coverage directory created for this run after summarizing, including after failures. Never delete the whole `agent_tmp/` directory.
