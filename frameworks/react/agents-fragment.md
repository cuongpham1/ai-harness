<!-- FRAMEWORK:BEGIN id=react -->
## React Stack

This project uses React with TypeScript. Additional rules:

| Doc | When to read |
|-----|-------------|
| docs/REACT_STACK.md | Before any React/TypeScript implementation |

### Test commands
- Unit: `npm test -- --watchAll=false`
- Coverage: `npm test -- --coverage --watchAll=false`
- E2E: use playwright-mcp in browser

### Framework rules
- Always run `npm run lint` before marking task done
- Component tests required for all UI components
- Use React Testing Library — no Enzyme
- Prefer functional components + hooks, no class components
- Co-locate tests: `Component.test.tsx` next to `Component.tsx`

### Skills available
- `/react-dev` — start dev server and open browser
- `/react-test` — run tests with filtered output
<!-- FRAMEWORK:END -->
