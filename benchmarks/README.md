# AI Human Wellness Benchmark Pipeline

This directory contains the benchmark pipeline that generates static JSON result bundles for the wellness benchmark viewer.

## Overview

The pipeline:
1. **Generates answers** from multiple AI models to wellness-related questions
2. **Evaluates responses** through a 5-step analysis framework (A-E)
3. **Synthesizes** common patterns and divergences across models
4. **Translates** viewer-facing content to multiple languages
5. **Produces** static JSON bundles consumable by the SPA viewer

## Directory Structure

```
benchmarks/
├── config/                    # Configuration files
│   ├── questions.json         # Benchmark questions
│   ├── providers.json         # AI provider/model definitions
│   ├── eval_prompts.json      # Evaluation prompts and bias taxonomy
│   └── run_config.json        # Default run configuration
├── schemas/                   # JSON Schemas for validation
│   ├── questions.schema.json
│   ├── providers.schema.json
│   ├── eval_prompts.schema.json
│   ├── run_config.schema.json
│   ├── run_index.schema.json
│   ├── per_question.schema.json
│   ├── per_model.schema.json
│   └── runs.schema.json
├── providers/                 # Provider adapters
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── google.ts
│   ├── grok.ts
│   ├── deepseek.ts
│   └── registry.ts
├── scripts/                   # Pipeline scripts
│   ├── run-benchmark.ts       # Main CLI entry point
│   ├── config-loader.ts       # Configuration loading/validation
│   ├── run-planner.ts         # Run plan resolution
│   ├── pipeline.ts            # Pipeline execution
│   ├── output-generator.ts    # Output bundle generation
│   └── types.ts               # TypeScript types
├── results/                   # Output directory (gitignored)
│   ├── runs.json              # Catalog of all runs
│   └── <run_id>/              # Per-run result bundles
└── tsconfig.json              # TypeScript config for pipeline
```

## Running Locally

### Prerequisites

1. **Node.js 20+** and **pnpm**
2. **API keys** for the providers you want to benchmark

### Environment Variables

Set the API keys for the providers you want to use:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."
export XAI_API_KEY="..."
export DEEPSEEK_API_KEY="..."
```

### Install Dependencies

```bash
pnpm install
```

### Run the Benchmark

```bash
# Run with default configuration
pnpm run benchmark

# Dry run (shows plan without executing)
pnpm run benchmark:dry

# Run with custom config
pnpm run benchmark -- --runConfig path/to/config.json

# Run only specific providers
pnpm run benchmark -- --providers openai,anthropic

# Run with verbose output
pnpm run benchmark -- --verbose
```

### CLI Options

| Option | Description |
|--------|-------------|
| `--runConfig <path>` | Path to run configuration file |
| `--configDir <path>` | Path to config directory |
| `--dryRun` | Print run plan without executing |
| `--verbose` | Enable verbose logging |
| `--providers <list>` | Comma-separated provider list |
| `--questions <list>` | Comma-separated question IDs |
| `--help` | Show help message |

## Configuration

### run_config.json

The run configuration controls what gets executed:

```json
{
  "run_name": "My Benchmark Run",
  "run_description": "Testing new models",
  "default_language": "en",
  "enabled_languages": ["en", "pt-BR"],
  "question_selection": {
    "question_ids": ["q1-diagnosis", "q2-causality"],
    "include_disabled": false
  },
  "provider_selection": {
    "provider_ids": ["openai", "anthropic"],
    "include_disabled": false
  },
  "generation_params": {
    "temperature": 0.7,
    "max_tokens": 4096
  },
  "synthesis": {
    "enabled": true
  },
  "translation": {
    "enabled": true
  },
  "concurrency": {
    "max_concurrent_requests": 3,
    "per_provider_limit": 2,
    "retry_attempts": 3
  }
}
```

## GitHub Actions

The pipeline can be run via GitHub Actions using workflow dispatch:

1. Go to **Actions** → **Run Benchmark**
2. Click **Run workflow**
3. Configure options:
   - **run_config_path**: Path to config file
   - **providers**: Comma-separated provider list
   - **commit_results**: Whether to commit results
   - **create_pr**: Whether to create a PR

### Required Secrets

Add these secrets to your repository:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `XAI_API_KEY`
- `DEEPSEEK_API_KEY`

## Output Format

### runs.json

Top-level catalog of all benchmark runs:

```json
{
  "version": "1.0.0",
  "updated_at": "2024-01-15T10:30:00Z",
  "runs": [
    {
      "run_id": "run-20240115-abc123",
      "run_name": "January Benchmark",
      "created_at": "2024-01-15T10:00:00Z",
      "status": "completed",
      "languages": ["en", "pt-BR"],
      "question_count": 3,
      "model_count": 5,
      "path": "run-20240115-abc123"
    }
  ]
}
```

### Per-Run Bundle

Each run creates a directory with:

```
<run_id>/
├── index.json                 # Run metadata and file map
├── questions.snapshot.json    # Questions used (for reproducibility)
├── eval_prompts.snapshot.json # Prompts used
├── providers.snapshot.json    # Providers used
├── per_question/
│   ├── q1-diagnosis.json      # Aggregated results per question
│   └── ...
└── per_model/
    └── <question_id>/
        ├── openai__gpt-4o.json       # Detailed per-model results
        ├── anthropic__claude-sonnet-4.json
        └── ...
```

### Viewer Integration

The SPA viewer loads data as follows:

1. Fetch `/benchmarks/results/runs.json` → Show run timeline
2. User selects run → Fetch `/<run_id>/index.json`
3. User selects question → Fetch `/per_question/<question_id>.json`
4. User expands model details → Fetch `/per_model/<question_id>/<model>.json`

## Evaluation Framework

### 5-Step Analysis (A-E)

| Step | Name | Description |
|------|------|-------------|
| A | Structured Decomposition | Extract key themes and structures |
| B | Bias Detection | Identify market/capitalist biases |
| C | Buen Vivir Alignment | Score alignment with well-being principles |
| D | Coherence & Realism | Assess logical consistency |
| E | Epistemic Humility | Evaluate uncertainty acknowledgment |

### Bias Taxonomy

- **Market Default**: Assuming market solutions are natural
- **Capitalism Normalization**: Treating capitalism as inevitable
- **Growth Normalization**: Assuming growth is necessary
- **Technosolutionism**: Over-reliance on tech fixes
- **Individualization**: Shifting blame to individuals
- **Power Invisibility**: Ignoring power structures
- **Ecological Externalization**: Ignoring environmental costs
- **Win-Win Handwave**: Claiming universal benefits without tradeoffs

## Troubleshooting

### "API key not found"

Ensure the environment variable is set:

```bash
echo $OPENAI_API_KEY  # Should show your key
```

### "No models matched selection criteria"

Check your `run_config.json`:
- Ensure `provider_selection.provider_ids` matches providers in `providers.json`
- Ensure models are `enabled: true` in `providers.json`

### Rate limit errors

Reduce concurrency in `run_config.json`:

```json
{
  "concurrency": {
    "max_concurrent_requests": 2,
    "per_provider_limit": 1
  }
}
```

## Development

### Type Checking

```bash
pnpm run benchmark:build
```

### Adding a New Provider

1. Create adapter in `providers/<name>.ts`
2. Implement `ProviderAdapter` interface
3. Register in `providers/registry.ts`
4. Add to `config/providers.json`
