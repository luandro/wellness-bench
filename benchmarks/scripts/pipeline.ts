/**
 * Pipeline Execution
 * Runs the benchmark pipeline: generation, evaluation, synthesis, translation
 */

import pLimit from 'p-limit';
import type {
  RunPlan,
  EvalPromptsConfig,
  PipelineItem,
  SynthesisResult,
  ProviderAdapter,
  ChatMessage,
  CompletionRequest,
  StepAOutput,
  StepBOutput,
  StepCOutput,
  StepDOutput,
  StepEOutput,
  EvaluationOutputs,
  ConcurrencyConfig,
  TokenUsage,
} from './types.js';
import { parseJsonResponse } from '../providers/base.js';
import { hashObject, hashString, readCache, writeCache } from './cache.js';

interface PipelineContext {
  adapters: Map<string, ProviderAdapter>;
  evalPrompts: EvalPromptsConfig;
  concurrency: ConcurrencyConfig;
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
  cache?: {
    enabled?: boolean;
    dir?: string;
  };
  onProgress?: (current: number, total: number, message: string) => void;
}

interface GenerationResult {
  content: string;
  latency_ms: number;
  usage?: TokenUsage;
}

function supportsJsonMode(modelId: string): boolean {
  const normalized = modelId.toLowerCase();
  if (normalized.includes('gpt-5')) {
    return false;
  }
  return (
    normalized.includes('gpt-4o') ||
    normalized.includes('gpt-4') ||
    normalized.includes('gpt-3.5')
  );
}

function supportsStructuredOutputs(modelId: string): boolean {
  const normalized = modelId.toLowerCase();
  if (normalized.includes('gpt-5')) {
    return false;
  }
  if (normalized.includes('gpt-4o-mini')) {
    return true;
  }
  return normalized.includes('gpt-4o-2024-08-06');
}

function getResponseFormat(
  adapter: ProviderAdapter,
  modelId: string,
  jsonSchema?: Record<string, unknown>
): CompletionRequest['response_format'] | undefined {
  if (adapter.provider_id !== 'openai') {
    if (adapter.provider_id === 'openrouter' && supportsJsonMode(modelId)) {
      return { type: 'json_object' };
    }
    return undefined;
  }

  if (jsonSchema && supportsStructuredOutputs(modelId)) {
    return {
      type: 'json_schema',
      json_schema: {
        name: 'evaluation_outputs',
        strict: true,
        schema: jsonSchema,
      },
    };
  }

  return supportsJsonMode(modelId) ? { type: 'json_object' } : undefined;
}

async function requestJsonResponse<T>(
  adapter: ProviderAdapter,
  modelId: string,
  messages: ChatMessage[],
  params: { temperature?: number; max_tokens?: number },
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  },
  responseFormat?: CompletionRequest['response_format']
): Promise<{ result: T; latency_ms: number }> {
  const response = await adapter.complete({
    model: modelId,
    messages,
    temperature: params.temperature ?? 0.3,
    max_tokens: params.max_tokens ?? 2000,
    response_format: responseFormat,
    retry_options: retryOptions,
  });

  let result: T;
  try {
    result = parseJsonResponse(response.content) as T;
  } catch (parseError) {
    const repairMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: 'The response was not valid JSON. Please respond with ONLY valid JSON matching the required schema, no additional text or markdown.' },
    ];

    const retryResponse = await adapter.complete({
      model: modelId,
      messages: repairMessages,
      temperature: 0.1,
      max_tokens: params.max_tokens ?? 2000,
      response_format: responseFormat,
      retry_options: retryOptions,
    });

    try {
      result = parseJsonResponse(retryResponse.content) as T;
    } catch (retryError) {
      const originalMessage = parseError instanceof Error ? parseError.message : String(parseError);
      const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
      throw new Error(
        `Failed to parse JSON after repair attempt. Original error: ${originalMessage}. Retry error: ${retryMessage}`
      );
    }
  }

  return { result, latency_ms: response.latency_ms };
}

/**
 * Generate an answer from a model
 */
async function generateAnswer(
  adapter: ProviderAdapter,
  modelId: string,
  questionText: string,
  answerPrompt: string,
  params: { temperature?: number; max_tokens?: number },
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<GenerationResult> {
  const systemPrompt = answerPrompt.replace('{{question}}', questionText);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: questionText },
  ];

  const response = await adapter.complete({
    model: modelId,
    messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens ?? 4096,
    retry_options: retryOptions,
  });

  return {
    content: response.content,
    latency_ms: response.latency_ms,
    usage: response.usage,
  };
}

