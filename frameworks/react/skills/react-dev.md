# React Dev

Start React development server and open the app in browser.

## Usage
/react-dev [port]

## Steps
1. Install dependencies if needed: `npm install`
2. Start dev server: `npm start` (default port 3000)
3. Custom port: `PORT=3001 npm start`
4. Open browser: `http://localhost:3000`

## Build check
- Production build: `npm run build`
- Analyze bundle: `npx source-map-explorer build/static/js/*.js` (if source-map-explorer installed)

## Lint
- Run lint: `npm run lint`
- Auto-fix: `npm run lint -- --fix`
- Type check: `npx tsc --noEmit`

## Common issues
- Port in use: `lsof -ti:3000 | xargs kill -9` then retry
- Module not found after install: `rm -rf node_modules && npm install`
- TypeScript errors block build — fix all before marking done
