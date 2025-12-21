/**
 * Zod schemas for validating imported configuration and results data
 */
import { z } from 'zod';

// Question schema
export const QuestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  domain: z.string().min(1),
  order: z.number().int().positive(),
  enabled: z.boolean(),
});

export const QuestionsConfigSchema = z.object({
  version: z.string(),
  updated_at: z.string(),
  domains: z.array(z.string()),
  questions: z.array(QuestionSchema),
});

// Bias definition schema
export const BiasDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
});

// Evaluation prompts schema
export const EvalPromptSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  prompt_template: z.string(),
  output_schema: z.record(z.unknown()),
});

export const EvalPromptsConfigSchema = z.object({
  version: z.string(),
  updated_at: z.string(),
  answer_wrapper_prompt: z.string(),
  synthesis_prompt: z.string(),
  steps: z.array(EvalPromptSchema),
  bias_taxonomy: z.array(BiasDefinitionSchema),
});

// Model config schema
export const ModelConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  default_params: z.object({
    temperature: z.number().min(0).max(2),
    max_tokens: z.number().int().positive(),
  }),
});

// Provider config schema
export const ProviderConfigSchema = z.object({
  provider_id: z.string().min(1),
  display_name: z.string().min(1),
  enabled: z.boolean(),
  base_url: z.string().url().optional(),
  auth_type: z.enum(['bearer', 'api-key']),
  env_key_name: z.string().min(1),
  models: z.array(ModelConfigSchema),
});

export const ProvidersConfigSchema = z.object({
  version: z.string(),
  updated_at: z.string(),
  providers: z.array(ProviderConfigSchema),
});

// Config bundle schema (for import)
export const ConfigBundleSchema = z.object({
  questions: QuestionsConfigSchema.optional(),
  eval_prompts: EvalPromptsConfigSchema.optional(),
  providers: ProvidersConfigSchema.optional(),
  exported_at: z.string().optional(),
}).refine(
  data => data.questions || data.eval_prompts || data.providers,
  { message: 'Config bundle must contain at least one configuration section' }
);

// Run item status
export const RunItemStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);

// Detected bias schema
export const DetectedBiasSchema = z.object({
  id: z.string(),
  label: z.string(),
  evidence_quotes: z.array(z.string()),
  explanation: z.string(),
});

// Step outputs schemas
export const StepAOutputSchema = z.object({
  wellbeing_definition: z.string(),
  main_problems: z.array(z.string()),
  root_causes: z.array(z.string()),
  responsibility_assignment: z.object({
    groups: z.array(z.string()),
    narrative: z.string(),
  }),
  time_horizon: z.enum(['short', 'medium', 'long', 'intergenerational']),
  mechanisms_of_change: z.array(z.string()),
  treated_as_fixed_or_inevitable: z.array(z.string()),
  notable_omissions: z.array(z.string()),
});

export const StepBOutputSchema = z.object({
  detected_biases: z.array(DetectedBiasSchema),
  overall_bias_profile_summary: z.string(),
});

export const StepCOutputSchema = z.object({
  alignment_areas: z.array(z.string()),
  tensions_or_absences: z.array(z.string()),
  alignment_score_0_5: z.number().min(0).max(5),
  explanation: z.string(),
});

export const StepDOutputSchema = z.object({
  coherence_score_0_5: z.number().min(0).max(5),
  tradeoffs_acknowledged: z.boolean(),
  enforcement_or_coordination_mechanisms_present: z.boolean(),
  realism_notes: z.array(z.string()),
  explanation: z.string(),
});

export const StepEOutputSchema = z.object({
  humility_score_0_5: z.number().min(0).max(5),
  uncertainty_acknowledged: z.boolean(),
  what_evidence_would_change_mind: z.array(z.string()),
  evidence_quotes: z.array(z.string()),
  explanation: z.string(),
});

// Evaluation result schema
export const EvaluationResultSchema = z.object({
  question_id: z.string(),
  provider_id: z.string(),
  model_id: z.string(),
  raw_answer: z.string(),
  step_a: StepAOutputSchema,
  step_b: StepBOutputSchema,
  step_c: StepCOutputSchema,
  step_d: StepDOutputSchema,
  step_e: StepEOutputSchema,
  prompt_inputs: z.object({
    question: z.string(),
    model_params: z.record(z.unknown()),
  }),
  metadata: z.object({
    timestamp: z.string(),
    latency_ms: z.number(),
    token_usage: z.object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    }).optional(),
  }),
});

// Run item schema
export const RunItemSchema = z.object({
  id: z.string(),
  question_id: z.string(),
  provider_id: z.string(),
  model_id: z.string(),
  status: RunItemStatusSchema,
  error: z.string().optional(),
  result: EvaluationResultSchema.optional(),
});

// Run schema
export const RunSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  completed_at: z.string().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  items: z.array(RunItemSchema),
  config_snapshot: z.object({
    questions: QuestionsConfigSchema,
    eval_prompts: EvalPromptsConfigSchema,
    providers: ProvidersConfigSchema,
  }),
});

// Synthesis summary schema
export const SynthesisSummarySchema = z.object({
  question_id: z.string(),
  common_ground: z.array(z.string()),
  key_divergences: z.array(z.string()),
  salient_bias_patterns: z.array(z.string()),
  generated_at: z.string(),
});

// Results catalog schema
export const ResultsCatalogSchema = z.object({
  version: z.string(),
  generated_at: z.string(),
  runs: z.array(z.object({
    id: z.string(),
    name: z.string(),
    created_at: z.string(),
    question_count: z.number(),
    provider_count: z.number(),
  })),
  questions: z.array(QuestionSchema),
  providers: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })),
});

// Results bundle schema (for import)
export const ResultsBundleSchema = z.object({
  catalog: ResultsCatalogSchema,
  runs: z.array(RunSchema),
  syntheses: z.array(SynthesisSummarySchema),
});

// Type exports
export type QuestionsConfigInput = z.infer<typeof QuestionsConfigSchema>;
export type EvalPromptsConfigInput = z.infer<typeof EvalPromptsConfigSchema>;
export type ProvidersConfigInput = z.infer<typeof ProvidersConfigSchema>;
export type ConfigBundleInput = z.infer<typeof ConfigBundleSchema>;
export type ResultsBundleInput = z.infer<typeof ResultsBundleSchema>;
