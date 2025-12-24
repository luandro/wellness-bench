#!/usr/bin/env node
/**
 * Benchmark Runner CLI
 * Main entry point for running the wellness benchmark pipeline
 *
 * Usage:
 *   pnpm run benchmark -- --runConfig benchmarks/config/run_config.json
 *   pnpm run benchmark -- --runConfig ... --dryRun
 *   pnpm run benchmark -- --runConfig ... --providers openai,anthropic
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import { existsSync } from 'fs';
import {
  loadAllConfigs,
  getDefaultConfigDir,
} from './config-loader.js';
import {
  createRunPlan,
  printRunPlanSummary,
} from './run-planner.js';
import { runPipeline, translateResults } from './pipeline.js';
import {
  generateOutputBundle,
  updateRunsCatalog,
} from './output-generator.js';
import {
  createAvailableAdapters,
  validateProviderKeys,
  getSupportedProviders,
} from '../providers/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env file if it exists
const envPath = resolve(__dirname, '../../.env');
if (existsSync(envPath)) {
  try {
    // @ts-ignore - loadEnvFile is available in Node 20.12+
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
    }
  } catch (e) {
    // Ignore errors loading .env
  }
}

interface CliOptions {
  runConfig?: string;
  configDir?: string;
  dryRun: boolean;
  verbose: boolean;
  providers?: string;
  models?: string;
  questions?: string;
  help: boolean;
}

function printHelp(): void {
  console.log(`
AI Human Wellness Benchmark Runner

Usage:
  pnpm run benchmark -- [options]

Options:
  --runConfig <path>    Path to run configuration file
  --configDir <path>    Path to config directory (default: benchmarks/config)
  --dryRun              Print run plan without executing
  --verbose             Enable verbose logging
  --providers <list>    Comma-separated list of providers to run
  --models <list>       Comma-separated list of model IDs to run
  --questions <list>    Comma-separated list of question IDs to run
  --help                Show this help message

Environment Variables:
  OPENAI_API_KEY        OpenAI API key
  ANTHROPIC_API_KEY     Anthropic API key
  GOOGLE_API_KEY        Google/Gemini API key
  XAI_API_KEY           xAI/Grok API key
  DEEPSEEK_API_KEY      DeepSeek API key
  OPENROUTER_API_KEY    OpenRouter API key (can be used as fallback for all others)

Examples:  # Run with default config
  pnpm run benchmark

  # Run with custom config
  pnpm run benchmark -- --runConfig my-config.json

  # Dry run to see plan
  pnpm run benchmark -- --dryRun

  # Run only specific providers
  pnpm run benchmark -- --providers openai,anthropic
`);
}

function parseCliArgs(): CliOptions {
  const { values } = parseArgs({
    options: {
      runConfig: { type: 'string' },
      configDir: { type: 'string' },
      dryRun: { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
      providers: { type: 'string' },
      models: { type: 'string' },
      questions: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });

  return {
    runConfig: values.runConfig,
    configDir: values.configDir,
    dryRun: values.dryRun ?? false,
    verbose: values.verbose ?? false,
    providers: values.providers,
    models: values.models,
    questions: values.questions,
    help: values.help ?? false,
  };
}

function createProgressLogger(verbose: boolean) {
  return (current: number, total: number, message: string) => {
    if (verbose) {
      console.log(`[${current}/${total}] ${message}`);
    } else {
      // Simple progress indicator
      const pct = Math.round((current / total) * 100);
      process.stdout.write(`\rProgress: ${pct}% (${current}/${total})`);
      if (current === total) {
        console.log('');
      }
    }
  };
}

async function main(): Promise<void> {
  const startTime = Date.now();
  let options: CliOptions | undefined;

  try {
    options = parseCliArgs();

    if (options.help) {
      printHelp();
      process.exit(0);
    }

    console.log('=== AI Human Wellness Benchmark Runner ===\n');

    // Determine config paths
    const configDir = options.configDir
      ? resolve(options.configDir)
      : getDefaultConfigDir();

    const runConfigPath = options.runConfig
      ? resolve(options.runConfig)
      : undefined;

    // Load configurations
    console.log('Loading configurations...');
    const configs = await loadAllConfigs(configDir, runConfigPath);
    console.log('  - Questions:', configs.questions.questions.length);
    console.log('  - Providers:', configs.providers.providers.length);
    console.log('  - Eval steps:', configs.evalPrompts.steps.length);

    // Apply CLI overrides to run config
    if (options.providers) {
      const providerIds = options.providers
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      configs.runConfig.provider_selection = {
        ...configs.runConfig.provider_selection,
        provider_ids: providerIds,
      };
    }

    if (options.questions) {
      const questionIds = options.questions
        .split(',')
        .map((q) => q.trim())
        .filter(Boolean);
      configs.runConfig.question_selection = {
        ...configs.runConfig.question_selection,
        question_ids: questionIds,
      };
    }

    if (options.models) {
      const modelIds = options.models
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
      configs.runConfig.provider_selection = {
        ...configs.runConfig.provider_selection,
        model_ids: modelIds,
      };
    }

    // Create run plan
    console.log('\nCreating run plan...');
    const plan = createRunPlan(
      configs.runConfig,
      configs.questions,
      configs.providers
    );

    printRunPlanSummary(plan);

    if (options.dryRun) {
      console.log('Dry run mode - exiting without executing.\n');
      process.exit(0);
    }

    // Get list of providers needed
    const requiredProviderIds = new Set(plan.models.map((m) => m.provider_id));
    if (plan.evaluation_params?.evaluator_provider) {
      requiredProviderIds.add(plan.evaluation_params.evaluator_provider);
    }
    if (plan.synthesis?.provider) {
      requiredProviderIds.add(plan.synthesis.provider);
    }
    if (plan.translation?.provider) {
      requiredProviderIds.add(plan.translation.provider);
    }

    // Validate provider support
    const supportedProviders = new Set(getSupportedProviders());
    const unsupportedProviders = [...requiredProviderIds].filter(
      (providerId) => !supportedProviders.has(providerId)
    );
    if (unsupportedProviders.length > 0) {
      console.error('\nUnsupported providers in configuration:');
      for (const providerId of unsupportedProviders) {
        console.error(`  - ${providerId}`);
      }
      console.error('\nUpdate benchmarks/config/providers.json to remove unsupported providers.');
      process.exit(1);
    }

    // Validate API keys
    console.log('Validating API keys...');
    const { valid, missing } = validateProviderKeys(
      configs.providers.providers,
      [...requiredProviderIds]
    );

    if (!valid) {
      console.error('\nMissing required API keys:');
      for (const m of missing) {
        console.error(`  - ${m}`);
      }
      console.error('\nSet the environment variables and try again.');
      process.exit(1);
    }
    console.log('  All required API keys found.');

    // Create provider adapters
    console.log('\nInitializing provider adapters...');
    const adapters = createAvailableAdapters(configs.providers.providers, {
      filterProviders: [...requiredProviderIds],
    });
    console.log(`  Initialized ${adapters.size} adapter(s).`);

    // Run the pipeline
    console.log('\nRunning benchmark pipeline...\n');
    const progressLogger = createProgressLogger(options.verbose);

    const retryOptions: {
      maxRetries?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
    } | undefined = (() => {
      const retrySettings: {
        maxRetries?: number;
        baseDelayMs?: number;
        maxDelayMs?: number;
      } = {};
      if (typeof configs.runConfig.concurrency?.retry_attempts === 'number') {
        retrySettings.maxRetries = configs.runConfig.concurrency.retry_attempts;
      }
      if (typeof configs.runConfig.concurrency?.retry_delay_ms === 'number') {
        retrySettings.baseDelayMs = configs.runConfig.concurrency.retry_delay_ms;
      }
      return Object.keys(retrySettings).length > 0 ? retrySettings : undefined;
    })();

    const { items, syntheses } = await runPipeline(plan, {
      adapters,
      evalPrompts: configs.evalPrompts,
      concurrency: configs.runConfig.concurrency || {},
      retryOptions,
      onProgress: progressLogger,
    });

    // Count results
    const succeeded = items.filter((i) => i.status === 'succeeded').length;
    const failed = items.filter((i) => i.status === 'failed').length;

    console.log(`\nPipeline complete: ${succeeded} succeeded, ${failed} failed.`);

    // Optionally translate results
    let allSyntheses = syntheses;
    if (
      plan.translation?.enabled !== false &&
      configs.runConfig.enabled_languages.length > 1 &&
      configs.evalPrompts.translation_prompt_template
    ) {
      console.log('\nTranslating results...');
      const translationProviderId = plan.translation?.provider ?? plan.models[0]?.provider_id;
      const translationModelId = plan.translation?.model ?? plan.models[0]?.model_id;
      const translationAdapter = translationProviderId
        ? adapters.get(translationProviderId)
        : undefined;

      if (translationAdapter && translationModelId) {
        const targetLanguages = configs.runConfig.enabled_languages.filter(
          (l) => l !== configs.runConfig.default_language
        );
        const temperature = plan.translation?.temperature ?? 0.1;

        const { translatedSyntheses } = await translateResults(
          items,
          syntheses,
          translationAdapter,
          translationModelId,
          configs.evalPrompts.translation_prompt_template,
          targetLanguages,
          configs.runConfig.default_language,
          temperature,
          retryOptions
        );

        allSyntheses = translatedSyntheses;
        console.log(`  Translated to ${targetLanguages.length} additional language(s).`);
      } else {
        console.warn('Translation skipped: missing adapter or model for translation.');
      }
    }

    // Generate output bundle
    console.log('\nGenerating output bundle...');
    const rootDir = resolve(__dirname, '../..');
    const { runDir, indexPath } = await generateOutputBundle(
      plan,
      items,
      allSyntheses,
      {
        questions: configs.questions,
        providers: configs.providers,
        evalPrompts: configs.evalPrompts,
      },
      rootDir
    );

    // Update runs catalog
    await updateRunsCatalog(plan, items, rootDir);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nResults written to: ${runDir}`);
    console.log(`Index file: ${indexPath}`);
    console.log(`\nBenchmark completed in ${duration}s.`);

    // Print summary
    console.log('\n=== Summary ===');
    console.log(`Run ID:        ${plan.run_id}`);
    console.log(`Questions:     ${plan.questions.length}`);
    console.log(`Models:        ${plan.models.length}`);
    console.log(`Evaluations:   ${plan.total_evaluations}`);
    console.log(`Succeeded:     ${succeeded}`);
    console.log(`Failed:        ${failed}`);
    console.log(`Duration:      ${duration}s`);
    console.log('================\n');

  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    if (options?.verbose && error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:');
  if (reason instanceof Error) {
    console.error(reason.stack || reason.message);
  } else {
    console.error(reason);
  }
  process.exit(1);
});

// Run
main();