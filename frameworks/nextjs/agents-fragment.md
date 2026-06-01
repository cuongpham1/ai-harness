<!-- FRAMEWORK:BEGIN id=nextjs -->
## Next.js Stack

This project uses Next.js with TypeScript. Additional rules:

| Doc | When to read |
|-----|-------------|
| docs/NEXTJS_STACK.md | Before any Next.js implementation |

### Test commands
- Unit: `npm test`
- Build check: `npm run build`
- E2E: use playwright-mcp against `npm run dev`

### Framework rules
- Always run `npm run lint` and `npm run build` before marking task done
- Distinguish App Router (`app/`) from Pages Router (`pages/`) — check which is active
- Server Components are default in App Router — mark client components with `"use client"`
- API routes live in `app/api/` (App Router) or `pages/api/` (Pages Router)
- Use `next/image` and `next/link` — never raw `<img>` or `<a>` for internal navigation

### Skills available
- `/nextjs-dev` — start dev server, check build, run tests
<!-- FRAMEWORK:END -->
