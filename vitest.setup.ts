// Global test setup — runs once per test file before any test.
//
// Imports jest-dom matchers (.toBeInTheDocument(), .toHaveTextContent(),
// etc.) into Vitest's expect so React Testing Library assertions read
// the same as the broader ecosystem. Without this, RTL tests fail with
// "expect(...).toBeInTheDocument is not a function."

import '@testing-library/jest-dom/vitest';
