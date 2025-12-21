# Benchmark Results

This directory contains the output of benchmark runs.

## Structure

```
results/
├── runs.json                      # Catalog of all runs
└── <run_id>/                      # Individual run directories
    ├── index.json                 # Run metadata and navigation
    ├── questions.snapshot.json    # Questions config snapshot
    ├── eval_prompts.snapshot.json # Eval prompts snapshot
    ├── providers.snapshot.json    # Providers snapshot
    ├── per_question/              # Aggregated per-question results
    │   └── <question_id>.json
    └── per_model/                 # Detailed per-model results
        └── <question_id>/
            └── <provider>__<model>.json
```

## Loading Results in the Viewer

1. **Timeline View**: Load `runs.json` to show available benchmark runs
2. **Run Selection**: Load `<run_id>/index.json` for run metadata
3. **Question View**: Load `per_question/<id>.json` for summaries
4. **Model Details**: Load `per_model/<qid>/<model>.json` for full details

## File Formats

### runs.json

```json
{
  "version": "1.0.0",
  "updated_at": "2024-01-15T10:30:00Z",
  "runs": [
    {
      "run_id": "run-20240115-abc123",
      "run_name": "Benchmark Run",
      "status": "completed",
      "question_count": 3,
      "model_count": 5,
      "path": "run-20240115-abc123"
    }
  ]
}
```

### index.json

```json
{
  "run_id": "run-20240115-abc123",
  "run_name": "Benchmark Run",
  "created_at": "2024-01-15T10:00:00Z",
  "languages_available": ["en", "pt-BR"],
  "models_included": [...],
  "question_ids": [...],
  "file_map": {
    "snapshots": {...},
    "per_question": {...},
    "per_model": {...}
  },
  "stats": {
    "total_evaluations": 15,
    "succeeded": 14,
    "failed": 1
  }
}
```

### per_question/<id>.json

Contains:
- Question metadata
- Model summaries with scores
- Synthesis (common ground, divergences, bias patterns)
- References to detailed per-model files

### per_model/<qid>/<model>.json

Contains:
- Raw model answer
- All evaluation step outputs (A-E)
- Extracted quotes for highlighting
- Display blocks for viewer UI
- Token usage and timing metadata

## Git Considerations

Result files can be committed to the repository or stored as artifacts:

- **Committed**: Enables historical comparison and viewer access
- **Artifacts**: Keeps repo size small, requires artifact download

The `.gitignore` may exclude `results/` - check before committing.
