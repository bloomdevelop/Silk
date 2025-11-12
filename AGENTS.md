# Silk Bot - Agent Guidelines

## Build & Development Commands

```bash
pnpm build          # Build TypeScript to dist/
pnpm dev            # Clean build + run locally
pnpm start          # Run with nodemon (production)
```

## Architecture & Structure

**Silk** is a multi-purpose Stoat bot built with TypeScript and [stoat.js](https://www.npmjs.com/package/stoat.js).

- **Core Components**:
  - `Bot.ts` - Main singleton managing lifecycle
  - `services/` - DatabaseService, AutoModService, ConfigService, AutumnService
  - `managers/` - CommandManager, EventManager, ProcessManager, CooldownManager, RateLimitManager, VersionManager
  - `commands/` - Organized by category (economy, fun, info, moderation)
  - `utils/` - Logger, TimeUtils, BoxFormatter, TaskQueue, RateLimitHandler

- **Database**: Turso (SQLite via @libsql/client)
- **Key Dependencies**: stoat.js (Stoat library), zod (validation), sharp (image processing), canvas

## Code Style & Conventions

- **Language**: TypeScript 5.5+ (ES2022 target, strict mode enabled)
- **Formatting**: Biome (70 char line width, 4-space indent, single quotes)
- **Imports**: ESM with `.js` extensions, organized by Biome
- **Classes**: Singleton pattern for services/managers (getInstance)
- **Error Handling**: Try-catch with Logger.error() for exceptions
- **Types**: Strongly typed (no implicit any), zod schemas for validation
- **Naming**: camelCase for variables/methods, PascalCase for classes/types
