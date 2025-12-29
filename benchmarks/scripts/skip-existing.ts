/**
 * Skip Existing Results
 * Utilities for detecting and skipping already-completed evaluations
 */

import { readdir, readFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import type { RunPlan, ResolvedModel, Question, RunIndex } from './types.js';

interface CompletedEvaluation {
  question_id: string;
  provider_id: string;
  model_id: string;
}

/**
 * Scan the results directory and build a set of completed evaluations
 */
export async function findCompletedEvaluations(
  resultsDir: string
): Promise<Set<string>> {
  const completed = new Set<string>();

  if (!existsSync(resultsDir)) {
    return completed;
  }

  // Read all run directories
  const entries = await readdir(resultsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('run-')) {
      continue;
    }

    const runDir = resolve(resultsDir, entry.name);
    const indexPath = resolve(runDir, 'index.json');

    if (!existsSync(indexPath)) {
      continue;
    }

    try {
      const content = await readFile(indexPath, 'utf-8');
      const runIndex = JSON.parse(content) as RunIndex;

      // For each model and question combination that succeeded
      for (const model of runIndex.models_included) {
        for (const questionId of runIndex.question_ids) {
          // Create a unique key for this evaluation
          const key = `${questionId}::${model.provider_id}::${model.model_id}`;
          completed.add(key);
        }
      }
    } catch (error) {
      console.warn(`Failed to read run index from ${indexPath}:`, error);
      continue;
    }
  }

  return completed;
}

/**
 * Filter a run plan to exclude already-completed evaluations
 */
export async function filterRunPlan(
  plan: RunPlan,
  rootDir: string
): Promise<{
  filteredPlan: RunPlan;
  skippedCount: number;
  completedEvaluations: CompletedEvaluation[];
  completedKeys: Set<string>;
}> {
  const resultsDir = resolve(rootDir, plan.output_dir);
  const completed = await findCompletedEvaluations(resultsDir);

  const completedEvaluations: CompletedEvaluation[] = [];
  const remainingCombinations = new Set<string>();

  // Track which models and questions are actually needed
  const neededModels = new Map<string, ResolvedModel>();
  const neededQuestions = new Map<string, Question>();

  // Check each model+question combination
  for (const model of plan.models) {
    for (const question of plan.questions) {
      const key = `${question.id}::${model.provider_id}::${model.model_id}`;

      if (completed.has(key)) {
        completedEvaluations.push({
          question_id: question.id,
          provider_id: model.provider_id,
          model_id: model.model_id,
        });
      } else {
        // This specific combination needs to be run
        remainingCombinations.add(key);
        neededModels.set(`${model.provider_id}::${model.model_id}`, model);
        neededQuestions.set(question.id, question);
      }
    }
  }

  // Convert maps to arrays
  const remainingModels: ResolvedModel[] = Array.from(neededModels.values());
  const remainingQuestions: Question[] = Array.from(neededQuestions.values());

  // IMPORTANT: Use actual count of remaining combinations, not Cartesian product
  // Example: if Model A needs Q2, and Model B needs Q1+Q2, that's 3 combinations, not 2×2=4
  const newTotalEvaluations = remainingCombinations.size;

  const filteredPlan: RunPlan = {
    ...plan,
    models: remainingModels,
    questions: remainingQuestions,
    total_evaluations: newTotalEvaluations,
  };

  return {
    filteredPlan,
    skippedCount: completedEvaluations.length,
    completedEvaluations,
    completedKeys: completed, // Return completed keys for pipeline to check
  };
}

/**
 * Print a summary of what will be skipped
 */
export function printSkipSummary(
  originalPlan: RunPlan,
  filteredPlan: RunPlan,
  skippedCount: number
): void {
  if (skippedCount === 0) {
    console.log('\nNo existing results found - will run all evaluations.');
    return;
  }

  console.log('\n=== Skip Existing Summary ===\n');
  console.log(`Original evaluations:  ${originalPlan.total_evaluations}`);
  console.log(`Already completed:     ${skippedCount}`);
  console.log(`Remaining to run:      ${filteredPlan.total_evaluations}`);
  console.log(`Models after filter:   ${filteredPlan.models.length}/${originalPlan.models.length}`);
  console.log(`Questions after filter: ${filteredPlan.questions.length}/${originalPlan.questions.length}`);
  console.log('=============================\n');
}
