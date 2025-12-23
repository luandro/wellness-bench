/**
 * Configuration Loader
 * Loads and validates configuration files against JSON schemas
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type {
  QuestionsConfig,
  ProvidersConfig,
  EvalPromptsConfig,
  RunConfig,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize AJV with formats
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Load and parse a JSON file
 */
async function loadJsonFile<T>(filePath: string): Promise<T> {
  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }
  const content = await readFile(absolutePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Load a JSON schema
 */
async function loadSchema(schemaName: string): Promise<object> {
  const schemaPath = resolve(__dirname, '..', 'schemas', `${schemaName}.schema.json`);
  return loadJsonFile<object>(schemaPath);
}

/**
 * Validate data against a schema
 */
function validateAgainstSchema<T>(data: unknown, schema: object): ValidationResult<T> {
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return { valid: true, data: data as T };
  }

  const errors = validate.errors?.map((err) => {
    const path = err.instancePath || 'root';
    return `${path}: ${err.message}`;
  }) || ['Unknown validation error'];

  return { valid: false, errors };
}

/**
 * Load and validate questions configuration
 */
export async function loadQuestionsConfig(filePath: string): Promise<QuestionsConfig> {
  const data = await loadJsonFile<unknown>(filePath);
  const schema = await loadSchema('questions');
  const result = validateAgainstSchema<QuestionsConfig>(data, schema);

  if (!result.valid) {
    throw new Error(`Invalid questions configuration:\n${result.errors?.join('\n')}`);
  }

  return result.data!;
}

/**
 * Load and validate providers configuration
 */
export async function loadProvidersConfig(filePath: string): Promise<ProvidersConfig> {
  const data = await loadJsonFile<unknown>(filePath);
  const schema = await loadSchema('providers');
  const result = validateAgainstSchema<ProvidersConfig>(data, schema);

  if (!result.valid) {
    throw new Error(`Invalid providers configuration:\n${result.errors?.join('\n')}`);
  }

  return result.data!;
}

/**
 * Load and validate evaluation prompts configuration
 */
export async function loadEvalPromptsConfig(filePath: string): Promise<EvalPromptsConfig> {
  const data = await loadJsonFile<unknown>(filePath);
  const schema = await loadSchema('eval_prompts');
  const result = validateAgainstSchema<EvalPromptsConfig>(data, schema);

  if (!result.valid) {
    throw new Error(`Invalid eval_prompts configuration:\n${result.errors?.join('\n')}`);
  }

  return result.data!;
}

/**
 * Load and validate run configuration
 */
export async function loadRunConfig(filePath: string): Promise<RunConfig> {
  const data = await loadJsonFile<unknown>(filePath);
  const schema = await loadSchema('run_config');
  const result = validateAgainstSchema<RunConfig>(data, schema);

  if (!result.valid) {
    throw new Error(`Invalid run configuration:\n${result.errors?.join('\n')}`);
  }

  return result.data!;
}

/**
 * Load all configurations from a config directory
 */
export interface AllConfigs {
  questions: QuestionsConfig;
  providers: ProvidersConfig;
  evalPrompts: EvalPromptsConfig;
  runConfig: RunConfig;
}

export async function loadAllConfigs(
  configDir: string,
  runConfigPath?: string
): Promise<AllConfigs> {
  const questionsPath = resolve(configDir, 'questions.json');
  const providersPath = resolve(configDir, 'providers.json');
  const evalPromptsPath = resolve(configDir, 'eval_prompts.json');
  const defaultRunConfigPath = resolve(configDir, 'run_config.json');

  const [questions, providers, evalPrompts, runConfig] = await Promise.all([
    loadQuestionsConfig(questionsPath),
    loadProvidersConfig(providersPath),
    loadEvalPromptsConfig(evalPromptsPath),
    loadRunConfig(runConfigPath || defaultRunConfigPath),
  ]);

  return { questions, providers, evalPrompts, runConfig };
}

/**
 * Get the default config directory
 */
export function getDefaultConfigDir(): string {
  return resolve(__dirname, '..', 'config');
}
