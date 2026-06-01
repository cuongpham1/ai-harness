# Next.js Dev

Start Next.js development server, run build check, and execute tests.

## Usage
/nextjs-dev [port]

## Dev server
1. Install dependencies: `npm install`
2. Start: `npm run dev` (default port 3000)
3. Custom port: `PORT=3001 npm run dev`
4. Open: `http://localhost:3000`

## Build check (required before task done)
1. Production build: `npm run build`
2. Check output — fix all errors and warnings
3. Start production server locally: `npm start`

## Lint and type check
- Lint: `npm run lint`
- Type check: `npx tsc --noEmit`
- Both must pass before marking done

## Tests
- Unit/integration: `npm test`
- E2E with Playwright (if configured): `npx playwright test`

## Router detection
- App Router: `app/` directory exists with `layout.tsx`
- Pages Router: `pages/` directory exists with `_app.tsx`
- Check `next.config.*` for custom config

## Common issues
- `Error: Cannot find module` after new dependency: `npm install`
- Build fails on Server Component with client-only API: add `"use client"` directive
- Hydration mismatch: check for browser-only code running during SSR (wrap in `useEffect`)
