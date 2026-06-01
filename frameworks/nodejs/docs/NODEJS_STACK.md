# Node.js Stack

Reference for AI agents working on this Node.js project.

## Overview

Node.js backend with TypeScript. Check `package.json` for framework (Express, Fastify, Koa) and test runner (Jest, Vitest). ES modules vs CommonJS determined by `"type"` in `package.json`.

## Project Structure

```
src/
  controllers/      # HTTP handlers — thin, delegate to services
  services/         # Business logic
  repositories/     # Data access layer
  middleware/        # Express/Fastify middleware
  routes/           # Route definitions
  models/           # TypeScript interfaces + Zod/Joi schemas
  utils/            # Pure utility functions
  config/           # Environment config loading
  index.ts          # Entry point
src/__tests__/      # or co-located *.test.ts
dist/               # Compiled output (gitignored)
package.json
tsconfig.json
```

## Architecture

Controllers → Services → Repositories → DB

- Controllers: parse request, call service, return response. No business logic.
- Services: business logic. No HTTP concepts.
- Repositories: DB queries. Return domain objects, not raw DB rows.

## TypeScript Config

Key `tsconfig.json` settings to check:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "moduleResolution": "bundler"
  }
}
```

Run `npx tsc --noEmit` to type-check without building.

## Express Patterns

```ts
// routes/items.ts
import { Router } from 'express';
import { ItemController } from '../controllers/ItemController';

export function createItemRouter(controller: ItemController): Router {
  const router = Router();
  router.get('/', (req, res, next) => controller.list(req, res).catch(next));
  router.post('/', (req, res, next) => controller.create(req, res).catch(next));
  router.get('/:id', (req, res, next) => controller.getById(req, res).catch(next));
  return router;
}
```

Always wrap async handlers with `.catch(next)` or use `express-async-errors`.

## Error Handling

```ts
// middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code: string) {
    super(message);
  }
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
```

## Testing (Jest)

```ts
// src/__tests__/itemService.test.ts
import { ItemService } from '../services/ItemService';
import { ItemRepository } from '../repositories/ItemRepository';

jest.mock('../repositories/ItemRepository');

describe('ItemService', () => {
  let service: ItemService;
  let mockRepo: jest.Mocked<ItemRepository>;

  beforeEach(() => {
    mockRepo = new ItemRepository() as jest.Mocked<ItemRepository>;
    service = new ItemService(mockRepo);
  });

  it('returns items from repository', async () => {
    mockRepo.findAll.mockResolvedValue([{ id: '1', name: 'Test' }]);
    const items = await service.listItems();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Test');
  });

  it('throws NotFoundError when item does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.getItem('missing')).rejects.toThrow('Not found');
  });
});
```

## Data Layer

```ts
// repositories/ItemRepository.ts
export class ItemRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<Item[]> {
    const rows = await this.db.query('SELECT * FROM items WHERE deleted_at IS NULL');
    return rows.map(toItem);  // map raw row to domain type
  }

  async findById(id: string): Promise<Item | null> {
    const row = await this.db.queryOne('SELECT * FROM items WHERE id = ?', [id]);
    return row ? toItem(row) : null;
  }
}
```

## Key Commands

```bash
npm run dev              # ts-node or tsx watch mode
npm run build            # tsc compile to dist/
npm start                # run dist/index.js
bash scripts/rtk-node.sh test    # filtered output (~70% fewer tokens to agent)
bash scripts/rtk-node.sh lint
npm test                 # fallback if rtk-node.sh missing
npm run lint
npx tsc --noEmit         # type check
rtk git status           # when RTK CLI installed — see docs/TOKEN_EFFICIENCY.md
```

## Common Pitfalls

- Unhandled promise rejection → process crash in production; always `.catch()` or `try/catch`
- `req.body` typed as `any` → validate with Zod/Joi and cast to typed interface
- Missing `next(err)` in async Express handler → request hangs on error
- `process.env.VAR` returns `string | undefined` → validate at startup with a config schema
- `Date` objects serialized as ISO strings in JSON → clients must parse; document in API types
