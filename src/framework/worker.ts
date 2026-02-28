/**
 * OneAgent SDK v4.2 - Worker Execution
 *
 * Executes an agent as a Worker using AI SDK v6 ToolLoopAgent.
 * Workers process input using LLM + MCP tools and return structured output.
 *
 * Supports dual execution modes:
 * - 'stream': Real-time streaming with textStream/partialOutputStream for UI
 * - 'generate': Batch processing with full result at once
 *
 * Uses the centralized AI model system from admin settings.
 *
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent
 */

import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import {
  getModelByTier,
  AIProviderConfigService,
  buildProviderOptions,
  type ProviderName,
} from '@giulio-leone/lib-ai';
import { resolveProviderFromModelId } from '@giulio-leone/types/ai';
import type { AgentManifest, Context, ExecutionResult, ExecutionMode } from './types';
import { OAUTH_PROVIDERS } from './types';
import { connectToMCPServers, mcpToolsToAiSdk } from './mcp';
import { loadAgentSkills } from './loader';

/** Rough token count estimate: ~4 chars per token */
function estimateTokens(...texts: unknown[]): number {
  return texts.reduce<number>((sum, t) => sum + Math.ceil(String(t ?? '').length / 4), 0);
}

/** Safely traverse nested object by dot-separated path */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// ==================== TYPES ====================

interface WorkerOptions {
  /** Override model for this execution */
  model?: string;
  /** Additional tools to include */
  additionalTools?: Record<string, unknown>;
  /** Skip MCP tool loading */
  skipMCPTools?: boolean;
  /** Tool choice strategy */
  toolChoice?: 'auto' | 'required' | 'none';
  /** Max steps for the agent loop */
  maxSteps?: number;
  /** Execution mode override: 'stream' for real-time UI, 'generate' for batch */
  executionMode?: ExecutionMode;
}

// ==================== PUBLIC API ====================

/**
 * Execute an agent as a Worker using ToolLoopAgent
 *
 * Workers use LLM + tools to process input and generate structured output.
 * This is the leaf node in the fractal architecture.
 *
 * Uses ToolLoopAgent with Output.object() for reliable structured output.
 *
 * @param manifest - Agent manifest with config and schemas
 * @param input - Validated input data
 * @param context - Execution context
 * @param options - Optional execution overrides
 */
