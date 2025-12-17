# Code Quality

## Linting

Planbase uses ESLint with TypeScript and React plugins.

```bash
# Run linter
npx eslint client/src server shared

# Fix auto-fixable issues
npx eslint client/src server shared --fix
```

## Formatting

Prettier is configured for consistent code formatting.

```bash
# Check formatting
npx prettier --check .

# Fix formatting
npx prettier --write .
```

## Hardcode Detection

The `check-hardcoded-options.ts` script detects hardcoded configuration values that should use the Config Registry:

```bash
npx tsx scripts/check-hardcoded-options.ts
```

### What it detects:
- Hardcoded arrays for stages/statuses/priorities
- SelectItem components with hardcoded values
- Zod enums with hardcoded values
- Switch statements on status/stage/priority

### Suppressing false positives:

Add `// hardcode-ok` comment on the line before the violation:

```typescript
// hardcode-ok
const paginationOptions = [10, 20, 50];
```

## Pre-commit Checklist

1. Run tests: `npx vitest run`
2. Run linter: `npx eslint . --fix`
3. Format code: `npx prettier --write .`
4. Check hardcodes: `npx tsx scripts/check-hardcoded-options.ts`
