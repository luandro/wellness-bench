/**
 * TypeScript types for the benchmark pipeline
 * These types define the data structures used throughout the pipeline
 */

// =============================================================================
// Configuration Types (Input)
// =============================================================================

export interface Question {
  id: string;
  title: string;
  text: string;
  domain: string;
  order: number;
  enabled: boolean;
  tags?: string[];
}

export interface QuestionsConfig {
  version: string;
  updated_at: string;
  domains: string[];
  questions: Question[];
}

export interface ModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  version?: string;
  default_params: {
    temperature: number;
    max_tokens: number;
    [key: string]: unknown;
  };
}

export interface ProviderConfig {
  provider_id: string;
  display_name: string;
  enabled: boolean;
  base_url?: string;
  auth_type: 'bearer' | 'api-key';
  env_key_name: string;
  models: ModelConfig[];
}

export interface ProvidersConfig {
  version: string;
  updated_at: string;
  providers: ProviderConfig[];
}

export interface BiasDefinition {
  id: string;
  label: string;
  description: string;
}

export interface EvalStep {
  id: string;
  name: string;
  description: string;
  prompt_template: string;
  output_schema: Record<string, unknown>;
}

export interface EvalPromptsConfig {
  version: string;
  updated_at: string;
  answer_wrapper_prompt: string;
  synthesis_prompt: string;
  combined_prompt_template?: string;
  combined_output_schema?: Record<string, unknown>;
  translation_prompt_template?: string;
  steps: EvalStep[];
  bias_taxonomy: BiasDefinition[];
}

export interface QuestionSelection {
  question_ids?: string[];
  domains?: string[];
  tags?: string[];
  include_disabled?: boolean;
}

export interface ProviderSelection {
  provider_ids?: string[];
  model_ids?: string[];
  include_disabled?: boolean;
}

export interface GenerationParams {
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

export interface EvaluationParams {
  temperature?: number;
  max_tokens?: number;
  evaluator_model?: string;
  evaluator_provider?: string;
}

export interface SynthesisConfig {
  enabled?: boolean;
  model?: string;
  provider?: string;
}

export interface TranslationConfig {
  enabled?: boolean;
  model?: string;
  provider?: string;
  temperature?: number;
}

export interface ConcurrencyConfig {
  max_concurrent_requests?: number;
  per_provider_limit?: number;
  retry_attempts?: number;
  retry_delay_ms?: number;
}

export interface RunConfig {
  run_id?: string;
  run_name: string;
  run_description?: string;
  default_language: string;
  enabled_languages: string[];
  question_selection?: QuestionSelection;
  provider_selection?: ProviderSelection;
  generation_params?: GenerationParams;
  evaluation_params?: EvaluationParams;
  synthesis?: SynthesisConfig;
  translation?: TranslationConfig;
  concurrency?: ConcurrencyConfig;
  output_dir?: string;
}

// =============================================================================
// Evaluation Output Types (Intermediate)
// =============================================================================

export interface StepAOutput {
  wellbeing_definition: string;
  main_problems: string[];
  root_causes: string[];
  responsibility_assignment: {
    groups: string[];
    narrative: string;
  };
  time_horizon: 'short' | 'medium' | 'long' | 'intergenerational';
  mechanisms_of_change: string[];
  treated_as_fixed_or_inevitable: string[];
  notable_omissions: string[];
}

export interface DetectedBias {
  id: string;
  label: string;
  evidence_quotes: string[];
  explanation: string;
}

export interface StepBOutput {
  detected_biases: DetectedBias[];
  overall_bias_profile_summary: string;
}

export interface StepCOutput {
  alignment_areas: string[];
  tensions_or_absences: string[];
  alignment_score_0_5: number;
  explanation: string;
}

export interface StepDOutput {
  coherence_score_0_5: number;
  tradeoffs_acknowledged: boolean;
  enforcement_or_coordination_mechanisms_present: boolean;
  realism_notes: string[];
  explanation: string;
}

export interface StepEOutput {
  humility_score_0_5: number;
  uncertainty_acknowledged: boolean;
  what_evidence_would_change_mind: string[];
  evidence_quotes: string[];
  explanation: string;
}

export interface EvaluationOutputs {
  step_a: StepAOutput | null;
  step_b: StepBOutput | null;
  step_c: StepCOutput | null;
  step_d: StepDOutput | null;
  step_e: StepEOutput | null;
}

// =============================================================================
// Provider Adapter Types
// =============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: {
    type: 'json_object' | 'json_schema';
    json_schema?: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
  retry_options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
  [key: string]: unknown;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface CompletionResponse {
  content: string;
  finish_reason: string;
  usage?: TokenUsage;
  latency_ms: number;
}

export interface ProviderAdapter {
  provider_id: string;
  display_name: string;

  /**
   * Check if the provider is available (API key present)
   */
  isAvailable(): boolean;

  /**
   * Get the API key from environment
   */
  getApiKey(): string | undefined;

