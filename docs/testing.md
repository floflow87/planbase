# Testing Guide

Planbase uses [Vitest](https://vitest.dev/) for unit and integration testing.

## Running Tests

```bash
# Run all tests
npx vitest run

# Run tests in watch mode
npx vitest

# Run with verbose output
npx vitest run --reporter=verbose

# Run with coverage
npx vitest run --coverage
```

## Test Structure

Tests are co-located with their source files using the `.test.ts` suffix:

```
server/
  services/
    configService.ts
    configService.test.ts  <- Tests here
```

## Writing Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MyService', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

## Current Test Coverage

- **ConfigService**: Merge order, scope overrides, cache invalidation
- **API Authorization**: GET auth required, PUT owner-only

## Configuration

See `vitest.config.ts` for test configuration including path aliases.