export async function executeWorker<TOutput = unknown>(
  manifest: AgentManifest,
  input: unknown,
  context: Context,
  options: WorkerOptions = {}
): Promise<ExecutionResult<TOutput>> {
  const startTime = Date.now();

  try {
    // 1. Build system prompt with skills and prompt injection
    const systemPrompt = await buildSystemPrompt(manifest, input);

    // 2. Load tools (MCP + additional) with graceful degradation
    const tools = await loadToolsGracefully(manifest, options);

    // 3. Get model config respecting agent.json tier/model settings
    const modelConfig = await getModelForAgent(manifest);
    console.log('[Worker] Using model:', modelConfig.model, 'provider:', modelConfig.provider);

    // OAuth-based providers (gemini-cli) don't require API key
    const isOAuthProvider = OAUTH_PROVIDERS.includes(
      modelConfig.provider as (typeof OAUTH_PROVIDERS)[number]
    );

    const apiKey = await AIProviderConfigService.getApiKey(modelConfig.provider as ProviderName);

    if (!apiKey && !isOAuthProvider) {
      throw new Error(`API key mancante per il provider ${modelConfig.provider}`);
    }

    // Gemini CLI requires async model creation due to dynamic imports
    const { createModelAsync } = await import('@giulio-leone/lib-ai');
    const model = await createModelAsync(
      modelConfig as import('@giulio-leone/lib-ai').ModelConfig,
      apiKey ?? '',
      manifest.config.temperature
    );

    // 3b. Get preferredProvider for OpenRouter routing from admin settings
    const preferredProvider =
      modelConfig.provider === 'openrouter'
        ? await AIProviderConfigService.getDefaultProvider('openrouter')
        : null;

    // Build provider options for OpenRouter routing (order + allowFallbacks)
    const providerOptions =
      modelConfig.provider === 'openrouter'
        ? buildProviderOptions({
            modelId: modelConfig.model,
            preferredProvider,
          })
        : undefined;

    if (providerOptions) {
      console.log('[Worker] Using providerOptions:', JSON.stringify(providerOptions));
    }

    // Debug schema info
    console.log('[Worker] Has output schema:', !!manifest.interface.output);
    console.log('[Worker] System prompt length:', systemPrompt.length);

    // 4. Build user prompt from input
    const userPrompt = buildUserPrompt(input, manifest);

    // 5. Get max steps from config
    const maxSteps = options.maxSteps ?? manifest.config.maxSteps ?? 10;

    // 6. Get execution mode from config (default: stream)
    const executionMode = options.executionMode ?? manifest.config.executionMode ?? 'stream';

    // 7. Create ToolLoopAgent with Output.object() for structured output
    // AI SDK v6: use Output.object({ schema }) for typed structured output
    const agent = new ToolLoopAgent({
      model,
      instructions: systemPrompt,
      tools: tools as any,
      stopWhen: stepCountIs(maxSteps),
      toolChoice: options.toolChoice ?? (Object.keys(tools).length > 0 ? 'auto' : 'none'),
      output: Output.object({
        schema: manifest.interface.output,
      }),
      // Pass provider options for OpenRouter routing (order + allowFallbacks from admin settings)
      ...(providerOptions && { providerOptions }),
    });

    // 8. Execute based on mode
    let finalOutput: TOutput;
    let tokensUsed = 0;

    if (executionMode === 'generate') {
      // Generate mode: full result at once (batch processing)
      console.log('[Worker] Using generate mode');
      try {
        const result = await agent.generate({
          prompt: userPrompt,
        });

        console.log('[Worker] Generate result:', {
          hasOutput: !!result.output,
          textLength: result.text?.length ?? 0,
          stepsCount: result.steps?.length ?? 0,
          finishReason: result.finishReason,
        });

        finalOutput = result.output as TOutput;
        tokensUsed =
          result.usage?.totalTokens ?? estimateTokens(systemPrompt, userPrompt, finalOutput);
      } catch (generateError) {
        console.error('[Worker] Generate failed:', generateError);
        throw generateError;
      }
    } else {
      // Stream mode: real-time streaming for UI
      console.log('[Worker] Using stream mode');
      const streamResult = await agent.stream({
        prompt: userPrompt,
      });

      // AI SDK v6: stream() returns StreamTextResult with textStream, partialOutputStream, output
      // For structured output, we only need partialOutputStream - textStream would block
      const { partialOutputStream, output } = streamResult;

      // Consume partial stream for real-time progress
      // This is the correct pattern for structured output streaming
      let lastPartial: Partial<TOutput> | null = null;
      let stepCount = 0;
      let aiProgressCount = 0;

      for await (const partial of partialOutputStream) {
        lastPartial = partial as Partial<TOutput>;
        stepCount++;

        if (partial && typeof partial === 'object' && '_progress' in partial) {
          aiProgressCount++;
        }

        // Update context with step progress
        context.meta.updatedAt = new Date();
        context.meta.currentStep = `step:${stepCount}`;

        // Log progress for debugging
        if (stepCount % 5 === 0) {
          console.log(`[Worker] Stream progress: step ${stepCount}`);
        }
      }

      const requiresAiProgress = manifest.progress?.aiDriven ?? true;
      if (requiresAiProgress && aiProgressCount === 0) {
        throw new Error(`[Worker] ${manifest.id} did not emit required _progress updates`);
      }

      console.log('[Worker] partialOutputStream complete, steps:', stepCount);

      // Get final output from the output promise
      try {
        finalOutput = (await output) as TOutput;
        console.log('[Worker] Output promise resolved');
      } catch (outputError) {
        // If output promise rejects, try using last partial
        console.warn('[Worker] Output promise rejected, using lastPartial:', outputError);
        if (lastPartial) {
          finalOutput = lastPartial as TOutput;
        } else {
          throw new Error('ToolLoopAgent failed to produce structured output');
        }
      }

      // Estimate tokens for streaming (not directly available)
      tokensUsed = estimateTokens(systemPrompt, userPrompt, finalOutput);
    }

    if (!finalOutput) {
      throw new Error('ToolLoopAgent failed to produce structured output');
    }

    // 9. Calculate cost
    const costUSD = calculateCost(tokensUsed, modelConfig.model);

    // 10. Update context meta
    context.meta.tokensUsed += tokensUsed;
    context.meta.costUSD += costUSD;
    context.meta.updatedAt = new Date();
    context.meta.status = 'completed';

    return {
      success: true,
      output: finalOutput,
      meta: {
        executionId: context.executionId,
        duration: Date.now() - startTime,
        tokensUsed,
        costUSD,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    context.meta.status = 'failed';
    context.meta.error = message;
    context.meta.updatedAt = new Date();

    return {
      success: false,
      error: {
        message,
        code: 'WORKER_EXECUTION_ERROR',
        recoverable: false,
      },
      meta: {
        executionId: context.executionId,
        duration: Date.now() - startTime,
        tokensUsed: context.meta.tokensUsed,
        costUSD: context.meta.costUSD,
      },
    };
  }
}

// ==================== INTERNAL ====================

/**
 * Get model config respecting agent.json settings
 * Priority: explicit model > tier > default tier
 */
async function getModelForAgent(
  manifest: AgentManifest
): Promise<{ model: string; provider: string; maxTokens: number; creditsPerRequest: number }> {
  const config = manifest.config;

  // If agent.json specifies an explicit model (not 'auto'), use it
  if (config.model && config.model !== 'auto') {
    const provider = config.provider || resolveProviderFromModelId(config.model);
    console.log(`[Worker] Using explicit model from agent.json: ${config.model}`);
    return {
      model: config.model,
      provider,
      maxTokens: config.maxTokens || 4096,
      creditsPerRequest: 1,
    };
  }

  // Otherwise use tier system (default: balanced)
  const tier = config.tier || 'balanced';
  console.log(`[Worker] Using tier system: ${tier}`);
  return await getModelByTier(tier);
}

/**
 * Build system prompt with embedded skills and prompt injection
 * For workers, also checks parent agent directory for skills
 * @exported for reuse by durable executor (v4.0)
 */
export async function buildSystemPrompt(manifest: AgentManifest, input?: unknown): Promise<string> {
  const parts: string[] = [];

  // Base system prompt from AGENTS.md
  let basePrompt = manifest.systemPrompt || '';

  // Apply prompt injection: replace {{input.field}} with actual values
  if (input && typeof input === 'object') {
    basePrompt = injectPromptVariables(basePrompt, { input });
  }

  if (basePrompt) {
    parts.push(basePrompt);
    console.log(`[Worker] Base system prompt loaded: ${basePrompt.length} chars`);
  }

  // Load and append skills (own + exposed child skills for managers)
  const skills = await loadAgentSkills(manifest);
  const skillNames = Object.keys(skills);

  if (skillNames.length > 0) {
    console.log(`[Worker] Skills loaded: ${skillNames.join(', ')}`);
    for (const [skillName, skillContent] of Object.entries(skills)) {
      parts.push(`\n\n## Skill: ${skillName}\n\n${skillContent}`);
      console.log(`[Worker] Skill "${skillName}": ${skillContent.length} chars`);
    }
  } else {
    console.log(`[Worker] No skills found for ${manifest.id}`);
  }

  return parts.join('\n');
}

/**
 * Inject variables into prompt template
 * Replaces {{path.to.value}} with actual values from context
 */
function injectPromptVariables(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (match, path: string) => {
    const value = getNestedValue(context, path);
    if (value === undefined) {
      console.warn(`[Worker] Prompt variable not found: ${path}`);
      return match; // Keep original if not found
    }
    // Convert to string representation
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

/**
 * Load all tools with graceful MCP degradation
 */
async function loadToolsGracefully(
  manifest: AgentManifest,
  options: WorkerOptions
): Promise<Record<string, unknown>> {
  const tools: Record<string, unknown> = {};

  // Load local tools from registry (bundler-safe)
  const { getAgentTools } = await import('./registry');
  const registryTools = getAgentTools(manifest.id);
  if (registryTools) {
    Object.assign(tools, registryTools);
    console.log(`[Worker] Loaded ${Object.keys(registryTools).length} local tools from registry`);
  }

  // Load MCP tools with graceful degradation
  if (!options.skipMCPTools && manifest.mcpServers) {
    try {
      const mcpTools = await connectToMCPServers(manifest.mcpServers);
      const aiSdkTools = mcpToolsToAiSdk(mcpTools);
      Object.assign(tools, aiSdkTools);
      console.log(`[Worker] Loaded ${Object.keys(aiSdkTools).length} MCP tools`);
    } catch (err) {
      console.warn('[Worker] MCP connection failed, continuing without MCP tools:', err);
      // Agent continues to work with local tools only
    }
  }

  // Merge additional tools
  if (options.additionalTools) {
    Object.assign(tools, options.additionalTools);
  }

  return tools;
}

/**
 * Build user prompt from input
 */
function buildUserPrompt(input: unknown, manifest: AgentManifest): string {
  if (typeof input === 'string') {
    return input;
  }

  return `Process the following input and generate a ${manifest.id} output:\n\n${JSON.stringify(input, null, 2)}`;
}

/**
 * Calculate approximate cost based on token usage
 * Uses OpenRouter pricing as default since that's the admin default
 */
function calculateCost(tokens: number, model: string): number {
  // Simplified: assume 50/50 input/output split
  const inputTokens = tokens / 2;
  const outputTokens = tokens / 2;

  // OpenRouter/Gemini Flash pricing (approximate)
  if (model.includes('gemini-flash') || model.includes('gemini-2.0-flash')) {
    return (inputTokens * 0.01 + outputTokens * 0.04) / 1_000_000;
  }
  // Claude pricing
  if (model.includes('opus')) {
    return (inputTokens * 15 + outputTokens * 75) / 1_000_000;
  } else if (model.includes('haiku')) {
    return (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000;
  } else if (model.includes('sonnet')) {
    return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  }
  // Default to low cost model
  return (inputTokens * 0.01 + outputTokens * 0.04) / 1_000_000;
}
