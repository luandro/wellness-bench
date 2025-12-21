/**
 * Run Planner
 * Resolves the execution plan from configuration
 */

import { createHash } from 'crypto';
import { execSync } from 'child_process';
import type {
  RunConfig,
  QuestionsConfig,
  ProvidersConfig,
  Question,
  ResolvedModel,
  RunPlan,
  GenerationParams,
} from './types.js';

/**
 * Generate a unique run ID from timestamp and hash
 */
export function generateRunId(): string {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const random = Math.random().toString(36).substring(2, 8);
  return `run-${timestamp}-${random}`;
}

/**
 * Get the current git SHA if in a git repository
 */
export function getGitSha(): string | undefined {
  try {
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    return sha;
  } catch {
    return undefined;
  }
}

/**
 * Filter questions based on run configuration
 */
export function resolveQuestions(
  questionsConfig: QuestionsConfig,
  runConfig: RunConfig
): Question[] {
  let questions = questionsConfig.questions;
  const selection = runConfig.question_selection;

  // Filter by enabled status
  if (!selection?.include_disabled) {
    questions = questions.filter((q) => q.enabled);
  }

  // Filter by explicit question IDs
  if (selection?.question_ids && selection.question_ids.length > 0) {
    const ids = new Set(selection.question_ids);
    questions = questions.filter((q) => ids.has(q.id));
  }

  // Filter by domains
  if (selection?.domains && selection.domains.length > 0) {
    const domains = new Set(selection.domains);
    questions = questions.filter((q) => domains.has(q.domain));
  }

  // Filter by tags
  if (selection?.tags && selection.tags.length > 0) {
    const tags = new Set(selection.tags);
    questions = questions.filter((q) =>
      q.tags?.some((t) => tags.has(t))
    );
  }

  // Sort by order
  return questions.sort((a, b) => a.order - b.order);
}

/**
 * Resolve models to run from provider configuration
 */
export function resolveModels(
  providersConfig: ProvidersConfig,
  runConfig: RunConfig
): ResolvedModel[] {
  const models: ResolvedModel[] = [];
  const selection = runConfig.provider_selection;
  const generationParams = runConfig.generation_params || {};

  for (const provider of providersConfig.providers) {
    // Skip disabled providers unless explicitly included
    if (!provider.enabled && !selection?.include_disabled) {
      continue;
    }

    // Filter by provider IDs if specified
    if (selection?.provider_ids && selection.provider_ids.length > 0) {
      if (!selection.provider_ids.includes(provider.provider_id)) {
        continue;
      }
    }

    for (const model of provider.models) {
      // Skip disabled models unless explicitly included
      if (!model.enabled && !selection?.include_disabled) {
        continue;
      }

      // Filter by model IDs if specified
      if (selection?.model_ids && selection.model_ids.length > 0) {
        if (!selection.model_ids.includes(model.id)) {
          continue;
        }
      }

      // Merge params: model defaults < run config overrides
      const params: GenerationParams = {
        ...model.default_params,
        ...generationParams,
      };

      models.push({
        provider_id: provider.provider_id,
        provider_display_name: provider.display_name,
        model_id: model.id,
        model_display_name: model.name,
        model_version: model.version,
        params,
      });
    }
  }

  // Sort by provider then model for consistent ordering
  return models.sort((a, b) => {
    const providerCompare = a.provider_id.localeCompare(b.provider_id);
    if (providerCompare !== 0) return providerCompare;
    return a.model_id.localeCompare(b.model_id);
  });
}

/**
 * Create a complete run plan
 */
export function createRunPlan(
  runConfig: RunConfig,
  questionsConfig: QuestionsConfig,
  providersConfig: ProvidersConfig
): RunPlan {
  const runId = runConfig.run_id || generateRunId();
  const questions = resolveQuestions(questionsConfig, runConfig);
  const models = resolveModels(providersConfig, runConfig);

  if (questions.length === 0) {
    throw new Error('No questions matched the selection criteria');
  }

  if (models.length === 0) {
    throw new Error('No models matched the selection criteria');
  }

  const totalEvaluations = questions.length * models.length;

  return {
    run_id: runId,
    run_name: runConfig.run_name,
    run_description: runConfig.run_description,
    created_at: new Date().toISOString(),
    git_sha: getGitSha(),
    default_language: runConfig.default_language,
    enabled_languages: runConfig.enabled_languages,
    questions,
    models,
    output_dir: runConfig.output_dir || 'benchmarks/results',
    total_evaluations: totalEvaluations,
  };
}

/**
 * Print a summary of the run plan
 */
export function printRunPlanSummary(plan: RunPlan): void {
  console.log('\n=== Run Plan Summary ===\n');
  console.log(`Run ID:        ${plan.run_id}`);
  console.log(`Run Name:      ${plan.run_name}`);
  if (plan.run_description) {
    console.log(`Description:   ${plan.run_description}`);
  }
  console.log(`Created:       ${plan.created_at}`);
  if (plan.git_sha) {
    console.log(`Git SHA:       ${plan.git_sha.substring(0, 8)}`);
  }
  console.log(`Output Dir:    ${plan.output_dir}`);
  console.log(`Languages:     ${plan.enabled_languages.join(', ')}`);

  console.log('\nQuestions:');
  for (const q of plan.questions) {
    console.log(`  - [${q.id}] ${q.title} (${q.domain})`);
  }

  console.log('\nModels:');
  for (const m of plan.models) {
    console.log(`  - ${m.provider_display_name} / ${m.model_display_name}`);
  }

  console.log(`\nTotal evaluations: ${plan.total_evaluations}`);
  console.log('========================\n');
}