  /**
   * Send a chat completion request
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

// =============================================================================
// Pipeline State Types
// =============================================================================

export interface ResolvedModel {
  provider_id: string;
  provider_display_name: string;
  model_id: string;
  model_display_name: string;
  model_version?: string;
  params: GenerationParams;
}

export interface RunPlan {
  run_id: string;
  run_name: string;
  run_description?: string;
  created_at: string;
  git_sha?: string;
  default_language: string;
  enabled_languages: string[];
  evaluation_params?: EvaluationParams;
  synthesis?: SynthesisConfig;
  translation?: TranslationConfig;
  questions: Question[];
  models: ResolvedModel[];
  output_dir: string;
  total_evaluations: number;
}

export type PipelineItemStatus = 'pending' | 'generating' | 'evaluating' | 'translating' | 'succeeded' | 'failed';

export interface PipelineItem {
  question_id: string;
  provider_id: string;
  model_id: string;
  status: PipelineItemStatus;
  error?: string;
  raw_answer?: string;
  evaluations?: EvaluationOutputs;
  metadata?: {
    generation_timestamp: string;
    generation_latency_ms: number;
    generation_usage?: TokenUsage;
    evaluation_latencies?: Record<string, number>;
    translation_latencies?: Record<string, number>;
    evaluation_mode?: 'combined' | 'combined-partial' | 'stepwise';
    cache_hits?: {
      generation?: boolean;
      evaluation?: boolean;
    };
    cache_keys?: {
      generation?: string;
      evaluation?: string;
    };
  };
}

export interface SynthesisResult {
  question_id: string;
  language: string;
  common_ground: string[];
  key_divergences: string[];
  salient_bias_patterns: string[];
  generated_at: string;
}

// =============================================================================
// Output Bundle Types (for viewer)
// =============================================================================

export interface RunIndexModelEntry {
  provider_id: string;
  model_id: string;
  display_name: string;
  version?: string;
}

export interface RunIndexFileMap {
  snapshots: {
    questions: string;
    eval_prompts: string;
    providers: string;
  };
  per_question: Record<string, string>;
  per_model: Record<string, Record<string, string>>;
}

export interface RunIndexStats {
  total_questions: number;
  total_models: number;
  total_evaluations: number;
  succeeded: number;
  failed: number;
  total_duration_ms: number;
}

export interface RunIndex {
  run_id: string;
  run_name: string;
  run_description?: string;
  created_at: string;
  completed_at?: string;
  git_sha?: string;
  languages_available: string[];
  models_included: RunIndexModelEntry[];
  question_ids: string[];
  file_map: RunIndexFileMap;
  stats?: RunIndexStats;
}

export interface PerQuestionModelSummary {
  provider_id: string;
  model_id: string;
  display_name: string;
  status: 'succeeded' | 'failed' | 'partial';
  error?: string;
  summary: Record<string, string>; // language -> summary text
  scores: {
    buen_vivir_alignment?: number;
    coherence?: number;
    epistemic_humility?: number;
    bias_count?: number;
  };
  detected_bias_ids: string[];
  detail_file: string;
}

export interface PerQuestionSynthesis {
  common_ground: string[];
  key_divergences: string[];
  salient_bias_patterns: string[];
  generated_at?: string;
}

export interface PerQuestionResult {
  question_id: string;
  question: {
    id: string;
    title: string;
    text: string;
    domain: string;
    order?: number;
  };
  models: PerQuestionModelSummary[];
  synthesis: Record<string, PerQuestionSynthesis>; // language -> synthesis
}

export interface DisplayBlockDecomposition {
  wellbeing_definition: string;
  main_problems: string[];
  root_causes: string[];
  mechanisms_of_change: string[];
  notable_omissions: string[];
}

export interface DisplayBlockBiasAnalysis {
  detected_biases: Array<{
    id: string;
    label: string;
    explanation: string;
    evidence_quotes: string[];
  }>;
  overall_summary: string;
}

export interface DisplayBlockBuenVivir {
  score: number;
  alignment_areas: string[];
  tensions: string[];
  explanation: string;
}

export interface DisplayBlockCoherence {
  score: number;
  tradeoffs_acknowledged: boolean;
  enforcement_mechanisms: boolean;
  notes: string[];
  explanation: string;
}

export interface DisplayBlockEpistemicHumility {
  score: number;
  uncertainty_acknowledged: boolean;
  evidence_for_change: string[];
  explanation: string;
}

export interface DisplayBlocks {
  summary: string;
  answer_preview: string;
  decomposition?: DisplayBlockDecomposition;
  bias_analysis?: DisplayBlockBiasAnalysis;
  buen_vivir?: DisplayBlockBuenVivir;
  coherence?: DisplayBlockCoherence;
  epistemic_humility?: DisplayBlockEpistemicHumility;
}

export interface PerModelResult {
  question_id: string;
  provider_id: string;
  model_id: string;
  display_name: string;
  status: 'succeeded' | 'failed' | 'partial';
  error?: string;
  raw_answer: string;
  evaluations: EvaluationOutputs;
  extracted_quotes: Record<string, string[]>; // bias_id -> quotes
  display_blocks: Record<string, DisplayBlocks>; // language -> blocks
  prompt_inputs: {
    question_text: string;
    system_prompt: string;
    model_params: Record<string, unknown>;
  };
  metadata: {
    timestamp: string;
    latency_ms: number;
    token_usage?: TokenUsage;
    evaluation_latencies?: Record<string, number>;
    evaluation_mode?: 'combined' | 'combined-partial' | 'stepwise';
    cache_hits?: {
      generation?: boolean;
      evaluation?: boolean;
    };
    cache_keys?: {
      generation?: string;
      evaluation?: string;
    };
  };
}

export interface RunsCatalogEntry {
  run_id: string;
  run_name: string;
  run_description?: string;
  created_at: string;
  completed_at?: string;
  status: 'completed' | 'failed' | 'partial';
  git_sha?: string;
  languages: string[];
  question_count: number;
  model_count: number;
  path: string;
}

export interface RunsCatalog {
  version: string;
  updated_at: string;
  runs: RunsCatalogEntry[];
}

// =============================================================================
// Utility Types
// =============================================================================

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error | unknown): void;
  debug(message: string, data?: Record<string, unknown>): void;
  progress(current: number, total: number, message: string): void;
}

export interface PipelineOptions {
  dryRun: boolean;
  verbose: boolean;
  providers?: string[];
  questions?: string[];
}
