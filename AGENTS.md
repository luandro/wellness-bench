# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React app entry (`main.tsx`) and router (`App.tsx`).
- `src/pages/` holds route-level screens, while `src/components/` is for reusable UI (with shadcn primitives in `src/components/ui/`).
- `src/contexts/`, `src/hooks/`, `src/lib/`, `src/data/`, and `src/types/` keep state, utilities, datasets, and shared types organized.
- `public/` stores static assets and `index.html` is the Vite entry point.
- `benchmarks/` contains the benchmark pipeline (configs, providers, scripts) with output in `benchmarks/results/` (gitignored).
- `workflows-pending/` keeps draft GitHub Actions workflows.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server.
- `npm run build` creates a production build; `npm run build:dev` builds with development mode.
- `npm run preview` serves the production build locally.
- `npm run lint` runs ESLint across the repo.
- `npm run benchmark` runs the benchmark pipeline; `npm run benchmark:dry` prints the plan; `npm run benchmark:build` type-checks benchmark scripts.

## Coding Style & Naming Conventions
- TypeScript + React (Vite). Use the `@/` alias for `src/` imports.
- Two-space indentation, semicolons, ES modules.
- Components use PascalCase (`src/pages/BenchmarkPage.tsx`), hooks use `useX`, and shared types live in `src/types/`.
- Styling relies on Tailwind classes and `className` composition; prefer existing `src/components/ui/` primitives.
- Linting is configured in `eslint.config.js` (React hooks + refresh rules).

## Testing Guidelines
- No automated test framework is configured currently (no `*.test.*` files found).
- If you add tests, colocate `*.test.tsx` or `__tests__/` near the feature and document the new test command in `package.json`.

## Commit & Pull Request Guidelines
- Recent commits use short, imperative, sentence-case subjects (e.g., “Add …”, “Fix …”). Keep messages focused on one change.
- PRs should include a concise summary, linked issue (if applicable), and screenshots/gifs for UI changes.
- Ensure `npm run lint` and `npm run build` pass before requesting review.

## Configuration & Secrets
- Benchmark runs require provider API keys (see `benchmarks/config/` and `benchmarks/README.md`); never commit secrets.
