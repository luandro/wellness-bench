# AI Human Wellness Benchmark

Evaluate how AI models reason about human and planetary well-being using a Buen Vivir (Sumak Kawsay) lens. The repo contains a React + Vite app for configuring questions, running evaluations, and reviewing results, plus a benchmark pipeline for batch runs.

## Quickstart

```sh
npm install
npm run dev
```

## Scripts

```sh
npm run dev         # Start the Vite dev server
npm run build       # Production build
npm run build:dev   # Development-mode build
npm run test        # Run tests with Vitest
npm run preview     # Preview the production build
npm run lint        # ESLint
npm run benchmark   # Run benchmark pipeline
npm run benchmark:dry    # Print benchmark plan
npm run benchmark:build  # Type-check benchmark scripts
```

## App Features

- Manage benchmark questions, evaluation prompts, and providers
- Configure API keys (stored locally in the browser)
- Run evaluations and review results
- Import/export config and results bundles

## Benchmark Pipeline

Benchmark configs and providers live in `benchmarks/`. Outputs are written to `benchmarks/results/` (gitignored).

See [`benchmarks/README.md`](benchmarks/README.md) for detailed instructions on:
- Setting up the pipeline
- **Obtaining and configuring API keys** (OpenAI, Anthropic, Google, xAI, DeepSeek)
- Running the benchmark scripts

## Project Structure

- `src/` app entry and routes
- `src/pages/` route-level screens
- `src/components/` shared UI (shadcn primitives in `src/components/ui/`)
- `benchmarks/` pipeline scripts, configs, and providers

## Security Note

The UI stores API keys locally in browser storage (encrypted with Web Crypto when available). Treat this as a convenience for demos, not a production-grade secrets solution.
