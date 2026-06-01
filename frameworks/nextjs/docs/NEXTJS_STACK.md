# Next.js Stack

Reference for AI agents working on this Next.js project.

## Overview

Next.js with TypeScript. Check `app/` vs `pages/` to determine which router is active. Both may coexist during migration.

## Project Structure

```
app/                    # App Router (Next.js 13+)
  layout.tsx            # Root layout
  page.tsx              # Home route
  (auth)/               # Route group (no URL segment)
    login/
      page.tsx
  api/
    items/
      route.ts          # API route handler
pages/                  # Pages Router (legacy or mixed)
  _app.tsx
  _document.tsx
  index.tsx
  api/
    items.ts
components/             # Shared components
  ui/                   # Generic UI primitives
  features/             # Feature-specific components
lib/                    # Utilities, DB clients, auth helpers
hooks/                  # Custom React hooks
types/                  # Shared TypeScript types
public/                 # Static assets
next.config.*
tsconfig.json
```

## App Router Rules

- Default: **Server Components** — no useState, no useEffect, no browser APIs
- Client Components: add `"use client"` at top of file
- Layouts: `layout.tsx` wraps children, persists across navigation
- Metadata: export `metadata` object or `generateMetadata` function from page files
- Loading states: `loading.tsx` sibling to `page.tsx`
- Error boundaries: `error.tsx` (must be `"use client"`)

```tsx
// Server Component (default)
export default async function ItemsPage() {
  const items = await db.items.findMany(); // direct DB access OK here
  return <ItemList items={items} />;
}

// Client Component
"use client";
export function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState('');
  // ...
}
```

## Data Fetching

**App Router — Server Components**:
```tsx
// Direct async/await — no useEffect needed
const data = await fetch('https://api.example.com/items', { next: { revalidate: 60 } });
```

**App Router — Client Components**:
```tsx
// Use React Query or SWR
const { data, isLoading } = useQuery({ queryKey: ['items'], queryFn: fetchItems });
```

**Pages Router**:
```tsx
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const data = await fetchItems();
  return { props: { items: data } };
};

export const getStaticProps: GetStaticProps = async () => {
  const data = await fetchItems();
  return { props: { items: data }, revalidate: 60 };
};
```

## API Routes

App Router (`app/api/items/route.ts`):
```ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const items = await db.items.findMany();
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const item = await db.items.create({ data: body });
  return NextResponse.json(item, { status: 201 });
}
```

## Environment Variables

- `.env.local` — local dev (gitignored)
- `.env.production` — production values
- Client-accessible: prefix `NEXT_PUBLIC_`
- Server-only: no prefix (never exposed to browser)

## Testing

```tsx
// Component test
import { render, screen } from '@testing-library/react';
import ItemsPage from '@/app/items/page';

jest.mock('@/lib/db', () => ({ items: { findMany: jest.fn().mockResolvedValue([]) } }));

it('renders empty state', async () => {
  render(await ItemsPage());
  expect(screen.getByText('No items')).toBeInTheDocument();
});
```

## Key Commands

```bash
npm run dev            # dev server (port 3000)
npm run build          # production build — MUST pass before done
npm start              # serve production build
bash scripts/rtk-node.sh lint
bash scripts/rtk-node.sh test
npm run lint           # fallback
npx tsc --noEmit       # type check
npm test               # fallback
```

## Common Pitfalls

- Browser API (`localStorage`, `window`) in Server Component → runtime error, add `"use client"`
- Missing `await` on async Server Component → renders `[object Promise]`
- Hydration mismatch → Server renders X, client renders Y (e.g. random IDs, dates) → fix with `useEffect` or `suppressHydrationWarning` on stable elements only
- `next/image` missing `alt` → ESLint error
- `next/link` `href` string vs object — string preferred for simple paths
- Build passes locally but fails in CI → environment variables not set in CI
