// Core types for the AI Human Wellness Benchmark

export type AppMode = 'builder' | 'viewer';

// Questions
export interface Question {
  id: string;
  title: string;
  text: string;
  domain: string;
  order: number;
  enabled: boolean;
}

export interface QuestionsConfig {
  version: string;
  updated_at: string;
  domains: string[];
  questions: Question[];
}

// Bias Taxonomy
export interface BiasDefinition {
  id: string;
  label: string;
  description: string;
}

// Evaluation Prompts
export interface EvalPrompt {
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
  steps: EvalPrompt[];
  bias_taxonomy: BiasDefinition[];
}

// Providers
export interface ModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  default_params: {
    temperature: number;
    max_tokens: number;
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

// Evaluation Results
export interface DetectedBias {
  id: string;
  label: string;
  evidence_quotes: string[];
  explanation: string;
}

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

export interface EvaluationResult {
  question_id: string;
  provider_id: string;
  model_id: string;
  raw_answer: string;
  step_a: StepAOutput;
  step_b: StepBOutput;
  step_c: StepCOutput;
  step_d: StepDOutput;
  step_e: StepEOutput;
  prompt_inputs: {
    question: string;
    model_params: Record<string, unknown>;
  };
  metadata: {
    timestamp: string;
    latency_ms: number;
    token_usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
}

export interface SynthesisSummary {
  question_id: string;
  common_ground: string[];
  key_divergences: string[];
  salient_bias_patterns: string[];
  generated_at: string;
}

// Run
export type RunItemStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface RunItem {
  id: string;
  question_id: string;
  provider_id: string;
  model_id: string;
  status: RunItemStatus;
  error?: string;
  result?: EvaluationResult;
}

export interface Run {
  id: string;
  name: string;
  created_at: string;
  completed_at?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  items: RunItem[];
  config_snapshot: {
    questions: QuestionsConfig;
    eval_prompts: EvalPromptsConfig;
    providers: ProvidersConfig;
  };
}

// Results Bundle (for export/viewer)
export interface ResultsCatalog {
  version: string;
  generated_at: string;
  runs: {
    id: string;
    name: string;
    created_at: string;
    question_count: number;
    provider_count: number;
  }[];
  questions: Question[];
  providers: { id: string; name: string }[];
}

export interface ResultsBundle {
  catalog: ResultsCatalog;
  runs: Run[];
  syntheses: SynthesisSummary[];
}
