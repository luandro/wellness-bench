/**
 * Output Generator
 * Generates the static result bundle files for the viewer
 */

import { mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import type {
  RunPlan,
  PipelineItem,
  SynthesisResult,
  QuestionsConfig,
  ProvidersConfig,
  EvalPromptsConfig,
  RunIndex,
  RunIndexFileMap,
  RunsCatalog,
  RunsCatalogEntry,
  PerQuestionResult,
  PerQuestionSynthesis,
  PerModelResult,
  DisplayBlocks,
  EvaluationOutputs,
} from './types.js';

/**
 * Ensure a directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Write JSON file with stable ordering
 */
async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureDir(dirname(filePath));
  const content = JSON.stringify(data, null, 2);
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Generate a summary from evaluation outputs
 */
function generateSummary(
  answer: string,
  evaluations: EvaluationOutputs
): string {
  const parts: string[] = [];

  if (evaluations.step_a?.wellbeing_definition) {
    parts.push(`Defines well-being as: ${evaluations.step_a.wellbeing_definition.slice(0, 150)}...`);
  }

  if (evaluations.step_c) {
    parts.push(`Buen Vivir alignment score: ${evaluations.step_c.alignment_score_0_5}/5.`);
  }

  if (evaluations.step_b?.detected_biases) {
    const biasCount = evaluations.step_b.detected_biases.length;
    if (biasCount > 0) {
      parts.push(`Detected ${biasCount} bias pattern(s).`);
    }
  }

  if (parts.length === 0) {
    return answer.slice(0, 200) + '...';
  }

  return parts.join(' ');
}

/**
 * Extract quotes organized by bias type
 */
function extractQuotesByBias(evaluations: EvaluationOutputs): Record<string, string[]> {
  const quotes: Record<string, string[]> = {};

  if (evaluations.step_b?.detected_biases) {
    for (const bias of evaluations.step_b.detected_biases) {
      quotes[bias.id] = bias.evidence_quotes || [];
    }
  }

  return quotes;
}

/**
 * Create display blocks from evaluation outputs
 */
function createDisplayBlocks(
  answer: string,
  evaluations: EvaluationOutputs,
  summary: string
): DisplayBlocks {
  const blocks: DisplayBlocks = {
    summary,
    answer_preview: answer.slice(0, 500) + (answer.length > 500 ? '...' : ''),
  };

  if (evaluations.step_a) {
    blocks.decomposition = {
      wellbeing_definition: evaluations.step_a.wellbeing_definition,
      main_problems: evaluations.step_a.main_problems,
      root_causes: evaluations.step_a.root_causes,
      mechanisms_of_change: evaluations.step_a.mechanisms_of_change,
      notable_omissions: evaluations.step_a.notable_omissions,
    };
  }

  if (evaluations.step_b) {
    blocks.bias_analysis = {
      detected_biases: evaluations.step_b.detected_biases.map((b) => ({
        id: b.id,
        label: b.label,
        explanation: b.explanation,
        evidence_quotes: b.evidence_quotes,
      })),
      overall_summary: evaluations.step_b.overall_bias_profile_summary,
    };
  }

  if (evaluations.step_c) {
    blocks.buen_vivir = {
      score: evaluations.step_c.alignment_score_0_5,
      alignment_areas: evaluations.step_c.alignment_areas,
      tensions: evaluations.step_c.tensions_or_absences,
      explanation: evaluations.step_c.explanation,
    };
  }

  if (evaluations.step_d) {
    blocks.coherence = {
      score: evaluations.step_d.coherence_score_0_5,
      tradeoffs_acknowledged: evaluations.step_d.tradeoffs_acknowledged,
      enforcement_mechanisms: evaluations.step_d.enforcement_or_coordination_mechanisms_present,
      notes: evaluations.step_d.realism_notes,
      explanation: evaluations.step_d.explanation,
    };
  }

  if (evaluations.step_e) {
    blocks.epistemic_humility = {
      score: evaluations.step_e.humility_score_0_5,
      uncertainty_acknowledged: evaluations.step_e.uncertainty_acknowledged,
      evidence_for_change: evaluations.step_e.what_evidence_would_change_mind,
      explanation: evaluations.step_e.explanation,
    };
  }

  return blocks;
}

/**
 * Generate all output files for a run
 */
export async function generateOutputBundle(
  plan: RunPlan,
  items: PipelineItem[],
  syntheses: SynthesisResult[],
  configs: {
    questions: QuestionsConfig;
    providers: ProvidersConfig;
    evalPrompts: EvalPromptsConfig;
  },
  rootDir: string
): Promise<{ runDir: string; indexPath: string }> {
  const runDir = resolve(rootDir, plan.output_dir, plan.run_id);
  await ensureDir(runDir);

  // Create subdirectories
  const perQuestionDir = resolve(runDir, 'per_question');
  const perModelDir = resolve(runDir, 'per_model');
  await ensureDir(perQuestionDir);
  await ensureDir(perModelDir);

  // Write snapshot files
  const snapshotsDir = runDir;
  await writeJsonFile(resolve(snapshotsDir, 'questions.snapshot.json'), configs.questions);
  await writeJsonFile(resolve(snapshotsDir, 'eval_prompts.snapshot.json'), configs.evalPrompts);
  await writeJsonFile(resolve(snapshotsDir, 'providers.snapshot.json'), configs.providers);

  // Build file map
  const fileMap: RunIndexFileMap = {
    snapshots: {
      questions: 'questions.snapshot.json',
      eval_prompts: 'eval_prompts.snapshot.json',
      providers: 'providers.snapshot.json',
    },
    per_question: {},
    per_model: {},
  };

  // Group items by question
  const itemsByQuestion = new Map<string, PipelineItem[]>();
  for (const item of items) {
    const existing = itemsByQuestion.get(item.question_id) || [];
    existing.push(item);
    itemsByQuestion.set(item.question_id, existing);
  }

  // Group syntheses by question and language
  const synthesesByQuestion = new Map<string, Map<string, SynthesisResult>>();
  for (const synthesis of syntheses) {
    let questionMap = synthesesByQuestion.get(synthesis.question_id);
    if (!questionMap) {
      questionMap = new Map();
      synthesesByQuestion.set(synthesis.question_id, questionMap);
    }
    questionMap.set(synthesis.language, synthesis);
  }

  // Generate per-question and per-model files
  for (const question of plan.questions) {
    const questionItems = itemsByQuestion.get(question.id) || [];
    const questionSyntheses = synthesesByQuestion.get(question.id) || new Map();

    // Build synthesis object per language
    const synthesisPerLang: Record<string, PerQuestionSynthesis> = {};
    for (const [lang, synthesis] of questionSyntheses) {
      synthesisPerLang[lang] = {
        common_ground: synthesis.common_ground,
        key_divergences: synthesis.key_divergences,
        salient_bias_patterns: synthesis.salient_bias_patterns,
        generated_at: synthesis.generated_at,
      };
    }

    // If no synthesis, add empty
    if (Object.keys(synthesisPerLang).length === 0) {
      synthesisPerLang[plan.default_language] = {
        common_ground: [],
        key_divergences: [],
        salient_bias_patterns: [],
      };
    }

    // Create per-question result
    const perQuestionResult: PerQuestionResult = {
      question_id: question.id,
      question: {
        id: question.id,
        title: question.title,
        text: question.text,
        domain: question.domain,
        order: question.order,
      },
      models: [],
      synthesis: synthesisPerLang,
    };

    // Create per-model directory for this question
    const questionModelDir = resolve(perModelDir, question.id);
    await ensureDir(questionModelDir);
    fileMap.per_model[question.id] = {};

    for (const item of questionItems) {
      const model = plan.models.find(
        (m) => m.provider_id === item.provider_id && m.model_id === item.model_id
      );

      if (!model) continue;

      const modelFileName = `${item.provider_id}__${item.model_id}.json`;
      const modelFilePath = resolve(questionModelDir, modelFileName);
      const relativeModelPath = `per_model/${question.id}/${modelFileName}`;

      // Generate summary
      const summary = item.raw_answer && item.evaluations
        ? generateSummary(item.raw_answer, item.evaluations)
        : item.error || 'No response generated';

      // Create display blocks
      const displayBlocks: Record<string, DisplayBlocks> = {};
      if (item.raw_answer && item.evaluations) {
        displayBlocks[plan.default_language] = createDisplayBlocks(
          item.raw_answer,
          item.evaluations,
          summary
        );
      }

      // Per-model result
      const perModelResult: PerModelResult = {
        question_id: question.id,
        provider_id: item.provider_id,
        model_id: item.model_id,
        display_name: model.model_display_name,
        status: item.status === 'succeeded' ? 'succeeded' : 'failed',
        error: item.error,
        raw_answer: item.raw_answer || '',
        evaluations: item.evaluations || {
          step_a: null,
          step_b: null,
          step_c: null,
          step_d: null,
          step_e: null,
        },
        extracted_quotes: item.evaluations ? extractQuotesByBias(item.evaluations) : {},
        display_blocks: displayBlocks,
        prompt_inputs: {
          question_text: question.text,
          system_prompt: configs.evalPrompts.answer_wrapper_prompt.replace('{{question}}', question.text),
          model_params: model.params,
        },
        metadata: {
          timestamp: item.metadata?.generation_timestamp || new Date().toISOString(),
          latency_ms: item.metadata?.generation_latency_ms || 0,
          token_usage: item.metadata?.generation_usage,
          evaluation_latencies: item.metadata?.evaluation_latencies,
        },
      };

      await writeJsonFile(modelFilePath, perModelResult);
      fileMap.per_model[question.id][`${item.provider_id}__${item.model_id}`] = relativeModelPath;

      // Add to per-question summary
      perQuestionResult.models.push({
        provider_id: item.provider_id,
        model_id: item.model_id,
        display_name: model.model_display_name,
        status: item.status === 'succeeded' ? 'succeeded' : 'failed',
        error: item.error,
        summary: { [plan.default_language]: summary },
        scores: {
          buen_vivir_alignment: item.evaluations?.step_c?.alignment_score_0_5,
          coherence: item.evaluations?.step_d?.coherence_score_0_5,
          epistemic_humility: item.evaluations?.step_e?.humility_score_0_5,
          bias_count: item.evaluations?.step_b?.detected_biases?.length || 0,
        },
        detected_bias_ids: item.evaluations?.step_b?.detected_biases?.map((b) => b.id) || [],
        detail_file: relativeModelPath,
      });
    }

    // Sort models by provider then model
    perQuestionResult.models.sort((a, b) => {
      const providerCompare = a.provider_id.localeCompare(b.provider_id);
      if (providerCompare !== 0) return providerCompare;
      return a.model_id.localeCompare(b.model_id);
    });

    // Write per-question file
    const questionFileName = `${question.id}.json`;
    const questionFilePath = resolve(perQuestionDir, questionFileName);
    await writeJsonFile(questionFilePath, perQuestionResult);
    fileMap.per_question[question.id] = `per_question/${questionFileName}`;
  }

  // Calculate stats
  const succeeded = items.filter((i) => i.status === 'succeeded').length;
  const failed = items.filter((i) => i.status === 'failed').length;
  const totalDuration = items.reduce(
    (sum, i) => sum + (i.metadata?.generation_latency_ms || 0),
    0
  );

  // Create index.json
  const runIndex: RunIndex = {
    run_id: plan.run_id,
    run_name: plan.run_name,
    run_description: plan.run_description,
    created_at: plan.created_at,
    completed_at: new Date().toISOString(),
    git_sha: plan.git_sha,
    languages_available: plan.enabled_languages,
    models_included: plan.models.map((m) => ({
      provider_id: m.provider_id,
      model_id: m.model_id,
      display_name: m.model_display_name,
      version: m.model_version,
    })),
    question_ids: plan.questions.map((q) => q.id),
    file_map: fileMap,
    stats: {
      total_questions: plan.questions.length,
      total_models: plan.models.length,
      total_evaluations: plan.total_evaluations,
      succeeded,
      failed,
      total_duration_ms: totalDuration,
    },
  };

  const indexPath = resolve(runDir, 'index.json');
  await writeJsonFile(indexPath, runIndex);

  return { runDir, indexPath };
}

/**
 * Update the runs catalog with a new run entry
 */
export async function updateRunsCatalog(
  plan: RunPlan,
  items: PipelineItem[],
  rootDir: string
): Promise<void> {
  const catalogPath = resolve(rootDir, plan.output_dir, 'runs.json');

  // Load existing catalog or create new
  let catalog: RunsCatalog;
  if (existsSync(catalogPath)) {
    const content = await readFile(catalogPath, 'utf-8');
    catalog = JSON.parse(content) as RunsCatalog;
  } else {
    catalog = {
      version: '1.0.0',
      updated_at: new Date().toISOString(),
      runs: [],
    };
  }

  // Determine status
  const succeeded = items.filter((i) => i.status === 'succeeded').length;
  const failed = items.filter((i) => i.status === 'failed').length;
  let status: 'completed' | 'failed' | 'partial' = 'completed';
  if (failed === items.length) {
    status = 'failed';
  } else if (failed > 0) {
    status = 'partial';
  }

  // Create new entry
  const entry: RunsCatalogEntry = {
    run_id: plan.run_id,
    run_name: plan.run_name,
    run_description: plan.run_description,
    created_at: plan.created_at,
    completed_at: new Date().toISOString(),
    status,
    git_sha: plan.git_sha,
    languages: plan.enabled_languages,
    question_count: plan.questions.length,
    model_count: plan.models.length,
    path: plan.run_id,
  };

  // Remove existing entry with same run_id if present
  catalog.runs = catalog.runs.filter((r) => r.run_id !== plan.run_id);

  // Add new entry
  catalog.runs.push(entry);

  // Sort by created_at descending
  catalog.runs.sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Update timestamp
  catalog.updated_at = new Date().toISOString();

  await writeJsonFile(catalogPath, catalog);
}
