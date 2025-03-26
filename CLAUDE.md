# Crackd Codebase Guidelines

## Commands
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Format: `npm run format` 
- Typecheck: `npm run typecheck`
- Test (all): `npm test`
- Test (single): `npm test -- --run <path-to-test-file>`
- E2E tests: `npm run test:e2e:dev` or `npm run test:e2e:run`

## Code Style
- TypeScript with strict mode enabled
- Use named exports over default exports
- Imports order: builtin → external → internal → parent → sibling (with newlines between groups)
- Server files use `.server.ts` suffix
- React components use PascalCase, hooks use `use` prefix
- Function parameters and return values should be typed
- Use early returns for error handling
- Format with Prettier (configured in prettier.config.js)
- Follow ESLint rules (React, TypeScript, Remix conventions)
- Keep component files focused on a single responsibility

This is a Remix app with Prisma for database access and Tailwind for styling.