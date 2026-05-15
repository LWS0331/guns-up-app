// Vitest config — first test infrastructure for this repo.
//
// Up to PR #170 there were ZERO tests. Three silent-drop bugs in
// two weeks (operator field-enumeration drift PRs #153/#155/#163)
// all of which would have been caught by a single GET-projection
// assertion. This scaffold puts the runner in place; per-route /
// per-feature tests get layered in afterward.
//
// Defaults:
//   - environment: 'jsdom' — most tests will eventually need DOM
//     (React Testing Library). Pure-logic tests run faster under
//     'node' if needed via per-file `// @vitest-environment node`.
//   - globals: true — describe/it/expect available without imports
//     (lower-friction migration target; matches Jest convention).
//   - alias resolution mirrors tsconfig.json paths so `@/lib/...`
//     imports work identically to runtime.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    // Source files under src/ get matched; test files live alongside
    // their target as `*.test.ts` / `*.test.tsx` OR under
    // `src/**/__tests__/*.{ts,tsx}`. Both conventions are common —
    // we accept either so contributors aren't forced into one.
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}',
    ],
    // node_modules is excluded by default but explicit is better.
    exclude: ['node_modules', '.next', 'dist', '.git'],
    // Reporters: 'default' for local readability, GitHub Actions
    // gets JUnit XML so failures show up annotated on PR diffs.
    reporters: process.env.CI
      ? ['default', ['junit', { outputFile: './test-results.junit.xml' }]]
      : ['default'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
