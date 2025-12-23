# AI Human Wellness Benchmark - Workflows

This document outlines the two primary workflows for generating and managing benchmark data.

## 1. Web UI (Builder Mode) - Experimentation & Prototyping

**Best for:** Quick tests, debugging prompts, exploring model behavior interactively.

*   **Access:** Open the application in your browser (e.g., `http://localhost:5173`).
*   **Admin Area:** Click the gear icon in the top-right corner to access the **Run Dashboard**.
*   **API Keys:** Keys are stored locally in your browser's secure storage. You must input them manually.
*   **Data Persistence:**
    *   Runs generated here are **TEMPORARY**. They live in your browser's local storage.
    *   **They are NOT automatically saved to the git repository.**
    *   **To Save:** You must use the **Export** feature (in the "Import/Export" tab) to download a JSON or CSV bundle. You can then manually commit these files if desired, but this is not the standard path for official benchmark records.

## 2. CLI / GitHub Actions - Official Production Runs

**Best for:** Official benchmark records, reproducible evaluations, large-scale batch processing.

*   **Access:** Terminal or GitHub Actions interface.
*   **Execution:** Runs the Node.js pipeline script (`benchmarks/scripts/run-benchmark.ts`).
*   **API Keys:** Read from environment variables (`OPENAI_API_KEY`, etc.).
*   **Data Persistence:**
    *   **Automatic File Generation:** The script automatically writes results to `benchmarks/results/<run_id>/` and updates the catalog at `benchmarks/results/runs.json`.
    *   **Commit Strategy:**
        *   **Local CLI:** You must manually `git add` and `git commit` the generated files in `benchmarks/results/`.
        *   **GitHub Actions:** The "Run Benchmark" workflow is configured to automatically commit and push the new results back to the repository (or create a PR), creating a permanent, version-controlled record.

## Summary

| Feature | Web UI (Builder) | CLI / GitHub Actions |
| :--- | :--- | :--- |
| **Purpose** | Prototyping, debugging, interactive analysis | Official records, automation, reproducibility |
| **Execution** | Browser-based (Client-side) | Node.js Script (Server-side/CI) |
| **Persistence** | Browser LocalStorage (Ephemeral) | File System (Git-tracked) |
| **Commit** | Manual Export -> Manual Commit | Automatic (in CI) or Manual (CLI) |
| **API Keys** | Input in UI (Browser Storage) | Environment Variables (`.env` / Secrets) |