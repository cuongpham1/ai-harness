# React Stack

Reference for AI agents working on this React project.

## Overview

React with TypeScript. Component-based SPA. State management via React Query + Context or Redux Toolkit depending on project config. Testing with React Testing Library + Jest.

## Project Structure

```
src/
  components/       # Reusable UI components
    Button/
      Button.tsx
      Button.test.tsx
      index.ts
  pages/            # Route-level components
  hooks/            # Custom hooks
  services/         # API calls (axios/fetch wrappers)
  store/            # Redux slices (if using Redux Toolkit)
  context/          # React context providers
  types/            # Shared TypeScript types
  utils/            # Pure utility functions
  App.tsx
  main.tsx          # (Vite) or index.tsx (CRA)
public/
package.json
tsconfig.json
```

## Component Conventions

- Functional components only — no class components
- One component per file
- Named exports preferred over default exports (enables refactor-safe imports)
- Props interface defined above component: `interface ButtonProps { ... }`
- Co-locate test file: `Button.test.tsx` next to `Button.tsx`

```tsx
interface CardProps {
  title: string;
  description?: string;
  onClick: () => void;
}

export function Card({ title, description, onClick }: CardProps) {
  return (
    <div role="article" onClick={onClick}>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}
```

## State Management

**Local state**: `useState`, `useReducer`
**Server state**: React Query (`useQuery`, `useMutation`)
**Global UI state**: Context API or Redux Toolkit slice

Redux Toolkit slice pattern:
```ts
const featureSlice = createSlice({
  name: 'feature',
  initialState: { items: [], loading: false, error: null } as FeatureState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => { state.loading = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchItems.pending, (state) => { state.loading = true; })
      .addCase(fetchItems.fulfilled, (state, action) => { state.items = action.payload; state.loading = false; })
      .addCase(fetchItems.rejected, (state, action) => { state.error = action.error.message ?? 'Unknown'; state.loading = false; });
  },
});
```

## Routing

React Router v6 pattern:
```tsx
// App.tsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/items/:id" element={<ItemDetailPage />} />
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

- Use `useNavigate` hook for programmatic navigation
- Use `useParams` for URL params
- Use `<Link>` not `<a>` for internal navigation

## API Services

```ts
// services/itemService.ts
import axios from 'axios';

const api = axios.create({ baseURL: process.env.REACT_APP_API_URL });

export const itemService = {
  getAll: () => api.get<Item[]>('/items').then(r => r.data),
  getById: (id: string) => api.get<Item>(`/items/${id}`).then(r => r.data),
};
```

## Testing

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from './Card';

describe('Card', () => {
  it('renders title and description', () => {
    render(<Card title="Test" description="Desc" onClick={jest.fn()} />);
    expect(screen.getByRole('heading', { name: 'Test' })).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = jest.fn();
    render(<Card title="Test" onClick={handleClick} />);
    await userEvent.click(screen.getByRole('article'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

Query priority (RTL): `getByRole` > `getByLabelText` > `getByText` > `getByTestId`

## Key Commands

```bash
npm start                              # dev server
npm run build                          # production build
npm test -- --watchAll=false           # all tests
npm test -- --coverage --watchAll=false # with coverage
npm run lint                           # ESLint
npx tsc --noEmit                       # type check only
```

## Common Pitfalls

- `useEffect` with missing dependency array → stale closure bug
- Mutating state directly in Redux → use Immer (RTK does this automatically)
- Using `findByText` without `await` → test passes but is flaky
- Large component files → split into smaller components and custom hooks
- `any` type → add proper TypeScript type, ESLint rule `@typescript-eslint/no-explicit-any` should be error
