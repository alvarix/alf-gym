# Tests

Pre-build placeholder. Real tests land alongside app code.

## Planned structure

```
tests/
  unit/          Vitest. Pure functions.
    notation.test.ts        token parser
    prefill.test.ts         set entry prefill calculator
    sync.test.ts            syncRev resolver
  integration/   Vitest + happy-dom. Component behavior.
    session-list.test.ts    list view interactions
    template-builder.test.ts
  e2e/           Playwright. Real browser, including PWA install.
    install.spec.ts         install + offline cold start
    capture.spec.ts         start session, log sets, end session
    importer.spec.ts        stepped import flow (P3)
  visual/        Playwright screenshots of every mockup view.
    snapshots/              per-view PNG baselines
```

## Coverage expectations

- Notation parser: 100% branch coverage. Round-trips with the export formatter.
- Prefill calculator: every combination of (last cycle exists, prescription override, increment).
- Sync engine: simulated network drops, conflict scenarios, snapshot restore.
- E2E: must pass offline. Service worker live in test runs.

## Visual regression

Mockup HTML pages double as visual fixtures. Each `mockup-v*/views/*.html` page gets a Playwright screenshot. Re-run on every PR. Diffs require explicit acceptance.

## Why this is empty for now

App code does not exist yet. This file documents intent so the discipline is set up before the first line of code.