/**
 * Run a single evaluation step
 */
async function runEvaluationStep<T>(
  adapter: ProviderAdapter,
  modelId: string,
  promptTemplate: string,
  answer: string,
  params: { temperature?: number; max_tokens?: number },
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  },
  responseFormat?: CompletionRequest['response_format']
): Promise<{ result: T; latency_ms: number }> {
  const prompt = promptTemplate.replace('{{answer}}', answer);

  const messages: ChatMessage[] = [
    { role: 'user', content: prompt },
  ];

  return requestJsonResponse(
    adapter,
    modelId,
    messages,
    params,
    retryOptions,
    responseFormat
  );
}

function normalizeEvaluationOutputs(raw: Partial<EvaluationOutputs> & Record<string, unknown>): EvaluationOutputs {
  return {
    step_a: (raw.step_a ?? raw['step-a'] ?? null) as StepAOutput | null,
    step_b: (raw.step_b ?? raw['step-b'] ?? null) as StepBOutput | null,
    step_c: (raw.step_c ?? raw['step-c'] ?? null) as StepCOutput | null,
    step_d: (raw.step_d ?? raw['step-d'] ?? null) as StepDOutput | null,
    step_e: (raw.step_e ?? raw['step-e'] ?? null) as StepEOutput | null,
  };
}

function hasAllEvaluationSteps(outputs: EvaluationOutputs): boolean {
  return !!(outputs.step_a && outputs.step_b && outputs.step_c && outputs.step_d && outputs.step_e);
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasMeaningfulCombinedOutputs(outputs: EvaluationOutputs): boolean {
  if (!outputs.step_a || !outputs.step_b || !outputs.step_c || !outputs.step_d || !outputs.step_e) {
    return false;
  }

  if (!isNonEmptyString(outputs.step_a.wellbeing_definition)) return false;
  if (!isNonEmptyString(outputs.step_a.responsibility_assignment?.narrative)) return false;
  if (!isNonEmptyString(outputs.step_b.overall_bias_profile_summary)) return false;
  if (!isNonEmptyString(outputs.step_c.explanation)) return false;
  if (!isNonEmptyString(outputs.step_d.explanation)) return false;
  if (!isNonEmptyString(outputs.step_e.explanation)) return false;

  if (outputs.step_b.detected_biases?.length) {
    for (const bias of outputs.step_b.detected_biases) {
      if (!isNonEmptyString(bias.id) || !isNonEmptyString(bias.label) || !isNonEmptyString(bias.explanation)) {
        return false;
      }
    }
  }

  return true;
}

const strictStepRequirements: Record<string, string[]> = {
  'step-a': [
    'wellbeing_definition must be a non-empty string.',
    'responsibility_assignment.narrative must be a non-empty string.',
  ],
  'step-b': [
    'overall_bias_profile_summary must be a non-empty string.',
    'If no biases are detected, set detected_biases to [] and explain why in overall_bias_profile_summary.',
    'For each detected bias, id, label, and explanation must be non-empty strings.',
  ],
  'step-c': [
    'explanation must be a non-empty string.',
  ],
  'step-d': [
    'explanation must be a non-empty string.',
  ],
  'step-e': [
    'explanation must be a non-empty string.',
  ],
};

function isValidStepOutput(stepId: string, output: unknown): boolean {
  if (!output || typeof output !== 'object') {
    return false;
  }

  if (stepId === 'step-a') {
    const value = output as StepAOutput;
    return isNonEmptyString(value.wellbeing_definition)
      && isNonEmptyString(value.responsibility_assignment?.narrative);
  }

  if (stepId === 'step-b') {
    const value = output as StepBOutput;
    if (!isNonEmptyString(value.overall_bias_profile_summary)) {
      return false;
    }
    if (value.detected_biases?.length) {
      for (const bias of value.detected_biases) {
        if (!isNonEmptyString(bias.id) || !isNonEmptyString(bias.label) || !isNonEmptyString(bias.explanation)) {
          return false;
        }
      }
    }
    return true;
  }

  if (stepId === 'step-c') {
    const value = output as StepCOutput;
    return isNonEmptyString(value.explanation);
  }

  if (stepId === 'step-d') {
    const value = output as StepDOutput;
    return isNonEmptyString(value.explanation);
  }

  if (stepId === 'step-e') {
    const value = output as StepEOutput;
    return isNonEmptyString(value.explanation);
  }

  return true;
}

async function runEvaluationStepValidated<T>(
  adapter: ProviderAdapter,
  modelId: string,
  stepId: string,
  promptTemplate: string,
  answer: string,
  params: { temperature?: number; max_tokens?: number },
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  },
  responseFormat?: CompletionRequest['response_format']
): Promise<{ result: T; latency_ms: number }> {
  const first = await runEvaluationStep<T>(
    adapter,
    modelId,
    promptTemplate,
    answer,
    params,
    retryOptions,
    responseFormat
  );

  if (isValidStepOutput(stepId, first.result)) {
    return first;
  }

  const strictRules = strictStepRequirements[stepId];
  if (!strictRules) {
    return first;
  }

  const strictPrompt = [
    promptTemplate,
    '',
    'Additional requirements:',
    ...strictRules.map((rule) => `- ${rule}`),
    '',
    'Return ONLY valid JSON matching the schema. No additional text.',
  ].join('\n');

  return runEvaluationStep<T>(
    adapter,
    modelId,
    strictPrompt,
    answer,
    { ...params, temperature: 0.1 },
    retryOptions,
    responseFormat
  );
}

