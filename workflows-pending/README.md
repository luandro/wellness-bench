# GitHub Workflows (Pending)

This directory contains GitHub Action workflows that require manual setup due to repository permissions.

## Available Workflows

### deploy-pages.yml
Deploys the Results Viewer SPA to GitHub Pages on push to `main`.

**To enable:**
1. Copy `deploy-pages.yml` to `.github/workflows/deploy-pages.yml`
2. In your repository settings, enable GitHub Pages with "GitHub Actions" as the source
3. Push to `main` to trigger deployment

**Features:**
- Builds the Vite SPA
- Copies benchmark results to the dist folder
- Adds `.nojekyll` to prevent Jekyll processing
- Deploys to GitHub Pages

### run-benchmark.yml
Runs the benchmark pipeline via workflow_dispatch.

**To enable:**
1. Copy `run-benchmark.yml` to `.github/workflows/run-benchmark.yml`
2. Add required secrets in repository settings:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_API_KEY`
   - `XAI_API_KEY`
   - `DEEPSEEK_API_KEY`
3. Trigger manually from Actions tab

## GitHub Pages URLs

After deployment, the viewer will be available at:
- **GitHub Pages:** `https://<username>.github.io/<repo>/`
- **Custom Domain:** Configure in repository settings

The app automatically detects the hosting environment and adjusts asset paths accordingly.
