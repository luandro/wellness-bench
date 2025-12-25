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

interface PipelineContext {
  adapters: Map<string, ProviderAdapter>;
  evalPrompts: EvalPromptsConfig;
  concurrency: ConcurrencyConfig;
  retryOptions?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
  onProgress?: (current: number, total: number, message: string) => void;
}

interface GenerationResult {
  content: string;
  latency_ms: number;
  usage?: TokenUsage;
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
  }
): Promise<{ result: T; latency_ms: number }> {
  const prompt = promptTemplate.replace('{{answer}}', answer);

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

  // Parse JSON response
  let result: T;
  try {
    result = parseJsonResponse(response.content) as T;
  } catch (parseError) {
    // Retry with JSON repair instruction
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
): Promise<{ outputs: EvaluationOutputs; latencies: Record<string, number> }> {
  const outputs: EvaluationOutputs = {
    step_a: null,
    step_b: null,
    step_c: null,
    step_d: null,
    step_e: null,
  };
  const latencies: Record<string, number> = {};

  for (const step of evalPrompts.steps) {
    try {
      if (step.id === 'step-a') {
        const { result, latency_ms } = await runEvaluationStep<StepAOutput>(
          adapter, modelId, step.prompt_template, answer, params, retryOptions
        );
        outputs.step_a = result;
        latencies.step_a = latency_ms;
      } else if (step.id === 'step-b') {
        const { result, latency_ms } = await runEvaluationStep<StepBOutput>(
          adapter, modelId, step.prompt_template, answer, params, retryOptions
        );
        outputs.step_b = result;
        latencies.step_b = latency_ms;
      } else if (step.id === 'step-c') {
        const { result, latency_ms } = await runEvaluationStep<StepCOutput>(
          adapter, modelId, step.prompt_template, answer, params, retryOptions
        );
        outputs.step_c = result;
        latencies.step_c = latency_ms;
      } else if (step.id === 'step-d') {
        const { result, latency_ms } = await runEvaluationStep<StepDOutput>(
          adapter, modelId, step.prompt_template, answer, params, retryOptions
        );
        outputs.step_d = result;
        latencies.step_d = latency_ms;
      } else if (step.id === 'step-e') {
        const { result, latency_ms } = await runEvaluationStep<StepEOutput>(
          adapter, modelId, step.prompt_template, answer, params, retryOptions
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

  return { outputs, latencies };
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

            const genResult = await generateAnswer(
              adapter,
              model.model_id,
              question.text,
              evalPrompts.answer_wrapper_prompt,
              model.params,
              retryOptions
            );

            item.raw_answer = genResult.content;
            item.metadata = {
              generation_timestamp: new Date().toISOString(),
              generation_latency_ms: genResult.latency_ms,
              generation_usage: genResult.usage,
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

            const runEvaluations = () =>
              runAllEvaluations(
                evaluatorAdapter,
                evaluatorModelId,
                item.raw_answer,
                evalPrompts,
                evaluationParams,
                retryOptions
              );
            const evalResult = evaluatorProviderId === model.provider_id
              ? await runEvaluations()
              : await (providerLimits.get(evaluatorProviderId) ?? providerLimit)(runEvaluations);

            item.evaluations = evalResult.outputs;
            item.metadata.evaluation_latencies = evalResult.latencies;

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
   * Helper to translate an array of texts with rate limiting
   * Uses Promise.allSettled for partial failure handling - failed translations
   * are replaced with original text and logged
   */
  async function translateArray(texts: string[], targetLang: string): Promise<string[]> {
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
      } else {
        // Log failure but continue with original text
        console.warn(
          `Translation failed for item ${index + 1} to ${targetLang}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`
        );
        return texts[index]; // Fallback to original text
      }
    });
  }

  // Translate syntheses to each target language
  for (const synthesis of syntheses) {
    for (const targetLang of targetLanguages) {
      if (targetLang === sourceLanguage) continue;

      try {
        // Translate each array field with rate limiting
        const translatedCommonGround = await translateArray(
          synthesis.common_ground || [],
          targetLang
        );

        const translatedDivergences = await translateArray(
          synthesis.key_divergences || [],
          targetLang
        );

        const translatedPatterns = await translateArray(
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
      } catch (error) {
        console.error(`Failed translation for ${synthesis.question_id} to ${targetLang}:`, error);
      }
    }
  }

  return { translatedSyntheses };
}