function listMissingSteps(outputs: EvaluationOutputs): string[] {
  const missing: string[] = [];
  if (!outputs.step_a) missing.push('step_a');
  if (!outputs.step_b) missing.push('step_b');
  if (!outputs.step_c) missing.push('step_c');
  if (!outputs.step_d) missing.push('step_d');
  if (!outputs.step_e) missing.push('step_e');
  return missing;
}

function listIncompleteSteps(outputs: EvaluationOutputs): string[] {
  const incomplete: string[] = [];

  if (!outputs.step_a
    || !isNonEmptyString(outputs.step_a.wellbeing_definition)
    || !isNonEmptyString(outputs.step_a.responsibility_assignment?.narrative)
    || !outputs.step_a.time_horizon) {
    incomplete.push('step-a');
  }

  if (!outputs.step_b || !isNonEmptyString(outputs.step_b.overall_bias_profile_summary)) {
    incomplete.push('step-b');
  } else if (outputs.step_b.detected_biases?.length) {
    for (const bias of outputs.step_b.detected_biases) {
      if (!isNonEmptyString(bias.id)
        || !isNonEmptyString(bias.label)
        || !isNonEmptyString(bias.explanation)) {
        incomplete.push('step-b');
        break;
      }
    }
  }

  if (!outputs.step_c || !isNonEmptyString(outputs.step_c.explanation)) {
    incomplete.push('step-c');
  }

  if (!outputs.step_d || !isNonEmptyString(outputs.step_d.explanation)) {
    incomplete.push('step-d');
  }

  if (!outputs.step_e || !isNonEmptyString(outputs.step_e.explanation)) {
    incomplete.push('step-e');
  }

  return Array.from(new Set(incomplete));
}

