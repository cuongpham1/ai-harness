<!-- FRAMEWORK:BEGIN id=nodejs -->
## Node.js Stack

This project uses Node.js with TypeScript. Additional rules:

| Doc | When to read |
|-----|-------------|
| docs/NODEJS_STACK.md | Before any Node.js/TypeScript implementation |

### Test commands
- Unit: `npm test`
- Coverage: `npm run test:coverage`
- Type check: `npx tsc --noEmit`

### Framework rules
- Always run `npm run lint` and `npx tsc --noEmit` before marking task done
- Use ES modules (`"type": "module"` in package.json) unless project uses CJS
- Tests in `src/__tests__/` or co-located `*.test.ts` files
- Never `require()` in TypeScript files — use `import`
- Handle async errors — unhandled promise rejections crash the process

### Skills available
- `/nodejs-test` — run tests with type-check and lint
<!-- FRAMEWORK:END -->
