# Module Template

Copy `packages/modules/_template` to `packages/modules/<your-module>` and:

1. Update `package.json` name to `@aslico/module-<name>`
2. Implement `ToolkitModule` in `src/index.ts`
3. Register the module in `apps/web/lib/module-registry.ts`
4. Add UI route at `apps/web/app/(shell)/[moduleId]/page.tsx` (auto via registry)
5. Add optional Drizzle tables in `packages/storage/src/schema/`
6. Register agent tools in `packages/ai` when ready

## Module interface

```ts
import type { ToolkitModule } from '@aslico/core/module-sdk'

export const myModule: ToolkitModule = {
  id: 'my-module',
  name: 'My Module',
  description: '...',
  icon: '✨',
  version: '0.0.1',
  category: 'learning',
}
```

## Events

Subscribe via `@aslico/core/events`:

```ts
import { eventBus } from '@aslico/core/events'

eventBus.on('document.updated', async (payload) => {
  // react to updates
})
```