async function runStepwiseEvaluations(
  adapter: ProviderAdapter,
  modelId: string,
  answer: string,
  evalPrompts: EvalPromptsConfig,
  params: { temperature?: number; max_tokens?: number },
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<{ outputs: EvaluationOutputs; latencies: Record<string, number>; mode: 'stepwise' }> {
  const outputs: EvaluationOutputs = {
    step_a: null,
    step_b: null,
    step_c: null,
    step_d: null,
    step_e: null,
  };
  const latencies: Record<string, number> = {};
  const responseFormat = getResponseFormat(adapter, modelId);

  for (const step of evalPrompts.steps) {
    try {
      if (step.id === 'step-a') {
        const { result, latency_ms } = await runEvaluationStepValidated<StepAOutput>(
          adapter, modelId, step.id, step.prompt_template, answer, params, retryOptions, responseFormat
        );
        outputs.step_a = result;
        latencies.step_a = latency_ms;
      } else if (step.id === 'step-b') {
        const { result, latency_ms } = await runEvaluationStepValidated<StepBOutput>(
          adapter, modelId, step.id, step.prompt_template, answer, params, retryOptions, responseFormat
        );
        outputs.step_b = result;
        latencies.step_b = latency_ms;
      } else if (step.id === 'step-c') {
        const { result, latency_ms } = await runEvaluationStepValidated<StepCOutput>(
          adapter, modelId, step.id, step.prompt_template, answer, params, retryOptions, responseFormat
        );
        outputs.step_c = result;
        latencies.step_c = latency_ms;
      } else if (step.id === 'step-d') {
        const { result, latency_ms } = await runEvaluationStepValidated<StepDOutput>(
          adapter, modelId, step.id, step.prompt_template, answer, params, retryOptions, responseFormat
        );
        outputs.step_d = result;
        latencies.step_d = latency_ms;
      } else if (step.id === 'step-e') {
        const { result, latency_ms } = await runEvaluationStepValidated<StepEOutput>(
          adapter, modelId, step.id, step.prompt_template, answer, params, retryOptions, responseFormat
        );
        outputs.step_e = result;
        latencies.step_e = latency_ms;
      } else {
        console.warn(`Unknown evaluation step "${step.id}", skipping.`);
      }
    } catch (error) {
      console.error(`Failed evaluation step ${step.id}:`, error);
      // Continue with other steps
    }
  }

  return { outputs, latencies, mode: 'stepwise' };
}

async function runSelectedEvaluations(
  adapter: ProviderAdapter,
  modelId: string,
  answer: string,
  evalPrompts: EvalPromptsConfig,
  params: { temperature?: number; max_tokens?: number },
  stepsToRun: string[],
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<{ outputs: Partial<EvaluationOutputs>; latencies: Record<string, number> }> {
  const outputs: Partial<EvaluationOutputs> = {};
  const latencies: Record<string, number> = {};
  const responseFormat = getResponseFormat(adapter, modelId);

  for (const step of evalPrompts.steps) {
    if (!stepsToRun.includes(step.id)) {
      continue;
    }

    try {
      if (step.id === 'step-a') {
        const { result, latency_ms } = await runEvaluationStepValidated<StepAOutput>(
          adapter, modelId, step.id, step.prompt_template, answer, params, retryOptions, responseFormat
        );
        outputs.step_a = result;
        latencies.step_a = latency_ms;
      } else if (step.id === 'step-b') {
        const { result, latency_ms } = await runEvaluationStepValidated<StepBOutput>(
          adapter, modelId, step.id, step.prompt_template, answer, params, retryOptions, responseFormat
        );
        outputs.step_b = result;
        latencies.step_b = latency_ms;
      } else if (step.id === 'step-c') {
        const { result, latency_ms } = await runEvaluationStepValidated<StepCOutput>(
          adapter, modelId, step.id, step.prompt_template, answer, params, retryOptions, responseFormat
        );
        outputs.step_c = result;
        latencies.step_c = latency_ms;
      } else if (step.id === 'step-d') {
        const { result, latency_ms } = await runEvaluationStepValidated<StepDOutput>(
          adapter, modelId, step.id, step.prompt_template, answer, params, retryOptions, responseFormat
        );
        outputs.step_d = result;
        latencies.step_d = latency_ms;
      } else if (step.id === 'step-e') {
        const { result, latency_ms } = await runEvaluationStepValidated<StepEOutput>(
          adapter, modelId, step.id, step.prompt_template, answer, params, retryOptions, responseFormat
        );
        outputs.step_e = result;
        latencies.step_e = latency_ms;
      }
    } catch (error) {
      console.error(`Failed selected evaluation step ${step.id}:`, error);
    }
  }

  return { outputs, latencies };
}

async function runCombinedEvaluations(
  adapter: ProviderAdapter,
  modelId: string,
  answer: string,
  evalPrompts: EvalPromptsConfig,
  params: { temperature?: number; max_tokens?: number },
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<{
  outputs: EvaluationOutputs;
  latencies: Record<string, number>;
  mode: 'combined';
  incompleteSteps: string[];
}> {
  if (!evalPrompts.combined_prompt_template) {
    throw new Error('Combined evaluation prompt template not configured.');
  }

  const prompt = evalPrompts.combined_prompt_template.replace('{{answer}}', answer);
  const messages: ChatMessage[] = [
    { role: 'user', content: prompt },
  ];
  const responseFormat = getResponseFormat(adapter, modelId, evalPrompts.combined_output_schema);

  const { result, latency_ms } = await requestJsonResponse<EvaluationOutputs>(
    adapter,
    modelId,
    messages,
    params,
    retryOptions,
    responseFormat
  );

  let outputs = normalizeEvaluationOutputs(result as EvaluationOutputs);
  if (!hasAllEvaluationSteps(outputs) || !hasMeaningfulCombinedOutputs(outputs)) {
    const missing = listMissingSteps(outputs);
    const repairPrompt = [
      'The previous JSON output is incomplete or contains empty required fields.',
      missing.length > 0 ? `Missing keys: ${missing.join(', ')}.` : 'Some required fields are empty.',
      'Re-evaluate the answer and return a complete JSON object with all required keys and non-empty explanations.',
      'Do not use empty strings for required narrative/explanation fields.',
      'If no biases are detected, set detected_biases to [] but provide a non-empty overall_bias_profile_summary explaining that.',
      'Use the original answer below when re-evaluating.',
      'Answer to evaluate:',
      answer,
      'Here is the previous JSON output (for reference only):',
      JSON.stringify(result),
    ].join('\n');

    const repairMessages: ChatMessage[] = [
      { role: 'user', content: repairPrompt },
    ];

    const { result: repaired, latency_ms: repairLatency } = await requestJsonResponse<EvaluationOutputs>(
      adapter,
      modelId,
      repairMessages,
      { temperature: 0.1, max_tokens: params.max_tokens ?? 2000 },
      retryOptions,
      responseFormat
    );

    outputs = normalizeEvaluationOutputs(repaired as EvaluationOutputs);
    const incomplete = listIncompleteSteps(outputs);
    return {
      outputs,
      latencies: { combined: latency_ms, combined_repair: repairLatency },
      mode: 'combined',
      incompleteSteps: incomplete,
    };
  }

  return {
    outputs,
    latencies: { combined: latency_ms },
    mode: 'combined',
    incompleteSteps: [],
  };
}

/**
 * Run all evaluation steps (A-E) on an answer
 */
async function runAllEvaluations(
  adapter: ProviderAdapter,
  modelId: string,
  answer: string,
  evalPrompts: EvalPromptsConfig,
  params: { temperature?: number; max_tokens?: number },
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<{ outputs: EvaluationOutputs; latencies: Record<string, number>; mode: 'combined' | 'combined-partial' | 'stepwise' }> {
  if (evalPrompts.combined_prompt_template) {
    try {
      const combinedResult = await runCombinedEvaluations(
        adapter,
        modelId,
        answer,
        evalPrompts,
        params,
        retryOptions
      );
      if (combinedResult.incompleteSteps.length === 0) {
        return combinedResult;
      }

      const selected = await runSelectedEvaluations(
        adapter,
        modelId,
        answer,
        evalPrompts,
        params,
        combinedResult.incompleteSteps,
        retryOptions
      );

      return {
        outputs: {
          step_a: selected.outputs.step_a ?? combinedResult.outputs.step_a,
          step_b: selected.outputs.step_b ?? combinedResult.outputs.step_b,
          step_c: selected.outputs.step_c ?? combinedResult.outputs.step_c,
          step_d: selected.outputs.step_d ?? combinedResult.outputs.step_d,
          step_e: selected.outputs.step_e ?? combinedResult.outputs.step_e,
        },
        latencies: { ...combinedResult.latencies, ...selected.latencies },
        mode: 'combined-partial',
      };
    } catch (error) {
      console.warn('Combined evaluation failed; falling back to stepwise evaluation.', error);
    }
  }

  return runStepwiseEvaluations(
    adapter,
    modelId,
    answer,
    evalPrompts,
    params,
    retryOptions
  );
}

/**
 * Generate synthesis for a question across all model responses
 */
async function generateSynthesis(
  adapter: ProviderAdapter,
  modelId: string,
  questionId: string,
  responses: Array<{ modelName: string; answer: string }>,
  synthesisPrompt: string,
  params: { temperature?: number; max_tokens?: number },
  defaultLanguage: string,
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<SynthesisResult> {
  // Format responses for the prompt
  const formattedResponses = responses
    .map((r) => `### ${r.modelName}\n\n${r.answer}`)
    .join('\n\n---\n\n');

  const prompt = synthesisPrompt.replace('{{responses}}', formattedResponses);

  const messages: ChatMessage[] = [
    { role: 'user', content: prompt },
  ];

  const response = await adapter.complete({
    model: modelId,
    messages,
    temperature: params.temperature ?? 0.3,
    max_tokens: params.max_tokens ?? 2000,
    retry_options: retryOptions,
  });

  const parsed = parseJsonResponse(response.content) as {
    common_ground: string[];
    key_divergences: string[];
    salient_bias_patterns: string[];
  };

  return {
    question_id: questionId,
    language: defaultLanguage,
    common_ground: parsed.common_ground || [],
    key_divergences: parsed.key_divergences || [],
    salient_bias_patterns: parsed.salient_bias_patterns || [],
    generated_at: new Date().toISOString(),
  };
}

/**
 * Translate text using LLM
 */
async function translateText(
  adapter: ProviderAdapter,
  modelId: string,
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  translationTemplate: string,
  params: { temperature?: number },
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<string> {
  const prompt = translationTemplate
    .replace('{{text}}', text)
    .replace('{{source_language}}', sourceLanguage)
    .replace('{{target_language}}', targetLanguage);

  const messages: ChatMessage[] = [
    { role: 'user', content: prompt },
  ];

  const response = await adapter.complete({
    model: modelId,
    messages,
    temperature: params.temperature ?? 0.1,
    max_tokens: 4096,
    retry_options: retryOptions,
  });

  return response.content;
}

/**
 * Run the complete pipeline for all questions and models
 */
export async function runPipeline(
  plan: RunPlan,
  context: PipelineContext
): Promise<{
  items: PipelineItem[];
  syntheses: SynthesisResult[];
}> {
  const items: PipelineItem[] = [];
  const { adapters, evalPrompts, concurrency, retryOptions } = context;
  const evaluationParams = {
    temperature: plan.evaluation_params?.temperature ?? 0.3,
    max_tokens: plan.evaluation_params?.max_tokens ?? 2000,
  };
  const cacheEnabled = context.cache?.enabled ?? false;
  const cacheDir = context.cache?.dir ?? '';
  const evaluationSignature = hashObject({
    combined_prompt_template: evalPrompts.combined_prompt_template ?? null,
    combined_output_schema: evalPrompts.combined_output_schema ?? null,
    steps: evalPrompts.steps.map((step) => ({
      id: step.id,
      prompt_template: step.prompt_template,
      output_schema: step.output_schema,
    })),
  });
  const answerPromptSignature = hashObject({
    answer_wrapper_prompt: evalPrompts.answer_wrapper_prompt,
  });

  const modelVersionLookup = new Map<string, string | undefined>();
  for (const model of plan.models) {
    modelVersionLookup.set(`${model.provider_id}::${model.model_id}`, model.model_version);
  }

  // Create rate limiters
  const globalLimit = pLimit(concurrency.max_concurrent_requests || 3);
  const providerLimits = new Map<string, ReturnType<typeof pLimit>>();

  for (const [providerId] of adapters) {
    providerLimits.set(providerId, pLimit(concurrency.per_provider_limit || 2));
  }

  let completed = 0;
  const total = plan.total_evaluations;

  // Create all pipeline items
  const tasks: Array<Promise<void>> = [];

  for (const question of plan.questions) {
    for (const model of plan.models) {
      const adapter = adapters.get(model.provider_id);
      if (!adapter) {
        items.push({
          question_id: question.id,
          provider_id: model.provider_id,
          model_id: model.model_id,
          status: 'failed',
          error: `No adapter for provider: ${model.provider_id}`,
        });
        completed++;
        context.onProgress?.(completed, total, `Skipped ${completed}/${total}`);
        continue;
      }

      const item: PipelineItem = {
        question_id: question.id,
        provider_id: model.provider_id,
        model_id: model.model_id,
        status: 'pending',
      };
      items.push(item);

      const providerLimit = providerLimits.get(model.provider_id)!;
      const task = globalLimit(async () => {
        await providerLimit(async () => {
          try {
            // Step 1: Generate answer
            item.status = 'generating';
            context.onProgress?.(completed, total, `Generating: ${model.model_display_name} for ${question.id}`);

            const systemPrompt = evalPrompts.answer_wrapper_prompt.replace('{{question}}', question.text);
            const generationCacheKey = hashObject({
              type: 'generation',
              provider_id: model.provider_id,
              model_id: model.model_id,
              model_version: model.model_version ?? null,
              question_id: question.id,
              question_text: question.text,
              system_prompt: systemPrompt,
              answer_prompt_signature: answerPromptSignature,
              params: model.params,
            });

            let genResult: GenerationResult | null = null;
            if (cacheEnabled && cacheDir) {
              genResult = await readCache<GenerationResult>(cacheDir, 'answers', generationCacheKey);
            }
            const generationCacheHit = !!genResult;

            if (!genResult) {
              genResult = await generateAnswer(
                adapter,
                model.model_id,
                question.text,
                evalPrompts.answer_wrapper_prompt,
                model.params,
                retryOptions
              );

              if (cacheEnabled && cacheDir) {
                await writeCache(cacheDir, 'answers', generationCacheKey, genResult);
              }
            }

            if (!genResult) {
              throw new Error('Generation result missing after execution.');
            }

            item.raw_answer = genResult.content;
            item.metadata = {
              generation_timestamp: new Date().toISOString(),
              generation_latency_ms: genResult.latency_ms,
              generation_usage: genResult.usage,
              cache_hits: {
                generation: generationCacheHit,
              },
              cache_keys: {
                generation: generationCacheKey,
              },
            };

            // Step 2: Run evaluations
            item.status = 'evaluating';
            context.onProgress?.(completed, total, `Evaluating: ${model.model_display_name} for ${question.id}`);

            const evaluatorProviderId = plan.evaluation_params?.evaluator_provider ?? model.provider_id;
            const evaluatorModelId = plan.evaluation_params?.evaluator_model ?? model.model_id;
            const evaluatorAdapter = adapters.get(evaluatorProviderId);
            if (!evaluatorAdapter) {
              throw new Error(`No adapter for evaluation provider: ${evaluatorProviderId}`);
            }

            const answerHash = hashString(item.raw_answer);
            const evaluatorModelVersion = modelVersionLookup.get(`${evaluatorProviderId}::${evaluatorModelId}`);
            const evaluationCacheKey = hashObject({
              type: 'evaluation',
              evaluator_provider_id: evaluatorProviderId,
              evaluator_model_id: evaluatorModelId,
              evaluator_model_version: evaluatorModelVersion ?? null,
              answer_hash: answerHash,
              evaluation_signature: evaluationSignature,
              evaluation_params: evaluationParams,
            });

            let evalResult: { outputs: EvaluationOutputs; latencies: Record<string, number>; mode: 'combined' | 'stepwise' } | null = null;
            if (cacheEnabled && cacheDir) {
              evalResult = await readCache(cacheDir, 'evaluations', evaluationCacheKey);
            }
            const evaluationCacheHit = !!evalResult;

            if (!evalResult) {
              const runEvaluations = () =>
                runAllEvaluations(
                  evaluatorAdapter,
                  evaluatorModelId,
                  item.raw_answer,
                  evalPrompts,
                  evaluationParams,
                  retryOptions
                );
              evalResult = evaluatorProviderId === model.provider_id
                ? await runEvaluations()
                : await (providerLimits.get(evaluatorProviderId) ?? providerLimit)(runEvaluations);

              if (cacheEnabled && cacheDir) {
                await writeCache(cacheDir, 'evaluations', evaluationCacheKey, evalResult);
              }
            }

            if (!evalResult) {
              throw new Error('Evaluation result missing after execution.');
            }

            item.evaluations = evalResult.outputs;
            item.metadata.evaluation_latencies = evalResult.latencies;
            item.metadata.evaluation_mode = evalResult.mode;
            item.metadata.cache_hits = {
              ...item.metadata.cache_hits,
              evaluation: evaluationCacheHit,
            };
            item.metadata.cache_keys = {
              ...item.metadata.cache_keys,
              evaluation: evaluationCacheKey,
            };

            item.status = 'succeeded';
          } catch (error) {
            item.status = 'failed';
            item.error = error instanceof Error ? error.message : String(error);
            console.error(`Failed: ${model.provider_id}/${model.model_id} for ${question.id}:`, error);
          } finally {
            completed++;
            context.onProgress?.(completed, total, `Completed ${completed}/${total}`);
          }
        });
      });

      tasks.push(task);
    }
  }

  // Wait for all tasks to complete
  await Promise.all(tasks);

  // Generate syntheses (per question)
  const syntheses: SynthesisResult[] = [];

  // Get a synthesis adapter (use first available)
  const synthesisConfig = plan.synthesis || {};
  const synthesisProviderId = synthesisConfig.provider ?? plan.models[0]?.provider_id;
  const synthesisModelId = synthesisConfig.model ?? plan.models[0]?.model_id;
  const synthesisAdapter = synthesisProviderId ? adapters.get(synthesisProviderId) : undefined;

  if (synthesisConfig.enabled !== false && synthesisAdapter && synthesisModelId) {
    for (const question of plan.questions) {
      const questionItems = items.filter(
        (i) => i.question_id === question.id && i.status === 'succeeded' && i.raw_answer
      );

      if (questionItems.length < 2) {
        console.warn(`Skipping synthesis for ${question.id}: not enough successful responses`);
        continue;
      }

      try {
        const responses = questionItems.map((item) => ({
          modelName: `${item.provider_id}/${item.model_id}`,
          answer: item.raw_answer!,
        }));

        const synthesis = await generateSynthesis(
          synthesisAdapter,
          synthesisModelId,
          question.id,
          responses,
          evalPrompts.synthesis_prompt,
          { temperature: 0.3, max_tokens: 2000 },
          plan.default_language,
          retryOptions
        );

        syntheses.push(synthesis);
      } catch (error) {
        console.error(`Failed synthesis for ${question.id}:`, error);
      }
    }
  }

  return { items, syntheses };
}

/**
 * Translate syntheses and summaries to additional languages
 */
export async function translateResults(
  items: PipelineItem[],
  syntheses: SynthesisResult[],
  adapter: ProviderAdapter,
  modelId: string,
  translationTemplate: string,
  targetLanguages: string[],
  sourceLanguage: string = 'en',
  temperature: number = 0.1,
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  },
  concurrentTranslations: number = 3
): Promise<{
  translatedSyntheses: SynthesisResult[];
}> {
  // Validate concurrentTranslations parameter (must be positive integer, max 10)
  const validatedConcurrency = Math.max(1, Math.min(Math.floor(concurrentTranslations), 10));
  if (validatedConcurrency !== concurrentTranslations) {
    console.warn(
      `concurrentTranslations adjusted from ${concurrentTranslations} to ${validatedConcurrency} (valid range: 1-10)`
    );
  }

  const translatedSyntheses: SynthesisResult[] = [...syntheses];

  // Rate limiter to prevent overwhelming the API
  const translationLimit = pLimit(validatedConcurrency);

  /**
   * Helper to translate a synthesis object in one request.
   */
  async function translateSynthesisBatch(
    synthesis: SynthesisResult,
    targetLang: string
  ): Promise<SynthesisResult> {
    const payload = {
      common_ground: synthesis.common_ground || [],
      key_divergences: synthesis.key_divergences || [],
      salient_bias_patterns: synthesis.salient_bias_patterns || [],
    };

    const prompt = translationTemplate
      .replace('{{text}}', JSON.stringify(payload))
      .replace('{{source_language}}', sourceLanguage)
      .replace('{{target_language}}', targetLang);

    const messages: ChatMessage[] = [
      { role: 'user', content: prompt },
    ];

  const responseFormat = getResponseFormat(adapter, modelId);
    const { result } = await requestJsonResponse<{
      common_ground: string[];
      key_divergences: string[];
      salient_bias_patterns: string[];
    }>(
      adapter,
      modelId,
      messages,
      { temperature, max_tokens: 4096 },
      retryOptions,
      responseFormat
    );

    if (!Array.isArray(result.common_ground)
      || !Array.isArray(result.key_divergences)
      || !Array.isArray(result.salient_bias_patterns)) {
      throw new Error('Translated synthesis payload missing required arrays.');
    }

    return {
      question_id: synthesis.question_id,
      language: targetLang,
      common_ground: result.common_ground,
      key_divergences: result.key_divergences,
      salient_bias_patterns: result.salient_bias_patterns,
      generated_at: new Date().toISOString(),
    };
  }

  async function translateArrayFallback(texts: string[], targetLang: string): Promise<string[]> {
    const tasks = texts.map((text) =>
      translationLimit(() =>
        translateText(
          adapter,
          modelId,
          text,
          sourceLanguage,
          targetLang,
          translationTemplate,
          { temperature },
          retryOptions
        )
      )
    );

    const results = await Promise.allSettled(tasks);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      console.warn(
        `Translation failed for item ${index + 1} to ${targetLang}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`
      );
      return texts[index];
    });
  }

  // Translate syntheses to each target language
  for (const synthesis of syntheses) {
    for (const targetLang of targetLanguages) {
      if (targetLang === sourceLanguage) continue;

      try {
        const translated = await translationLimit(() =>
          translateSynthesisBatch(synthesis, targetLang)
        );
        translatedSyntheses.push(translated);
      } catch (error) {
        console.error(`Failed batched translation for ${synthesis.question_id} to ${targetLang}:`, error);

        try {
          const translatedCommonGround = await translateArrayFallback(
            synthesis.common_ground || [],
            targetLang
          );
          const translatedDivergences = await translateArrayFallback(
            synthesis.key_divergences || [],
            targetLang
          );
          const translatedPatterns = await translateArrayFallback(
            synthesis.salient_bias_patterns || [],
            targetLang
          );

          translatedSyntheses.push({
            question_id: synthesis.question_id,
            language: targetLang,
            common_ground: translatedCommonGround,
            key_divergences: translatedDivergences,
            salient_bias_patterns: translatedPatterns,
            generated_at: new Date().toISOString(),
          });
        } catch (fallbackError) {
          console.error(
            `Failed fallback translation for ${synthesis.question_id} to ${targetLang}:`,
            fallbackError
          );
        }
      }
    }
  }

  return { translatedSyntheses };
}
