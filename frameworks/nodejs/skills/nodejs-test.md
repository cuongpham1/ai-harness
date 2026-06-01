# Node.js Test

Run Node.js tests with type checking and lint.

## Usage
/nodejs-test [filter]

## Steps
1. Install dependencies: `npm install`
2. Type check: `npx tsc --noEmit`
3. Run tests: `npm test`
4. Run specific file: `npx jest src/__tests__/service.test.ts`
5. Run by name filter: `npx jest -t "should return 200"`
6. Coverage: `npm run test:coverage` or `npx jest --coverage`

## Lint (required before done)
- Lint: `npm run lint`
- Auto-fix: `npm run lint -- --fix`
- Format: `npm run format` (if configured)

## Test structure (Jest)
- `describe('ServiceName', () => { ... })`
- `it('should do X when Y', async () => { ... })`
- Mocks: `jest.mock('../db')` at module top
- Before/after: `beforeEach(() => { ... })`, `afterAll(() => { ... })`

## Test structure (Vitest, if used)
- Same API as Jest — check `vitest.config.ts` for setup
- Run: `npx vitest run`

## Reading output
- Pass: `Tests: X passed, X total`
- Fail: shows test description, expected vs received
- Type errors from `tsc --noEmit` must all be resolved

## Common pitfalls
- Forgot to `await` async call — test passes but doesn't test the real path
- Module resolution differs between Jest and tsc — keep `tsconfig.json` and `jest.config.ts` in sync
